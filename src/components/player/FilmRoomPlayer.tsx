import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Annotation, VoiceNote, TimelineEvent, DrawAnnotation } from "@/lib/captures";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { LayeredTimeline } from "./LayeredTimeline";
import { DrawingCanvas } from "./DrawingCanvas";
import { PlaybackFallbackCard } from "./PlaybackFallbackCard";
import { useVoiceAnnotationSync } from "@/hooks/useVoiceAnnotationSync";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  SkipBack, 
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Rewind,
  FastForward,
  Layers,
  Gauge,
  Video,
  Mic,
  Pencil,
  VolumeOff,
  Info,
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
  /** Stored mimeType from the session record (mimeTypeUsed) */
  storedMimeType: string | null;
  videoDuration: number | null;
  videoWidth: number | null;
  videoHeight: number | null;
}

interface FilmRoomPlayerProps {
  sessionId: string;
  videoUrl?: string | null;
  audioUrl?: string | null;
  duration: number;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onSeek: (time: number) => void;
  annotations: Annotation[];
  voiceNotes: VoiceNote[];
  drawAnnotations?: DrawAnnotation[];
  events?: TimelineEvent[];
  onAnnotationClick?: (annotation: Annotation) => void;
  onEventClick?: (event: TimelineEvent) => void;
  onDrawingCreated?: (drawing: DrawAnnotation) => void;
  /** Video blob metadata for diagnostics */
  videoMeta?: VideoMetaInfo | null;
  /** Called when video metadata loads successfully */
  onVideoLoaded?: (duration: number) => void;
  /** Called when video fails to decode/play */
  onVideoError?: (error: VideoDecodeError) => void;
  /** Called to download the recording when playback fails */
  onDownloadRequest?: () => void;
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const FRAME_RATE = 30; // Assume 30fps for frame stepping
const FRAME_DURATION = 1 / FRAME_RATE;

export function FilmRoomPlayer({
  sessionId,
  videoUrl,
  audioUrl,
  duration,
  currentTime,
  onTimeUpdate,
  onSeek,
  annotations,
  voiceNotes,
  drawAnnotations = [],
  events = [],
  onAnnotationClick,
  onEventClick,
  onDrawingCreated,
  videoMeta,
  onVideoLoaded,
  onVideoError,
  onDownloadRequest,
}: FilmRoomPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showWaveform, setShowWaveform] = useState(true);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [showDrawingCanvas, setShowDrawingCanvas] = useState(false);
  const [voiceSyncEnabled, setVoiceSyncEnabled] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [videoDecodeError, setVideoDecodeError] = useState<VideoDecodeError | null>(null);
  
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoAreaRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const playbackRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Voice annotation sync
  const {
    activeVoiceNote,
    isPlayingVoiceNote,
    setEnabled: setVoiceSyncEnabledInternal,
  } = useVoiceAnnotationSync({
    voiceNotes,
    currentTime,
    isVideoPlaying: isPlaying,
    enabled: voiceSyncEnabled,
  });

  // Toggle voice sync
  const handleVoiceSyncToggle = useCallback((enabled: boolean) => {
    setVoiceSyncEnabled(enabled);
    setVoiceSyncEnabledInternal(enabled);
  }, [setVoiceSyncEnabledInternal]);

  // Video metadata loaded successfully
  const handleVideoLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (import.meta.env.DEV) {
      console.log("[FilmRoomPlayer] Video metadata loaded:", {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    }
    setVideoReady(true);
    setVideoDecodeError(null);
    onVideoLoaded?.(video.duration);
  }, [onVideoLoaded]);

  // Video decode/playback error
  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const mediaError = video.error;
    
    let errorType: VideoDecodeError["type"] = "unknown";
    let message = "An unknown error occurred while loading the video.";
    
    if (mediaError) {
      switch (mediaError.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorType = "unknown";
          message = "Video playback was aborted.";
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorType = "network";
          message = "A network error occurred while loading the video.";
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorType = "decode";
          message = "This recording can't be played in this browser. The video format may not be supported.";
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorType = "src";
          message = "The video format is not supported by your browser.";
          break;
      }
      console.error("[FilmRoomPlayer] Video error:", mediaError.code, mediaError.message);
    }

    const error: VideoDecodeError = { type: errorType, message, mediaError };
    setVideoDecodeError(error);
    setVideoReady(false);
    onVideoError?.(error);
  }, [onVideoError]);


  // Pause video when opening drawing canvas
  const handleOpenDrawingCanvas = useCallback(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setShowDrawingCanvas(true);
  }, []);

  // Handle drawing created
  const handleDrawingCreated = useCallback((drawing: DrawAnnotation) => {
    onDrawingCreated?.(drawing);
  }, [onDrawingCreated]);

  // Reset video state when URL changes
  useEffect(() => {
    setVideoReady(false);
    setVideoDecodeError(null);
  }, [videoUrl]);

  // Simulated playback for demo
  useEffect(() => {
    if (isPlaying && !videoUrl) {
      const interval = 100 / playbackSpeed; // Update every 100ms adjusted for speed
      playbackRef.current = setInterval(() => {
        onTimeUpdate(Math.min(currentTime + (0.1 * playbackSpeed), duration));
      }, 100);
    }

    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    };
  }, [isPlaying, videoUrl, currentTime, duration, onTimeUpdate, playbackSpeed]);

  // Sync video playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Stop at end
  useEffect(() => {
    if (currentTime >= duration) {
      setIsPlaying(false);
    }
  }, [currentTime, duration]);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  }, [isPlaying]);

  const handleSeek = useCallback((value: number[]) => {
    const newTime = value[0];
    onSeek(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  }, [onSeek]);

  const handleSkip = useCallback((seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    onSeek(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  }, [currentTime, duration, onSeek]);

  // Frame-by-frame stepping
  const handleFrameStep = useCallback((direction: 1 | -1) => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
    const newTime = Math.max(0, Math.min(duration, currentTime + (FRAME_DURATION * direction)));
    onSeek(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  }, [currentTime, duration, onSeek]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  }, [isMuted]);

  const handleFullscreen = useCallback(() => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  }, []);

  const handleProgressHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const time = percentage * duration;
      setHoverTime(Math.max(0, Math.min(duration, time)));
      setHoverPosition(x);
    }
  }, [duration]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const time = percentage * duration;
      onSeek(Math.max(0, Math.min(duration, time)));
    }
  }, [duration, onSeek]);

  // Navigate to next/prev annotation or event
  const navigateToMarker = useCallback((direction: 1 | -1) => {
    const allMarkers = [
      ...annotations.map(a => ({ time: a.timestamp_seconds, type: "annotation" as const, item: a })),
      ...events.map(e => ({ time: e.timestamp_ms / 1000, type: "event" as const, item: e })),
    ].sort((a, b) => a.time - b.time);

    if (allMarkers.length === 0) return;

    if (direction === 1) {
      const next = allMarkers.find(m => m.time > currentTime + 0.1);
      if (next) onSeek(next.time);
    } else {
      const prev = [...allMarkers].reverse().find(m => m.time < currentTime - 0.1);
      if (prev) onSeek(prev.time);
    }
  }, [annotations, events, currentTime, onSeek]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * FRAME_RATE);
    return `${mins}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

  const formatTimeShort = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.code) {
        case "Space":
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) {
            handleFrameStep(-1);
          } else {
            handleSkip(-5);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) {
            handleFrameStep(1);
          } else {
            handleSkip(5);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          handleVolumeChange([Math.min(1, volume + 0.1)]);
          break;
        case "ArrowDown":
          e.preventDefault();
          handleVolumeChange([Math.max(0, volume - 0.1)]);
          break;
        case "KeyM":
          e.preventDefault();
          toggleMute();
          break;
        case "KeyF":
          e.preventDefault();
          handleFullscreen();
          break;
        case "KeyJ":
          e.preventDefault();
          handleSkip(-10);
          break;
        case "KeyL":
          e.preventDefault();
          handleSkip(10);
          break;
        case "KeyK":
          e.preventDefault();
          handlePlayPause();
          break;
        case "Comma":
          if (e.shiftKey) {
            e.preventDefault();
            setPlaybackSpeed(prev => {
              const idx = PLAYBACK_SPEEDS.indexOf(prev);
              return PLAYBACK_SPEEDS[Math.max(0, idx - 1)];
            });
          } else {
            e.preventDefault();
            handleFrameStep(-1);
          }
          break;
        case "Period":
          if (e.shiftKey) {
            e.preventDefault();
            setPlaybackSpeed(prev => {
              const idx = PLAYBACK_SPEEDS.indexOf(prev);
              return PLAYBACK_SPEEDS[Math.min(PLAYBACK_SPEEDS.length - 1, idx + 1)];
            });
          } else {
            e.preventDefault();
            handleFrameStep(1);
          }
          break;
        case "BracketLeft":
          e.preventDefault();
          navigateToMarker(-1);
          break;
        case "BracketRight":
          e.preventDefault();
          navigateToMarker(1);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlayPause, handleSkip, handleFrameStep, toggleMute, handleFullscreen, handleVolumeChange, volume, navigateToMarker]);

  // Get annotation color based on type
  const getAnnotationColor = (type: Annotation["annotation_type"]) => {
    switch (type) {
      case "kill": return "bg-vantage-success";
      case "death": return "bg-destructive";
      case "highlight": return "bg-vantage-warning";
      case "objective": return "bg-accent";
      default: return "bg-primary";
    }
  };

  const progressPercentage = (currentTime / duration) * 100;

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative bg-background rounded-xl overflow-hidden flex flex-col h-full",
        isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video area */}
      <div ref={videoAreaRef} className="relative flex-1 min-h-0 bg-muted/20 overflow-hidden">
        {/* Video decode error display - Full fallback card */}
        {videoDecodeError && videoUrl && (
          <PlaybackFallbackCard
            error={videoDecodeError}
            videoMeta={videoMeta}
            sessionDuration={duration}
            onDownload={onDownloadRequest}
          />
        )}

        {/* Video or placeholder */}
        {videoUrl && !videoDecodeError ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            controls={false}
            playsInline
            preload="metadata"
            onLoadedMetadata={handleVideoLoadedMetadata}
            onError={handleVideoError}
            onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
          />
        ) : !videoUrl ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted via-background to-muted">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Video className="h-10 w-10 text-primary" />
              </div>
              <p className="text-muted-foreground">Film Room Preview</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Press Space to play • Shift+←/→ for frame step
              </p>
            </div>
          </div>
        ) : null}

        {/* Video ready indicator - brief flash when loaded */}
        {videoReady && !videoDecodeError && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded bg-vantage-success/20 text-vantage-success animate-fade-in">
            <Info className="h-3 w-3" />
            <span className="text-xs font-medium">Ready</span>
          </div>
        )}

        {/* Drawing Canvas Overlay */}
        {showDrawingCanvas && videoAreaRef.current && (
          <DrawingCanvas
            sessionId={sessionId}
            currentTime={currentTime}
            isVisible={showDrawingCanvas}
            onClose={() => setShowDrawingCanvas(false)}
            onDrawingCreated={handleDrawingCreated}
            containerRef={videoAreaRef}
          />
        )}

        {/* Active voice note indicator */}
        {activeVoiceNote && (
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/90 backdrop-blur-sm text-accent-foreground">
            <Mic className="h-4 w-4 animate-pulse" />
            <span className="text-sm font-medium">Voice note playing</span>
          </div>
        )}

        {/* Center play button */}
        <div 
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
            showControls || !isPlaying ? "opacity-100" : "opacity-0",
            showDrawingCanvas && "pointer-events-none opacity-0"
          )}
        >
          <button 
            onClick={handlePlayPause}
            className="p-5 rounded-full bg-primary/90 hover:bg-primary transition-all hover:scale-110 glow-primary"
          >
            {isPlaying ? (
              <Pause className="h-10 w-10 text-primary-foreground" />
            ) : (
              <Play className="h-10 w-10 text-primary-foreground" fill="currentColor" />
            )}
          </button>
        </div>

        {/* Playback speed indicator */}
        {playbackSpeed !== 1 && !showDrawingCanvas && (
          <div className="absolute top-4 right-4 px-2 py-1 rounded bg-background/80 backdrop-blur-sm">
            <span className="text-sm font-mono-data font-medium">{playbackSpeed}x</span>
          </div>
        )}
      </div>

      {/* Controls panel */}
      <div 
        className={cn(
          "bg-card border-t border-border/50 transition-all duration-300",
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Progress bar with markers */}
        <div 
          ref={progressRef}
          className="relative h-10 px-4 cursor-pointer group"
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setHoverTime(null)}
          onClick={handleProgressClick}
        >
          {/* Background track */}
          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1.5 bg-muted rounded-full overflow-hidden">
            {/* Progress fill */}
            <div 
              className="h-full bg-primary transition-all duration-75"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Annotation markers */}
          {annotations.map((annotation) => (
            <Tooltip key={annotation.id}>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ring-2 ring-background transition-transform hover:scale-150 z-10",
                    getAnnotationColor(annotation.annotation_type)
                  )}
                  style={{ left: `calc(${(annotation.timestamp_seconds / duration) * 100}% + 16px - 6px)` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(annotation.timestamp_seconds);
                    onAnnotationClick?.(annotation);
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{annotation.title || annotation.annotation_type}</p>
                <p className="text-muted-foreground">{formatTimeShort(annotation.timestamp_seconds)}</p>
              </TooltipContent>
            </Tooltip>
          ))}

          {/* Voice note markers */}
          {voiceNotes.map((note) => (
            <Tooltip key={note.id}>
              <TooltipTrigger asChild>
                <button
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-accent ring-2 ring-background transition-transform hover:scale-150 z-10"
                  style={{ left: `calc(${(note.timestamp_seconds / duration) * 100}% + 16px - 6px)` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(note.timestamp_seconds);
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium flex items-center gap-1">
                  <Mic className="h-3 w-3" /> Voice Note
                </p>
                <p className="text-muted-foreground">{formatTimeShort(note.timestamp_seconds)}</p>
              </TooltipContent>
            </Tooltip>
          ))}

          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
            style={{ left: `calc(${progressPercentage}% + 16px)` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary" />
          </div>

          {/* Hover preview */}
          {hoverTime !== null && (
            <div 
              className="absolute top-0 bottom-0 pointer-events-none z-30"
              style={{ left: `${hoverPosition + 16}px` }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-foreground text-background text-xs font-mono-data whitespace-nowrap">
                {formatTime(hoverTime)}
              </div>
              <div className="absolute top-0 bottom-0 w-px bg-foreground/30" />
            </div>
          )}
        </div>

        {/* Waveform (optional) */}
        {showWaveform && (
          <div className="px-4 pb-2">
            <WaveformVisualizer
              audioUrl={audioUrl}
              duration={duration}
              currentTime={currentTime}
              height={32}
            />
          </div>
        )}

        {/* Layered timeline tracks (optional) */}
        {showTimeline && (annotations.length > 0 || voiceNotes.length > 0 || events.length > 0) && (
          <div className="px-4 pb-2 border-t border-border/30 pt-2">
            <LayeredTimeline
              duration={duration}
              currentTime={currentTime}
              onSeek={onSeek}
              annotations={annotations}
              voiceNotes={voiceNotes}
              events={events}
            />
          </div>
        )}

        {/* Control buttons */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/30">
          <div className="flex items-center gap-1">
            {/* Frame back */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => handleFrameStep(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous frame (,)</TooltipContent>
            </Tooltip>

            {/* Skip back */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => handleSkip(-10)}
                >
                  <Rewind className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>-10s (J)</TooltipContent>
            </Tooltip>

            {/* Skip back 5s */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => handleSkip(-5)}
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>-5s (←)</TooltipContent>
            </Tooltip>

            {/* Play/Pause */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10"
              onClick={handlePlayPause}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" fill="currentColor" />}
            </Button>

            {/* Skip forward 5s */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => handleSkip(5)}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>+5s (→)</TooltipContent>
            </Tooltip>

            {/* Skip forward */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => handleSkip(10)}
                >
                  <FastForward className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>+10s (L)</TooltipContent>
            </Tooltip>

            {/* Frame forward */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => handleFrameStep(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next frame (.)</TooltipContent>
            </Tooltip>

            {/* Time display */}
            <div className="ml-3 px-2 py-1 rounded bg-muted/50">
              <span className="text-sm font-mono-data text-foreground">
                {formatTime(currentTime)}
              </span>
              <span className="text-sm font-mono-data text-muted-foreground"> / {formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Playback speed */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Gauge className="h-4 w-4" />
                  {playbackSpeed}x
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {PLAYBACK_SPEEDS.map((speed) => (
                  <DropdownMenuItem 
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={speed === playbackSpeed ? "bg-accent" : ""}
                  >
                    {speed}x {speed === 1 && "(Normal)"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Volume */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={toggleMute}
                  >
                    {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mute (M)</TooltipContent>
              </Tooltip>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.05}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>

            {/* View toggles */}
            <div className="flex items-center gap-1 ml-2 border-l border-border/50 pl-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={showWaveform ? "secondary" : "ghost"} 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => setShowWaveform(!showWaveform)}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle waveform</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={showTimeline ? "secondary" : "ghost"} 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => setShowTimeline(!showTimeline)}
                  >
                    <Layers className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle timeline tracks</TooltipContent>
              </Tooltip>

              {/* Draw button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={showDrawingCanvas ? "secondary" : "ghost"} 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={handleOpenDrawingCanvas}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Draw on frame (D)</TooltipContent>
              </Tooltip>
            </div>

            {/* Voice sync toggle */}
            <div className="flex items-center gap-2 ml-2 border-l border-border/50 pl-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      id="voice-sync"
                      checked={voiceSyncEnabled}
                      onCheckedChange={handleVoiceSyncToggle}
                      className="h-4 w-7"
                    />
                    <Label htmlFor="voice-sync" className="text-xs text-muted-foreground cursor-pointer">
                      Voice Sync
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Auto-play voice notes at their timestamps</TooltipContent>
              </Tooltip>
            </div>

            {/* Fullscreen */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={handleFullscreen}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fullscreen (F)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="px-4 pb-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground">Space</kbd> Play/Pause</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground">←/→</kbd> Skip 5s</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground">,/.</kbd> Frame step</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground">[/]</kbd> Prev/Next marker</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground">D</kbd> Draw</span>
        </div>
      </div>
    </div>
  );
}
