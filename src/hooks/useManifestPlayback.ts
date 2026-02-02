/**
 * Manifest Playback Hook
 * 
 * Manages playback state for manifest-based reels where we play
 * underlying clip segments in sequence instead of a stitched preview.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ReelManifest, ManifestClip } from "@/lib/reels";

interface ClipPlaybackState {
  clipIndex: number;
  clipId: string;
  clipLocalTime: number; // Time within current clip (0 to clip duration)
  clipDuration: number;
}

interface ManifestPlaybackState {
  isPlaying: boolean;
  globalTime: number; // Virtual timeline position across all clips
  totalDuration: number;
  currentClip: ClipPlaybackState | null;
  clips: ManifestClip[];
}

interface UseManifestPlaybackOptions {
  manifest: ReelManifest | null;
  clipVideoUrls: Record<string, string>; // momentId -> videoUrl
  onClipChange?: (clipIndex: number, clip: ManifestClip) => void;
}

interface UseManifestPlaybackReturn {
  state: ManifestPlaybackState;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (globalTimeMs: number) => void;
  seekToClip: (clipIndex: number, localTimeMs?: number) => void;
  getCurrentClipUrl: () => string | null;
  getClipForGlobalTime: (globalTimeMs: number) => { clip: ManifestClip; localTimeMs: number; index: number } | null;
}

/**
 * Build cumulative timeline from manifest clips
 * Each clip gets a globalStartMs and globalEndMs
 */
function buildCumulativeTimeline(clips: ManifestClip[]) {
  let cumulativeMs = 0;
  return clips.map((clip, index) => {
    const globalStartMs = cumulativeMs;
    const globalEndMs = cumulativeMs + clip.durationMs;
    cumulativeMs = globalEndMs;
    return {
      ...clip,
      index,
      globalStartMs,
      globalEndMs,
    };
  });
}

export function useManifestPlayback({
  manifest,
  clipVideoUrls,
  onClipChange,
}: UseManifestPlaybackOptions): UseManifestPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [globalTime, setGlobalTime] = useState(0);
  
  // Build cumulative timeline
  const cumulativeClips = useMemo(() => {
    if (!manifest?.clips) return [];
    return buildCumulativeTimeline(manifest.clips);
  }, [manifest?.clips]);
  
  const totalDuration = manifest?.totalDurationMs || 0;
  
  // Find current clip based on global time
  const getCurrentClipState = useCallback((globalTimeMs: number): ClipPlaybackState | null => {
    if (!cumulativeClips.length) return null;
    
    // Find the clip that contains this global time
    const clipData = cumulativeClips.find(
      c => globalTimeMs >= c.globalStartMs && globalTimeMs < c.globalEndMs
    );
    
    if (!clipData) {
      // If past the end, return last clip at its end
      if (globalTimeMs >= totalDuration && cumulativeClips.length > 0) {
        const lastClip = cumulativeClips[cumulativeClips.length - 1];
        return {
          clipIndex: lastClip.index,
          clipId: lastClip.momentId,
          clipLocalTime: lastClip.durationMs,
          clipDuration: lastClip.durationMs,
        };
      }
      return null;
    }
    
    return {
      clipIndex: clipData.index,
      clipId: clipData.momentId,
      clipLocalTime: globalTimeMs - clipData.globalStartMs,
      clipDuration: clipData.durationMs,
    };
  }, [cumulativeClips, totalDuration]);
  
  const currentClip = getCurrentClipState(globalTime);
  
  // Track clip changes
  const lastClipIndexRef = useRef<number>(-1);
  useEffect(() => {
    if (currentClip && currentClip.clipIndex !== lastClipIndexRef.current) {
      lastClipIndexRef.current = currentClip.clipIndex;
      const clip = manifest?.clips[currentClip.clipIndex];
      if (clip && onClipChange) {
        onClipChange(currentClip.clipIndex, clip);
      }
    }
  }, [currentClip?.clipIndex, manifest?.clips, onClipChange]);
  
  // Playback controls
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(() => setIsPlaying(p => !p), []);
  
  const seek = useCallback((globalTimeMs: number) => {
    const clampedTime = Math.max(0, Math.min(globalTimeMs, totalDuration));
    setGlobalTime(clampedTime);
  }, [totalDuration]);
  
  const seekToClip = useCallback((clipIndex: number, localTimeMs: number = 0) => {
    const clipData = cumulativeClips[clipIndex];
    if (clipData) {
      const newGlobalTime = clipData.globalStartMs + Math.min(localTimeMs, clipData.durationMs);
      setGlobalTime(newGlobalTime);
    }
  }, [cumulativeClips]);
  
  const getCurrentClipUrl = useCallback(() => {
    if (!currentClip) return null;
    return clipVideoUrls[currentClip.clipId] || null;
  }, [currentClip, clipVideoUrls]);
  
  const getClipForGlobalTime = useCallback((globalTimeMs: number) => {
    const clipData = cumulativeClips.find(
      c => globalTimeMs >= c.globalStartMs && globalTimeMs < c.globalEndMs
    );
    
    if (!clipData) return null;
    
    return {
      clip: manifest!.clips[clipData.index],
      localTimeMs: globalTimeMs - clipData.globalStartMs,
      index: clipData.index,
    };
  }, [cumulativeClips, manifest]);
  
  // Stop at end
  useEffect(() => {
    if (globalTime >= totalDuration && isPlaying) {
      setIsPlaying(false);
    }
  }, [globalTime, totalDuration, isPlaying]);
  
  return {
    state: {
      isPlaying,
      globalTime,
      totalDuration,
      currentClip,
      clips: manifest?.clips || [],
    },
    play,
    pause,
    togglePlay,
    seek,
    seekToClip,
    getCurrentClipUrl,
    getClipForGlobalTime,
  };
}
