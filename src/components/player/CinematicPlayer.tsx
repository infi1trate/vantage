import { useState, useRef, useEffect, useCallback } from "react";
import { Annotation, VoiceNote } from "@/lib/captures";
import { PlaybackFallbackCard } from "./PlaybackFallbackCard";
import { TimelineSelection, SelectionState } from "./TimelineSelection";
import { Button } from "@/components/ui/button";
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
  Minimize,
  SkipBack, 
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface VideoDecodeError {
  type: "decode" | "network" | "src" | "unknown";
  message: string;
  mediaError?: MediaError | null;
}

export interface VideoMetaInfo {
  blobType: string | null;
  blobSize: number | null;
  storedMimeType: string | null;
  videoDuration: number | null;
  videoWidth: number | null;
  videoHeight: number | null;
}

export type { SelectionState };

interface CinematicPlayerProps {
  videoUrl?: string | null;
  duration: number;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onSeek: (time: number) => void;
  annotations: Annotation[];
  voiceNotes: VoiceNote[];
  onMarkerClick?: (time: number) => void;
  videoMeta?: VideoMetaInfo | null;
  onVideoLoaded?: (duration: number) => void;
  onVideoError?: (error: VideoDecodeError) => void;
  onDownloadRequest?: () => void;
  selection?: SelectionState;
  onSelectionChange?: (selection: SelectionState) => void;
}

export function CinematicPlayer({
  videoUrl,
  duration,
  currentTime,
  onTimeUpdate,
  onSeek,
  annotations,
  voiceNotes,
  onMarkerClick,
  videoMeta,
  onVideoLoaded,
  onVideoError,
  onDownloadRequest,
  selection = { type: null },
  onSelectionChange,
}: CinematicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoDecodeError, setVideoDecodeError] = useState<VideoDecodeError | null>(null);
  const [internalSelection, setInternalSelection] = useState<SelectionState>({ type: null });
  const [isDragging, setIsDragging] = useState(false);
  
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playbackRef = useRef<NodeJS.Timeout | null>(null);

  // Use controlled or internal selection state
  const activeSelection = onSelectionChange ? selection : internalSelection;
  const handleSelectionChange = onSelectionChange || setInternalSelection;

  // Reset video state when URL changes
  useEffect(() => {
    setVideoReady(false);
    setVideoDecodeError(null);
  }, [videoUrl]);

  // Simulated playback for demo
  useEffect(() => {
    if (isPlaying && !videoUrl) {
      playbackRef.current = setInterval(() => {
        onTimeUpdate(Math.min(currentTime + 0.1, duration));
      }, 100);
    }
    return () => {
      if (playbackRef.current) clearInterval(playbackRef.current);
    };
  }, [isPlaying, videoUrl, currentTime, duration, onTimeUpdate]);

  // Stop at end
  useEffect(() => {
    if (currentTime >= duration) setIsPlaying(false);
  }, [currentTime, duration]);

  // Fullscreen handler
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleVideoLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    setVideoReady(true);
    setVideoDecodeError(null);
    onVideoLoaded?.(e.currentTarget.duration);
  }, [onVideoLoaded]);

  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const mediaError = e.currentTarget.error;
    let errorType: VideoDecodeError["type"] = "unknown";
    let message = "An error occurred.";
    
    if (mediaError) {
      switch (mediaError.code) {
        case MediaError.MEDIA_ERR_DECODE:
          errorType = "decode";
          message = "This recording can't be played in this browser.";
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorType = "src";
          message = "Video format not supported.";
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorType = "network";
          message = "Network error.";
          break;
      }
    }

    const error: VideoDecodeError = { type: errorType, message, mediaError };
    setVideoDecodeError(error);
    setVideoReady(false);
    onVideoError?.(error);
  }, [onVideoError]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
    if (videoRef.current) {
      isPlaying ? videoRef.current.pause() : videoRef.current.play();
    }
  }, [isPlaying]);

  const handleSkip = useCallback((seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    onSeek(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
  }, [currentTime, duration, onSeek]);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
    if (videoRef.current) videoRef.current.muted = !isMuted;
  }, [isMuted]);

  const handleFullscreen = useCallback(() => {
    if (containerRef.current) {
      document.fullscreenElement ? document.exitFullscreen() : containerRef.current.requestFullscreen();
    }
  }, []);

  // Timeline interaction
  // Build markers for timeline
  const timelineMarkers = [
    ...annotations.map(a => ({
      id: a.id,
      time: a.timestamp_seconds,
      color: getMarkerColor(a.annotation_type),
    })),
    ...voiceNotes.map(v => ({
      id: v.id,
      time: v.timestamp_seconds,
      color: "bg-accent",
    })),
  ];

  // Keyboard shortcuts (playback only - timeline handles I/O/arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.code) {
        case "Space":
        case "KeyK":
          e.preventDefault();
          handlePlayPause();
          break;
        case "KeyM":
          e.preventDefault();
          toggleMute();
          break;
        case "KeyF":
          e.preventDefault();
          handleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlayPause, toggleMute, handleFullscreen]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercentage = (currentTime / duration) * 100;

  const getMarkerColor = (type: Annotation["annotation_type"]) => {
    switch (type) {
      case "kill": return "bg-vantage-success";
      case "death": return "bg-destructive";
      case "highlight": return "bg-vantage-warning";
      default: return "bg-primary";
    }
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative flex flex-col h-full",
        isFullscreen && "fixed inset-0 z-50 bg-background"
      )}
    >
      {/* Video area with cinematic backdrop */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {/* Cinematic gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-muted/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_70%)]" />
        
        {/* Video decode error */}
        {videoDecodeError && videoUrl && (
          <PlaybackFallbackCard
            error={videoDecodeError}
            videoMeta={videoMeta}
            sessionDuration={duration}
            onDownload={onDownloadRequest}
          />
        )}

        {/* Video */}
        {videoUrl && !videoDecodeError ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="relative z-10 max-w-full max-h-full rounded-lg shadow-2xl"
            controls={false}
            playsInline
            preload="metadata"
            onLoadedMetadata={handleVideoLoadedMetadata}
            onError={handleVideoError}
            onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
          />
        ) : !videoUrl ? (
          <div className="relative z-10 w-full max-w-2xl aspect-video flex items-center justify-center bg-muted/30 rounded-lg border border-border/20">
            <div className="text-center opacity-50">
              <Play className="h-16 w-16 mx-auto mb-2" />
              <p className="text-sm">No video</p>
            </div>
          </div>
        ) : null}

        {/* Center play button overlay */}
        <button 
          onClick={handlePlayPause}
          className={cn(
            "absolute z-20 p-5 rounded-full bg-primary/80 backdrop-blur-sm transition-all duration-200",
            isPlaying ? "opacity-0 scale-90 pointer-events-none" : "opacity-100 scale-100 hover:scale-105 hover:bg-primary"
          )}
        >
          <Play className="h-10 w-10 text-primary-foreground" fill="currentColor" />
        </button>
      </div>

      {/* Timeline section - prominent */}
      <div className="shrink-0 bg-card/80 backdrop-blur-sm border-t border-border/30">
        {/* Mini controls row */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSkip(-5)}>
                  <SkipBack className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">-5s</TooltipContent>
            </Tooltip>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePlayPause}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSkip(5)}>
                  <SkipForward className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">+5s</TooltipContent>
            </Tooltip>

            <span className="ml-3 text-xs font-mono text-muted-foreground tabular-nums">
              {formatTime(currentTime)} <span className="opacity-50">/</span> {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleMute}>
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleFullscreen}>
              {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Main timeline with selection support */}
        <div className="mx-4 my-3">
          <TimelineSelection
            duration={duration}
            currentTime={currentTime}
            onSeek={(time) => {
              onSeek(time);
              if (videoRef.current) videoRef.current.currentTime = time;
            }}
            selection={activeSelection}
            onSelectionChange={handleSelectionChange}
            markers={timelineMarkers}
            onMarkerClick={(id, time) => onMarkerClick?.(time)}
          />
        </div>
      </div>
    </div>
  );
}
