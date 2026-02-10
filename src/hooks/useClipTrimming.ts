/**
 * useClipTrimming Hook
 * 
 * Manages trim state for reel clips. Each clip can be trimmed (shortened)
 * or extended (up to ±10s beyond the original moment, clamped to source bounds).
 * 
 * Persists trims to the reel manifest via Supabase.
 * Shifts effects when clips change duration to maintain reel-relative alignment.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { ManifestClip, ReelManifest } from "@/lib/reels";
import { Annotation } from "@/lib/captures";
import { supabase } from "@/integrations/supabase/client";
import { EffectEvent } from "@/lib/effectEvents";
import { toast } from "sonner";
import {
  reelReflow,
  recomputeManifest,
  buildClipBounds,
  computeEffectRealignments,
  type EffectRealignment,
} from "@/lib/reelReflow";

// Re-export for consumers
export type { EffectRealignment } from "@/lib/reelReflow";

/** Minimum clip length in ms */
const MIN_CLIP_MS = 1500;
/** Maximum extension beyond the original moment bounds, in ms */
const MAX_EXTENSION_MS = 10_000;

export interface TrimmedClip extends ManifestClip {
  /** Trim offset from the original startMs (positive = trimmed inward) */
  trimInMs: number;
  /** Trim offset from the original endMs (negative = trimmed inward) */
  trimOutMs: number;
  /** Effective start in source video (ms) after trim */
  effectiveStartMs: number;
  /** Effective end in source video (ms) after trim */
  effectiveEndMs: number;
  /** Effective duration after trim (ms) */
  effectiveDurationMs: number;
  /** Max extendable start (source-clamped, ms) */
  minSourceMs: number;
  /** Max extendable end (source-clamped, ms) */
  maxSourceMs: number;
}

interface UseClipTrimmingOptions {
  reelId: string | undefined;
  manifest: ReelManifest | null;
  annotations: Annotation[];
  sessionDurationSec: number;
  effects: EffectEvent[];
  onEffectsRealign?: (realignments: EffectRealignment[]) => void;
  /** Push to unified editor history on trim commit */
  onHistoryPush?: (command: import("@/hooks/useReelEditorHistory").EditCommand) => void;
}

/**
 * Build trimmed clips with effective bounds from manifest + annotations
 */
function buildTrimmedClips(
  clips: ManifestClip[],
  annotations: Annotation[],
  sessionDurationMs: number,
): TrimmedClip[] {
  return clips.map((clip) => {
    const annotation = annotations.find(a => a.id === clip.momentId);
    const origStartMs = clip.startMs;
    const origEndMs = clip.endMs;

    // Source bounds: allow extending ±MAX_EXTENSION_MS, clamped to [0, sessionDuration]
    const minSourceMs = Math.max(0, origStartMs - MAX_EXTENSION_MS);
    const maxSourceMs = Math.min(sessionDurationMs, origEndMs + MAX_EXTENSION_MS);

    const trimInMs = (clip as any).trimInMs ?? 0;
    const trimOutMs = (clip as any).trimOutMs ?? 0;

    const effectiveStartMs = origStartMs + trimInMs;
    const effectiveEndMs = origEndMs + trimOutMs;
    const effectiveDurationMs = effectiveEndMs - effectiveStartMs;

    return {
      ...clip,
      trimInMs,
      trimOutMs,
      effectiveStartMs,
      effectiveEndMs,
      effectiveDurationMs,
      minSourceMs,
      maxSourceMs,
    };
  });
}

// recomputeManifest is now imported from @/lib/reelReflow
// The local version below has been replaced by the shared utility.

/**
 * Recompute manifest from trimmed clips (delegates to shared utility,
 * but maps TrimmedClip -> ManifestClip with effective values first).
 */
function recomputeManifestFromTrimmed(
  manifest: ReelManifest,
  trimmedClips: TrimmedClip[],
): ReelManifest {
  const newClips: ManifestClip[] = trimmedClips.map((tc, i) => ({
    momentId: tc.momentId,
    startMs: tc.effectiveStartMs,
    endMs: tc.effectiveEndMs,
    durationMs: tc.effectiveDurationMs,
    order: i,
    trimInMs: tc.trimInMs,
    trimOutMs: tc.trimOutMs,
  } as ManifestClip));

  return recomputeManifest(manifest, newClips);
}

export function useClipTrimming({
  reelId,
  manifest,
  annotations,
  sessionDurationSec,
  effects,
  onEffectsRealign,
  onHistoryPush,
}: UseClipTrimmingOptions) {
  const sessionDurationMs = sessionDurationSec * 1000;
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Snapshot of trimmedClips before the current drag, used for effect realignment */
  const preEditClipsRef = useRef<TrimmedClip[] | null>(null);
  /** Snapshot of localTrims before the current drag, used for undo */
  const preEditTrimsRef = useRef<Record<number, { trimInMs: number; trimOutMs: number }> | null>(null);

  // Local trim overrides: clipIndex → { trimInMs, trimOutMs }
  const [localTrims, setLocalTrims] = useState<
    Record<number, { trimInMs: number; trimOutMs: number }>
  >({});

  // Build trimmed clips combining manifest data + local overrides
  const trimmedClips = useMemo(() => {
    if (!manifest) return [];

    const base = buildTrimmedClips(manifest.clips, annotations, sessionDurationMs);

    // Apply local overrides
    return base.map((clip, i) => {
      const override = localTrims[i];
      if (!override) return clip;

      const origStartMs = manifest.clips[i].startMs;
      const origEndMs = manifest.clips[i].endMs;

      const effectiveStartMs = origStartMs + override.trimInMs;
      const effectiveEndMs = origEndMs + override.trimOutMs;
      const effectiveDurationMs = effectiveEndMs - effectiveStartMs;

      return {
        ...clip,
        trimInMs: override.trimInMs,
        trimOutMs: override.trimOutMs,
        effectiveStartMs,
        effectiveEndMs,
        effectiveDurationMs,
      };
    });
  }, [manifest, annotations, sessionDurationMs, localTrims]);

  // Total reel duration after trims
  const trimmedTotalDurationMs = useMemo(
    () => trimmedClips.reduce((sum, c) => sum + c.effectiveDurationMs, 0),
    [trimmedClips],
  );

  /**
   * Set trim for a specific clip edge to an absolute value
   * @param clipIndex Index of the clip in the manifest
   * @param edge "in" for start handle, "out" for end handle
   * @param trimMs Absolute trim value (positive = inward for "in", outward for "out")
   */
  const applyTrim = useCallback(
    (clipIndex: number, edge: "in" | "out", trimMs: number) => {
      if (!manifest || !manifest.clips[clipIndex]) return;

      // Snapshot pre-edit state on first applyTrim of a drag gesture
      if (!preEditClipsRef.current) {
        preEditClipsRef.current = [...trimmedClips];
        preEditTrimsRef.current = { ...localTrims };
      }

      const clip = manifest.clips[clipIndex];
      const prev = localTrims[clipIndex] || { trimInMs: 0, trimOutMs: 0 };

      let newTrimIn = edge === "in" ? trimMs : prev.trimInMs;
      let newTrimOut = edge === "out" ? trimMs : prev.trimOutMs;

      // Compute effective values
      const origStartMs = clip.startMs;
      const origEndMs = clip.endMs;
      const minSourceMs = Math.max(0, origStartMs - MAX_EXTENSION_MS);
      const maxSourceMs = Math.min(sessionDurationMs, origEndMs + MAX_EXTENSION_MS);

      let effectiveStart = origStartMs + newTrimIn;
      let effectiveEnd = origEndMs + newTrimOut;

      // Clamp to source bounds
      effectiveStart = Math.max(minSourceMs, effectiveStart);
      effectiveEnd = Math.min(maxSourceMs, effectiveEnd);

      // Enforce minimum duration
      if (effectiveEnd - effectiveStart < MIN_CLIP_MS) {
        if (edge === "in") {
          effectiveStart = effectiveEnd - MIN_CLIP_MS;
        } else {
          effectiveEnd = effectiveStart + MIN_CLIP_MS;
        }
      }

      // Recompute trims from clamped values
      newTrimIn = effectiveStart - origStartMs;
      newTrimOut = effectiveEnd - origEndMs;

      setLocalTrims((prev) => ({
        ...prev,
        [clipIndex]: { trimInMs: newTrimIn, trimOutMs: newTrimOut },
      }));
    },
    [manifest, localTrims, sessionDurationMs, trimmedClips],
  );

  /**
   * Set absolute trim values for a clip
   */
  const setClipTrim = useCallback(
    (clipIndex: number, trimInMs: number, trimOutMs: number) => {
      if (!manifest || !manifest.clips[clipIndex]) return;

      const clip = manifest.clips[clipIndex];
      const origStartMs = clip.startMs;
      const origEndMs = clip.endMs;
      const minSourceMs = Math.max(0, origStartMs - MAX_EXTENSION_MS);
      const maxSourceMs = Math.min(sessionDurationMs, origEndMs + MAX_EXTENSION_MS);

      let effectiveStart = origStartMs + trimInMs;
      let effectiveEnd = origEndMs + trimOutMs;

      // Clamp
      effectiveStart = Math.max(minSourceMs, effectiveStart);
      effectiveEnd = Math.min(maxSourceMs, effectiveEnd);

      if (effectiveEnd - effectiveStart < MIN_CLIP_MS) {
        effectiveEnd = effectiveStart + MIN_CLIP_MS;
      }

      setLocalTrims((prev) => ({
        ...prev,
        [clipIndex]: {
          trimInMs: effectiveStart - origStartMs,
          trimOutMs: effectiveEnd - origEndMs,
        },
      }));
    },
    [manifest, sessionDurationMs],
  );

  /**
   * Reset a clip's trim to original bounds
   */
  const resetClipTrim = useCallback((clipIndex: number) => {
    setLocalTrims((prev) => {
      const next = { ...prev };
      delete next[clipIndex];
      return next;
    });
  }, []);

  /**
   * Persist current trims to the reel manifest (debounced)
   * Uses shared reelReflow utility for effect realignment.
   */
  const persistTrims = useCallback(async () => {
    if (!reelId || !manifest) return;

    // Clear pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Compute effect realignments using shared utility
    const oldClips = preEditClipsRef.current;
    if (oldClips && onEffectsRealign) {
      const oldBounds = buildClipBounds(
        oldClips.map((c) => ({ momentId: c.momentId, durationMs: c.effectiveDurationMs })),
      );
      const newBounds = buildClipBounds(
        trimmedClips.map((c) => ({ momentId: c.momentId, durationMs: c.effectiveDurationMs })),
      );
      const realignments = computeEffectRealignments(oldBounds, newBounds, effects);
      if (realignments.length > 0) {
        const clampedCount = realignments.filter((r) => r.clamped && !r.removed).length;
        onEffectsRealign(realignments);
        if (clampedCount > 0) {
          toast.info(
            `${clampedCount} effect${clampedCount > 1 ? "s" : ""} clamped to clip boundary`,
            { duration: 3000 },
          );
        }
      }
    }

    // Push to unified history (one entry per completed drag)
    const prevTrims = preEditTrimsRef.current;
    const afterTrims = { ...localTrims };
    if (onHistoryPush && prevTrims) {
      onHistoryPush({
        type: "trim_change",
        label: "Trim clip",
        undo: () => setLocalTrims(prevTrims),
        redo: () => setLocalTrims(afterTrims),
      });
    }

    // Clear pre-edit snapshots
    preEditClipsRef.current = null;
    preEditTrimsRef.current = null;

    const newManifest = recomputeManifestFromTrimmed(manifest, trimmedClips);

    const { error } = await supabase
      .from("reels")
      .update({
        manifest: newManifest as any,
        total_duration_ms: newManifest.totalDurationMs,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reelId);

    if (error) {
      console.error("[ClipTrimming] Failed to persist trims:", error);
    } else {
      console.log("[ClipTrimming] Trims persisted to manifest");
    }
  }, [reelId, manifest, trimmedClips, effects, onEffectsRealign]);

  /**
   * Debounced persist — call after drag ends
   */
  const debouncedPersist = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(persistTrims, 500);
  }, [persistTrims]);

  /**
   * Check if any clip has been trimmed
   */
  const hasTrimChanges = Object.keys(localTrims).length > 0;

  /**
   * Get the updated manifest with trims applied
   */
  const trimmedManifest = useMemo(() => {
    if (!manifest) return null;
    return recomputeManifestFromTrimmed(manifest, trimmedClips);
  }, [manifest, trimmedClips]);

  return {
    trimmedClips,
    trimmedManifest,
    trimmedTotalDurationMs,
    hasTrimChanges,
    applyTrim,
    setClipTrim,
    resetClipTrim,
    persistTrims: debouncedPersist,
  };
}
