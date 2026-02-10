/**
 * Reel Reflow Utility
 *
 * Shared logic for recomputing reel timelines and realigning effects
 * after any structural edit (trims, clip deletes, reorders, batch adds).
 *
 * Single source of truth — used by useClipTrimming, clip management,
 * auto-enhance, and any future editor action that mutates clip layout.
 */

import { ManifestClip, ReelManifest } from "@/lib/reels";
import { EffectEvent } from "@/lib/effectEvents";

// ============= Types =============

/** Cumulative boundary for a clip in reel-time */
export interface ClipBound {
  index: number;
  momentId: string;
  startMs: number;
  endMs: number;
  durMs: number;
}

/** Describes how a single effect should be repositioned */
export interface EffectRealignment {
  effectId: string;
  newStartTimeMs: number;
  /** True if the effect was clamped to a clip boundary (trimmed-away region) */
  clamped: boolean;
  /** True if the effect should be deleted (its clip no longer exists) */
  removed: boolean;
}

/** Full result of a reflow operation */
export interface ReflowResult {
  /** Updated manifest with recomputed durations */
  newManifest: ReelManifest;
  /** Total reel duration in ms */
  totalDurationMs: number;
  /** Per-effect position updates (only effects that moved, clamped, or were removed) */
  realignments: EffectRealignment[];
}

// ============= Core Functions =============

/**
 * Build cumulative timeline bounds from an ordered list of clip durations.
 */
export function buildClipBounds(
  clips: Array<{ momentId: string; durationMs: number }>,
): ClipBound[] {
  const bounds: ClipBound[] = [];
  let cum = 0;
  for (let i = 0; i < clips.length; i++) {
    const dur = clips[i].durationMs;
    bounds.push({
      index: i,
      momentId: clips[i].momentId,
      startMs: cum,
      endMs: cum + dur,
      durMs: dur,
    });
    cum += dur;
  }
  return bounds;
}

/**
 * Recompute a manifest from an updated list of clips.
 * Recalculates totalDurationMs and per-clip order.
 */
export function recomputeManifest(
  base: ReelManifest,
  clips: ManifestClip[],
): ReelManifest {
  const ordered = clips.map((c, i) => ({ ...c, order: i }));
  const totalDurationMs = ordered.reduce((sum, c) => sum + c.durationMs, 0);
  return {
    ...base,
    clips: ordered,
    totalDurationMs,
  };
}

/**
 * Compute effect realignments by comparing old vs new cumulative timelines.
 *
 * For each effect:
 * - Find which old clip it belongs to (by reel-time position)
 * - Map its local offset to the corresponding new clip
 * - If the effect's local offset exceeds the new clip duration → clamp
 * - If the clip was removed entirely → mark as removed
 * - If the effect is past all clips → clamp to reel end
 *
 * Only returns entries for effects that actually changed position.
 */
export function computeEffectRealignments(
  oldBounds: ClipBound[],
  newBounds: ClipBound[],
  effects: EffectEvent[],
): EffectRealignment[] {
  if (effects.length === 0 || oldBounds.length === 0) return [];

  const oldTotal = oldBounds[oldBounds.length - 1]?.endMs ?? 0;
  const newTotal = newBounds.length > 0 ? newBounds[newBounds.length - 1].endMs : 0;

  // Build a moment-id-based mapping from old clips to new clips
  // This handles reordering: we match by momentId, not by index
  const newBoundByMoment = new Map<string, ClipBound>();
  for (const b of newBounds) {
    newBoundByMoment.set(b.momentId, b);
  }

  const realignments: EffectRealignment[] = [];

  for (const effect of effects) {
    const t = effect.start_time_ms;

    // Find which old clip this effect is in
    const oldClip = oldBounds.find((b) => t >= b.startMs && t < b.endMs);

    if (!oldClip) {
      // Effect is past the last clip — clamp to end of new timeline
      if (t >= oldTotal && newTotal > 0) {
        realignments.push({
          effectId: effect.id,
          newStartTimeMs: Math.max(0, newTotal - 1),
          clamped: true,
          removed: false,
        });
      }
      continue;
    }

    // Local offset within the old clip
    const localOffset = t - oldClip.startMs;

    // Find corresponding new clip by momentId
    const newClip = newBoundByMoment.get(oldClip.momentId);

    if (!newClip) {
      // Clip was deleted — mark effect for removal
      realignments.push({
        effectId: effect.id,
        newStartTimeMs: 0,
        clamped: false,
        removed: true,
      });
      continue;
    }

    if (localOffset >= newClip.durMs) {
      // Effect falls in trimmed-away tail — clamp to clip end
      const clampedTime = Math.max(newClip.startMs, newClip.endMs - 1);
      realignments.push({
        effectId: effect.id,
        newStartTimeMs: clampedTime,
        clamped: true,
        removed: false,
      });
    } else {
      // Normal remap: same local offset, new cumulative position
      const newTime = newClip.startMs + localOffset;
      if (newTime !== t) {
        realignments.push({
          effectId: effect.id,
          newStartTimeMs: newTime,
          clamped: false,
          removed: false,
        });
      }
    }
  }

  return realignments;
}

/**
 * Full reflow: recompute manifest + realign effects in one call.
 *
 * @param oldManifest   The manifest before the edit
 * @param newClips      The updated clip list (already trimmed/reordered/filtered)
 * @param effects       Current effect events (reel-time-based)
 * @returns             ReflowResult with new manifest, total duration, and realignments
 */
export function reelReflow(
  oldManifest: ReelManifest,
  newClips: ManifestClip[],
  effects: EffectEvent[],
): ReflowResult {
  // Build old bounds from old manifest
  const oldBounds = buildClipBounds(oldManifest.clips);

  // Build new manifest
  const newManifest = recomputeManifest(oldManifest, newClips);

  // Build new bounds from updated clips
  const newBounds = buildClipBounds(newManifest.clips);

  // Compute realignments
  const realignments = computeEffectRealignments(oldBounds, newBounds, effects);

  return {
    newManifest,
    totalDurationMs: newManifest.totalDurationMs,
    realignments,
  };
}
