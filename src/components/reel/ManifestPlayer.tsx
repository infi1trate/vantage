/**
 * Manifest Player
 * 
 * A video player that sequences through clips based on a reel manifest.
 * Used when no stitched preview is available - plays underlying session
 * video at the correct timestamps for each clip.
 */

import { memo, useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { ReelManifest, ManifestClip } from "@/lib/reels";
import { Annotation } from "@/lib/captures";

interface ManifestPlayerProps {
  manifest: ReelManifest;
  sessionVideoUrl: string;
  annotations: Annotation[]; // For getting clip timestamps
  currentTime: number; // Global time in seconds
  onTimeUpdate: (time: number) => void;
  onSeek: (time: number) => void;
  onVideoLoaded?: (duration: number) => void;
  className?: string;
}

/**
 * Build cumulative timeline with global start/end times
 */
function buildCumulativeTimeline(clips: ManifestClip[], annotations: Annotation[]) {
  let cumulativeMs = 0;
  
  return clips.map((clip, index) => {
    // Find the annotation to get actual session timestamps
    const annotation = annotations.find(a => a.id === clip.momentId);
    const sessionStartSec = annotation?.timestamp_seconds || 0;
    const sessionEndSec = annotation?.end_timestamp_seconds || (sessionStartSec + clip.durationMs / 1000);
    
    const globalStartMs = cumulativeMs;
    const globalEndMs = cumulativeMs + clip.durationMs;
    cumulativeMs = globalEndMs;
    
    return {
      ...clip,
      index,
      globalStartMs,
      globalEndMs,
      sessionStartSec,
      sessionEndSec,
    };
  });
}

export const ManifestPlayer = memo(function ManifestPlayer({
  manifest,
  sessionVideoUrl,
  annotations,
  currentTime,
  onTimeUpdate,
  onSeek,
  onVideoLoaded,
  className,
}: ManifestPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Build cumulative timeline
  const cumulativeClips = buildCumulativeTimeline(manifest.clips, annotations);
  const totalDurationSec = manifest.totalDurationMs / 1000;
  
  // Find current clip based on global time
  const getCurrentClipData = useCallback((globalTimeSec: number) => {
    const globalTimeMs = globalTimeSec * 1000;
    
    return cumulativeClips.find(
      c => globalTimeMs >= c.globalStartMs && globalTimeMs < c.globalEndMs
    ) || cumulativeClips[cumulativeClips.length - 1] || null;
  }, [cumulativeClips]);
  
  const currentClipData = getCurrentClipData(currentTime);
  
  // Calculate session time from global time
  const getSessionTime = useCallback((globalTimeSec: number) => {
    const clipData = getCurrentClipData(globalTimeSec);
    if (!clipData) return 0;
    
    const clipLocalMs = (globalTimeSec * 1000) - clipData.globalStartMs;
    const clipProgress = clipLocalMs / clipData.durationMs;
    const clipDurationSec = clipData.sessionEndSec - clipData.sessionStartSec;
    
    return clipData.sessionStartSec + (clipProgress * clipDurationSec);
  }, [getCurrentClipData]);
  
  // Sync video position when current time or clip changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoReady || !currentClipData) return;
    
    const targetSessionTime = getSessionTime(currentTime);
    const currentVideoTime = video.currentTime;
    
    // Only seek if difference is significant (avoid micro-seeks during playback)
    if (Math.abs(currentVideoTime - targetSessionTime) > 0.1) {
      video.currentTime = targetSessionTime;
    }
  }, [currentTime, currentClipData, videoReady, getSessionTime]);
  
  // Playback loop - update global time based on video playback
  useEffect(() => {
    if (!isPlaying || !videoReady || !currentClipData) return;
    
    const video = videoRef.current;
    if (!video) return;
    
    const updateTime = () => {
      if (!video.paused && currentClipData) {
        // Calculate global time from current video position
        const videoCurrentTime = video.currentTime;
        const clipDurationSec = currentClipData.sessionEndSec - currentClipData.sessionStartSec;
        const clipProgress = (videoCurrentTime - currentClipData.sessionStartSec) / clipDurationSec;
        const globalTimeMs = currentClipData.globalStartMs + (clipProgress * currentClipData.durationMs);
        
        // Check if we've reached end of current clip
        if (videoCurrentTime >= currentClipData.sessionEndSec) {
          // Move to next clip
          const nextClip = cumulativeClips[currentClipData.index + 1];
          if (nextClip) {
            video.currentTime = nextClip.sessionStartSec;
            onTimeUpdate(nextClip.globalStartMs / 1000);
          } else {
            // End of reel
            setIsPlaying(false);
            video.pause();
            onTimeUpdate(totalDurationSec);
          }
        } else {
          onTimeUpdate(Math.min(globalTimeMs / 1000, totalDurationSec));
        }
      }
      
      animationRef.current = requestAnimationFrame(updateTime);
    };
    
    animationRef.current = requestAnimationFrame(updateTime);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, videoReady, currentClipData, cumulativeClips, onTimeUpdate, totalDurationSec]);
  
  // Handle play/pause
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video || !videoReady) return;
    
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      // Ensure we're at the right position before playing
      const targetSessionTime = getSessionTime(currentTime);
      video.currentTime = targetSessionTime;
      video.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [isPlaying, videoReady, currentTime, getSessionTime]);
  
  // Handle seeking on timeline
  const handleSeek = useCallback((value: number[]) => {
    const newTimeSec = value[0];
    onSeek(newTimeSec);
    
    // Also update video position immediately
    const video = videoRef.current;
    if (video && videoReady) {
      const targetSessionTime = getSessionTime(newTimeSec);
      video.currentTime = targetSessionTime;
    }
  }, [onSeek, videoReady, getSessionTime]);
  
  // Handle video loaded
  const handleLoadedMetadata = useCallback(() => {
    setVideoReady(true);
    onVideoLoaded?.(totalDurationSec);
  }, [onVideoLoaded, totalDurationSec]);
  
  // Skip controls
  const skipBackward = useCallback(() => {
    onSeek(Math.max(0, currentTime - 5));
  }, [currentTime, onSeek]);
  
  const skipForward = useCallback(() => {
    onSeek(Math.min(totalDurationSec, currentTime + 5));
  }, [currentTime, totalDurationSec, onSeek]);
  
  // Volume controls
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);
  
  // Fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  }, []);
  
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);
  
  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex flex-col bg-black rounded-lg overflow-hidden",
        className
      )}
    >
      {/* Video element - hidden, we show it full */}
      <div className="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          src={sessionVideoUrl}
          className="absolute inset-0 w-full h-full object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          muted={isMuted}
          playsInline
        />
        
        {/* Click to play/pause overlay */}
        <button
          className="absolute inset-0 w-full h-full cursor-pointer bg-transparent"
          onClick={togglePlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
        />
        
        {/* Current clip indicator */}
        {currentClipData && (
          <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 text-xs text-white">
            Clip {currentClipData.index + 1} of {cumulativeClips.length}
          </div>
        )}
        
        {/* Play button overlay when paused */}
        {!isPlaying && videoReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-8">
        {/* Timeline with clip blocks */}
        <div className="mb-3">
          {/* Clip blocks visualization */}
          <div className="flex gap-0.5 mb-1 h-1">
            {cumulativeClips.map((clip, i) => {
              const widthPercent = (clip.durationMs / manifest.totalDurationMs) * 100;
              const isActive = currentClipData?.index === i;
              return (
                <div
                  key={clip.momentId}
                  className={cn(
                    "h-full rounded-sm transition-colors",
                    isActive ? "bg-primary" : "bg-white/30"
                  )}
                  style={{ width: `${widthPercent}%` }}
                />
              );
            })}
          </div>
          
          {/* Seek slider */}
          <Slider
            value={[currentTime]}
            min={0}
            max={totalDurationSec}
            step={0.1}
            onValueChange={handleSeek}
            className="w-full"
          />
        </div>
        
        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={skipBackward}
                  className="text-white hover:bg-white/20"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Skip back 5s</TooltipContent>
            </Tooltip>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlayPause}
              className="text-white hover:bg-white/20"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={skipForward}
                  className="text-white hover:bg-white/20"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Skip forward 5s</TooltipContent>
            </Tooltip>
            
            <span className="text-sm text-white/80 ml-2">
              {formatTime(currentTime)} / {formatTime(totalDurationSec)}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="text-white hover:bg-white/20"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ManifestPlayer;
