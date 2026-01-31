/**
 * Optimized Video Playback Hook
 * 
 * Provides efficient video playback with:
 * - Stable video element reference (no re-mounting on minor state changes)
 * - RAF-throttled time updates (no re-render every frame)
 * - Efficient seeking with immediate UI feedback
 * - Preloaded metadata for fast startup
 */

import { useRef, useCallback, useEffect, useState } from "react";
import { recordMetric, startTiming, endTiming } from "@/lib/performanceMetrics";

export interface VideoPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isReady: boolean;
  isSeeking: boolean;
  volume: number;
  isMuted: boolean;
}

export interface VideoPlaybackActions {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  skip: (seconds: number) => void;
}

interface UseVideoPlaybackOptions {
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onEnded?: () => void;
  onError?: (error: MediaError | null) => void;
  onReady?: () => void;
  /** Throttle time updates (ms). Default: 16 (~60fps) */
  updateInterval?: number;
}

export function useVideoPlayback(
  videoRef: React.RefObject<HTMLVideoElement>,
  options: UseVideoPlaybackOptions = {}
): [VideoPlaybackState, VideoPlaybackActions] {
  const {
    onTimeUpdate,
    onDurationChange,
    onEnded,
    onError,
    onReady,
    updateInterval = 16,
  } = options;

  // Core state - minimal React state to avoid re-renders
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMutedState] = useState(false);
  
  // Use ref for currentTime to avoid re-renders on every frame
  // Only update state when needed for UI
  const currentTimeRef = useRef(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  // RAF throttling refs
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);
  const isPlayingRef = useRef(false);
  
  // Callback refs to avoid stale closures
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onDurationChangeRef = useRef(onDurationChange);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onDurationChangeRef.current = onDurationChange;
    onEndedRef.current = onEnded;
    onErrorRef.current = onError;
    onReadyRef.current = onReady;
  }, [onTimeUpdate, onDurationChange, onEnded, onError, onReady]);

  // RAF-based time update loop - more efficient than timeupdate event
  const startTimeUpdateLoop = useCallback(() => {
    const updateTime = (timestamp: number) => {
      const video = videoRef.current;
      if (!video || !isPlayingRef.current) {
        rafIdRef.current = null;
        return;
      }
      
      // Throttle updates
      if (timestamp - lastUpdateRef.current >= updateInterval) {
        const newTime = video.currentTime;
        
        // Only update if time actually changed
        if (Math.abs(newTime - currentTimeRef.current) > 0.01) {
          currentTimeRef.current = newTime;
          
          // Update state less frequently for UI (every ~100ms is enough)
          if (timestamp - lastUpdateRef.current >= 100) {
            setCurrentTime(newTime);
          }
          
          // Notify callback on every throttled update
          onTimeUpdateRef.current?.(newTime);
        }
        
        lastUpdateRef.current = timestamp;
      }
      
      rafIdRef.current = requestAnimationFrame(updateTime);
    };
    
    rafIdRef.current = requestAnimationFrame(updateTime);
  }, [videoRef, updateInterval]);
  
  const stopTimeUpdateLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setIsReady(true);
      setDuration(video.duration);
      onDurationChangeRef.current?.(video.duration);
      onReadyRef.current?.();
      
      // Record startup time
      recordMetric("playback:metadata", 0, { duration: video.duration });
    };

    const handleCanPlay = () => {
      // First frame is ready
      recordMetric("playback:first-frame", 0, { readyState: video.readyState });
    };

    const handlePlay = () => {
      setIsPlaying(true);
      isPlayingRef.current = true;
      startTimeUpdateLoop();
    };

    const handlePause = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
      stopTimeUpdateLoop();
      
      // Final time sync
      currentTimeRef.current = video.currentTime;
      setCurrentTime(video.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
      stopTimeUpdateLoop();
      onEndedRef.current?.();
    };

    const handleSeeking = () => {
      setIsSeeking(true);
    };

    const handleSeeked = () => {
      setIsSeeking(false);
      currentTimeRef.current = video.currentTime;
      setCurrentTime(video.currentTime);
      onTimeUpdateRef.current?.(video.currentTime);
    };

    const handleError = () => {
      onErrorRef.current?.(video.error);
    };

    const handleVolumeChange = () => {
      setVolumeState(video.volume);
      setIsMutedState(video.muted);
    };

    // Attach listeners
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleError);
    video.addEventListener("volumechange", handleVolumeChange);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
      video.removeEventListener("volumechange", handleVolumeChange);
      stopTimeUpdateLoop();
    };
  }, [videoRef, startTimeUpdateLoop, stopTimeUpdateLoop]);

  // Actions
  const play = useCallback(() => {
    videoRef.current?.play();
  }, [videoRef]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, [videoRef]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
  }, [videoRef]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    const clampedTime = Math.max(0, Math.min(duration, time));
    
    // Update ref immediately for responsive UI
    currentTimeRef.current = clampedTime;
    setCurrentTime(clampedTime);
    
    // Update video element
    video.currentTime = clampedTime;
    
    // Notify callback immediately for UI responsiveness
    onTimeUpdateRef.current?.(clampedTime);
  }, [duration, videoRef]);

  const setVolume = useCallback((vol: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, vol));
  }, [videoRef]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, [videoRef]);

  const skip = useCallback((seconds: number) => {
    seek(currentTimeRef.current + seconds);
  }, [seek]);

  const state: VideoPlaybackState = {
    isPlaying,
    currentTime,
    duration,
    isReady,
    isSeeking,
    volume,
    isMuted,
  };

  const actions: VideoPlaybackActions = {
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    skip,
  };

  return [state, actions];
}

/**
 * Hook for throttled scrub handling
 * Updates UI immediately while batching video seek calls
 */
export function useThrottledSeek(
  onSeek: (time: number) => void,
  throttleMs: number = 16
): (time: number) => void {
  const rafIdRef = useRef<number | null>(null);
  const pendingTimeRef = useRef<number | null>(null);
  const lastSeekRef = useRef<number>(0);
  
  const throttledSeek = useCallback((time: number) => {
    pendingTimeRef.current = time;
    
    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    rafIdRef.current = requestAnimationFrame(() => {
      const now = performance.now();
      
      // Throttle actual seeks
      if (now - lastSeekRef.current >= throttleMs && pendingTimeRef.current !== null) {
        onSeek(pendingTimeRef.current);
        lastSeekRef.current = now;
      }
      
      rafIdRef.current = null;
    });
  }, [onSeek, throttleMs]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);
  
  return throttledSeek;
}
