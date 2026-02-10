import { describe, it, expect } from "vitest";
import {
  buildClipBounds,
  computeEffectRealignments,
  recomputeManifest,
  reelReflow,
} from "@/lib/reelReflow";
import type { ManifestClip, ReelManifest } from "@/lib/reels";
import type { EffectEvent } from "@/lib/effectEvents";

function makeClip(momentId: string, startMs: number, endMs: number, order: number): ManifestClip {
  return { momentId, startMs, endMs, durationMs: endMs - startMs, order };
}

function makeEffect(id: string, startTimeMs: number): EffectEvent {
  return {
    id,
    user_id: "u1",
    session_id: "s1",
    type: "vfx",
    key: "screenShake",
    start_time_ms: startTimeMs,
    duration_ms: 300,
    intensity: "med",
    volume: null,
    params: {},
    apply_scope: "session",
    clip_id: null,
    reel_id: null,
    snap_source: "manual",
    snapped_to_id: null,
    is_enabled: true,
    created_at: "",
    updated_at: "",
  };
}

describe("buildClipBounds", () => {
  it("builds cumulative boundaries", () => {
    const bounds = buildClipBounds([
      { momentId: "a", durationMs: 3000 },
      { momentId: "b", durationMs: 5000 },
      { momentId: "c", durationMs: 2000 },
    ]);
    expect(bounds).toEqual([
      { index: 0, momentId: "a", startMs: 0, endMs: 3000, durMs: 3000 },
      { index: 1, momentId: "b", startMs: 3000, endMs: 8000, durMs: 5000 },
      { index: 2, momentId: "c", startMs: 8000, endMs: 10000, durMs: 2000 },
    ]);
  });
});

describe("computeEffectRealignments", () => {
  it("shifts effects after a shortened clip", () => {
    const oldBounds = buildClipBounds([
      { momentId: "a", durationMs: 5000 },
      { momentId: "b", durationMs: 5000 },
    ]);
    // Clip A shortened from 5000 to 3000
    const newBounds = buildClipBounds([
      { momentId: "a", durationMs: 3000 },
      { momentId: "b", durationMs: 5000 },
    ]);

    const effects = [
      makeEffect("e1", 2000), // In clip A at offset 2000 — no change
      makeEffect("e2", 6000), // In clip B at offset 1000 — should shift from 6000 to 4000
    ];

    const result = computeEffectRealignments(oldBounds, newBounds, effects);
    // e1 stays the same (offset 2000 < new dur 3000)
    // e2 shifts: old clip B start=5000, offset=1000. new clip B start=3000, so 3000+1000=4000
    expect(result).toEqual([
      { effectId: "e2", newStartTimeMs: 4000, clamped: false, removed: false },
    ]);
  });

  it("clamps effects in trimmed-away region", () => {
    const oldBounds = buildClipBounds([
      { momentId: "a", durationMs: 5000 },
    ]);
    const newBounds = buildClipBounds([
      { momentId: "a", durationMs: 2000 },
    ]);

    const effects = [makeEffect("e1", 4000)]; // offset 4000 > new dur 2000

    const result = computeEffectRealignments(oldBounds, newBounds, effects);
    expect(result).toEqual([
      { effectId: "e1", newStartTimeMs: 1999, clamped: true, removed: false },
    ]);
  });

  it("removes effects when clip is deleted", () => {
    const oldBounds = buildClipBounds([
      { momentId: "a", durationMs: 3000 },
      { momentId: "b", durationMs: 3000 },
    ]);
    // Clip B removed
    const newBounds = buildClipBounds([
      { momentId: "a", durationMs: 3000 },
    ]);

    const effects = [makeEffect("e1", 4000)]; // In old clip B

    const result = computeEffectRealignments(oldBounds, newBounds, effects);
    expect(result).toEqual([
      { effectId: "e1", newStartTimeMs: 0, clamped: false, removed: true },
    ]);
  });

  it("handles reordering by matching momentId", () => {
    const oldBounds = buildClipBounds([
      { momentId: "a", durationMs: 3000 },
      { momentId: "b", durationMs: 3000 },
    ]);
    // Reordered: B then A
    const newBounds = buildClipBounds([
      { momentId: "b", durationMs: 3000 },
      { momentId: "a", durationMs: 3000 },
    ]);

    const effects = [
      makeEffect("e1", 1000), // In clip A at offset 1000 → now clip A starts at 3000, so 4000
      makeEffect("e2", 4000), // In clip B at offset 1000 → now clip B starts at 0, so 1000
    ];

    const result = computeEffectRealignments(oldBounds, newBounds, effects);
    expect(result).toContainEqual({
      effectId: "e1",
      newStartTimeMs: 4000,
      clamped: false,
      removed: false,
    });
    expect(result).toContainEqual({
      effectId: "e2",
      newStartTimeMs: 1000,
      clamped: false,
      removed: false,
    });
  });
});

describe("reelReflow", () => {
  it("returns updated manifest and realignments together", () => {
    const oldManifest: ReelManifest = {
      clips: [
        makeClip("a", 0, 5000, 0),
        makeClip("b", 5000, 10000, 1),
      ],
      totalDurationMs: 10000,
      aspectRatio: "16:9",
      createdAt: "",
    };

    // Clip A shortened to 3000ms
    const newClips = [
      makeClip("a", 0, 3000, 0),
      makeClip("b", 5000, 10000, 1),
    ];

    const effects = [makeEffect("e1", 7000)]; // In clip B at offset 2000

    const result = reelReflow(oldManifest, newClips, effects);

    expect(result.totalDurationMs).toBe(8000); // 3000 + 5000
    expect(result.newManifest.clips).toHaveLength(2);
    expect(result.realignments).toEqual([
      { effectId: "e1", newStartTimeMs: 5000, clamped: false, removed: false },
    ]);
  });
});
