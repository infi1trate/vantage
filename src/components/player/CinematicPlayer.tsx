import { useState, useRef, useEffect, useCallback } from "react";
import { VoiceNote } from "@/lib/captures";
import { startTiming, endTiming, recordMetric } from "@/lib/performanceMetrics";
import { PlaybackFallbackCard } from "./PlaybackFallbackCard";
import { useVideoRetry, isPermanentError } from "@/hooks/useVideoRetry";
import { TimelineSelection, SelectionState, ReactionMarker } from "./TimelineSelection";
import { FloatingAnnotationBar } from "./FloatingAnnotationBar";
import { FrameClickHandler } from "./FrameClickHandler";
import { FramePins, FramePin } from "./FramePins";
import { AnnotationSuggestion } from "./SuggestionMarkers";
import { TimelineEmptyState } from "./OnboardingHint";
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
import { Annotation } from "@/lib/captures";

// Hoisted helper function to avoid temporal dead zone
function getMarkerColor(type: Annotation["annotation_type"] | string): string {
  switch (type) {
    case "kill": return "bg-vantage-success";
    case "death": return "bg-destructive";
    case "highlight": return "bg-vantage-warning";
    case "marker": return "bg-primary";
    default: return "bg-muted-foreground"; // Safe fallback for unknown types
  }
}

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
  onCreateMarker?: (type: "kill" | "death" | "highlight" | "marker", time: number, endTime?: number) => void;
  onOpenNote?: (time: number, endTime?: number) => void;
  onOpenVoice?: (time: number) => void;
  onFrameClick?: (x: number, y: number, time: number, endTime?: number) => void;
  framePins?: FramePin[];
  onPinClick?: (pin: FramePin) => void;
  // AI suggestions
  suggestions?: AnnotationSuggestion[];
  onSuggestionAccept?: (suggestion: AnnotationSuggestion) => void;
  onSuggestionDismiss?: (suggestionId: string) => void;
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
  onCreateMarker,
  onOpenNote,
  onOpenVoice,
  onFrameClick,
  framePins = [],
  onPinClick,
  suggestions = [],
  onSuggestionAccept,
  onSuggestionDismiss,
}: CinematicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoDecodeError, setVideoDecodeError] = useState<VideoDecodeError | null>(null);
  const [internalSelection, setInternalSelection] = useState<SelectionState>({ type: null });
  const [isDragging, setIsDragging] = useState(false);

  // Video retry logic for transient errors
  const {
    state: retryState,
    handleError: handleRetryError,
    videoKey,
    forceRetry,
  } = useVideoRetry(videoUrl, {
    maxAttempts: 3,
    baseDelay: 500,
    onRetry: (attempt) => {
      if (import.meta.env.DEV) {
        console.log(`[CinematicPlayer] Retry attempt ${attempt}`);
      }
      setVideoDecodeError(null);
    },
  });
  
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playbackRef = useRef<NodeJS.Timeout | null>(null);

  // Use controlled or internal selection state
  const activeSelection = onSelectionChange ? selection : internalSelection;
  const handleSelectionChange = onSelectionChange || setInternalSelection;

  // Reset video state and start timing when URL changes
  useEffect(() => {
    setVideoReady(false);
    setVideoDecodeError(null);
    
    // Start timing playback startup
    if (videoUrl) {
      startTiming(`playback:${videoUrl.slice(-20)}`);
    }
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
    
    // Record playback startup time
    if (videoUrl) {
      const startupTime = endTiming(`playback:${videoUrl.slice(-20)}`, "playback:startup", {
        duration: e.currentTarget.duration,
      });
      if (import.meta.env.DEV && startupTime > 0) {
        console.log(`[Perf] Playback startup: ${startupTime.toFixed(0)}ms`);
      }
    }
    
    onVideoLoaded?.(e.currentTarget.duration);
  }, [onVideoLoaded, videoUrl]);

  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const mediaError = e.currentTarget.error;
    
    // Try to recover from transient errors
    const isRetrying = handleRetryError(mediaError);
    if (isRetrying) {
      if (import.meta.env.DEV) {
        console.log("[CinematicPlayer] Transient error, retrying...");
      }
      return;
    }
    
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
          message = "Network error. Please check your connection.";
          break;
      }
    }

    const error: VideoDecodeError = { type: errorType, message, mediaError };
    setVideoDecodeError(error);
    setVideoReady(false);
    onVideoError?.(error);
  }, [onVideoError, handleRetryError]);

  const handlePlayPause = useCallback(() => {
    const willPlay = !isPlaying;
    setIsPlaying(willPlay);
    if (videoRef.current) {
      isPlaying ? videoRef.current.pause() : videoRef.current.play();
    }
    // Dismiss toolbar when playback resumes
    if (willPlay) {
      handleSelectionChange({ type: null });
    }
  }, [isPlaying, handleSelectionChange]);

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
  // Build markers for timeline - moments (kill/death/highlight)
  const timelineMarkers = annotations
    .filter(a => ["kill", "death", "highlight"].includes(a.annotation_type))
    .map(a => ({
      id: a.id,
      time: a.timestamp_seconds,
      color: getMarkerColor(a.annotation_type),
    }));

  // Build reaction markers for timeline - non-moment annotations and voice notes
  const reactionMarkers: ReactionMarker[] = [
    // Text/emoji reactions from annotations
    ...annotations
      .filter(a => !["kill", "death", "highlight"].includes(a.annotation_type))
      .map(a => {
        const content = a.title || a.content || "";
        const emojiOnlyPattern = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u;
        const isEmoji = content.length <= 8 && emojiOnlyPattern.test(content);
        
        return {
          id: a.id,
          time: a.timestamp_seconds,
          type: isEmoji ? "emoji" as const : "text" as const,
          content: content || "Note",
        };
      }),
    // Voice notes
    ...voiceNotes.map(v => ({
      id: v.id,
      time: v.timestamp_seconds,
      type: "voice" as const,
      content: v.transcription || "Voice note",
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

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative flex flex-col h-full",
        isFullscreen && "fixed inset-0 z-50 bg-background"
      )}
    >
      {/* Video area with cinematic backdrop - click to dismiss toolbar */}
      <div 
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        onClick={() => {
          // Dismiss toolbar when clicking the video area (not the video itself)
          if (activeSelection.type !== null) {
            handleSelectionChange({ type: null });
          }
        }}
      >
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
            onRetry={forceRetry}
            isRetrying={retryState.isRetrying}
            canRetry={videoDecodeError.type === "network" || videoDecodeError.type === "unknown"}
          />
        )}

        {/* Video with frame click handler - key forces remount on retry */}
        {videoUrl && !videoDecodeError && !retryState.isRetrying ? (
          <FrameClickHandler
            selection={activeSelection}
            currentTime={currentTime}
            onFrameClick={(x, y, time, endTime) => {
              // Stop propagation to prevent dismissing the toolbar
              onFrameClick?.(x, y, time, endTime);
            }}
            className="relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              key={`video-${videoKey}`}
              ref={videoRef}
              src={videoUrl}
              className="max-w-full max-h-full rounded-lg shadow-2xl"
              controls={false}
              playsInline
              preload="metadata"
              onLoadedMetadata={handleVideoLoadedMetadata}
              onError={handleVideoError}
              onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
              onCanPlay={() => {
                // Record first frame ready timing
                if (videoUrl) {
                  recordMetric("playback:first-frame", 0, { 
                    videoUrl: videoUrl.slice(-30),
                    readyState: videoRef.current?.readyState,
                  });
                }
              }}
            />
            
            {/* Frame pins overlay */}
            <FramePins
              pins={framePins}
              currentTime={currentTime}
              duration={duration}
              onPinClick={onPinClick}
            />
          </FrameClickHandler>
        ) : retryState.isRetrying ? (
          <div className="relative z-10 w-full max-w-2xl aspect-video flex items-center justify-center bg-muted/30 rounded-lg border border-border/20">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <Play className="h-6 w-6 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm">Retrying playback...</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Attempt {retryState.attempt} of {retryState.maxAttempts}
              </p>
            </div>
          </div>
        ) : !videoUrl ? (
          <div className="relative z-10 w-full max-w-2xl aspect-video flex items-center justify-center bg-muted/30 rounded-lg border border-border/20">
            <div className="text-center opacity-50">
              <Play className="h-16 w-16 mx-auto mb-2" />
              <p className="text-sm">No video</p>
            </div>
          </div>
        ) : null}

        {/* Center play button overlay - hide when error or no video */}
        {videoUrl && !videoDecodeError && (
          <button 
            onClick={handlePlayPause}
            className={cn(
              "absolute z-20 p-5 rounded-full bg-primary/80 backdrop-blur-sm transition-all duration-200",
              isPlaying ? "opacity-0 scale-90 pointer-events-none" : "opacity-100 scale-100 hover:scale-105 hover:bg-primary"
            )}
          >
            <Play className="h-10 w-10 text-primary-foreground" fill="currentColor" />
          </button>
        )}
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

        {/* Floating annotation bar - appears above timeline when selection exists */}
        <div className="relative mx-4">
          {activeSelection.type !== null && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10">
              <FloatingAnnotationBar
                selection={activeSelection}
                onCreateMarker={(type) => {
                  const time = activeSelection.type === "range" ? activeSelection.rangeStart! : activeSelection.point!;
                  const endTime = activeSelection.type === "range" ? activeSelection.rangeEnd : undefined;
                  onCreateMarker?.(type, time, endTime);
                }}
                onOpenNote={() => {
                  const time = activeSelection.type === "range" ? activeSelection.rangeStart! : activeSelection.point!;
                  const endTime = activeSelection.type === "range" ? activeSelection.rangeEnd : undefined;
                  onOpenNote?.(time, endTime);
                }}
                onOpenVoice={() => {
                  const time = activeSelection.type === "range" ? activeSelection.rangeStart! : activeSelection.point!;
                  onOpenVoice?.(time);
                }}
              />
            </div>
          )}
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
            reactionMarkers={reactionMarkers}
            onReactionClick={(id, time) => onMarkerClick?.(time)}
            suggestions={suggestions}
            onSuggestionAccept={onSuggestionAccept}
            onSuggestionDismiss={onSuggestionDismiss}
          />
          
          {/* Onboarding hint when no selection */}
          {activeSelection.type === null && annotations.length === 0 && (
            <TimelineEmptyState className="mt-2" />
          )}
        </div>
      </div>
    </div>
  );
}
