import { useState, useRef, useEffect, useCallback } from "react";
import { Annotation, VoiceNote } from "@/lib/captures";
import { PlaybackFallbackCard } from "./PlaybackFallbackCard";
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
  Minimize,
  SkipBack, 
  SkipForward,
  Mic,
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
}: CinematicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoDecodeError, setVideoDecodeError] = useState<VideoDecodeError | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const playbackRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset video state when URL changes
  useEffect(() => {
    setVideoReady(false);
    setVideoDecodeError(null);
  }, [videoUrl]);

  // Simulated playback for demo (no video)
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

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleVideoLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setVideoReady(true);
    setVideoDecodeError(null);
    onVideoLoaded?.(video.duration);
  }, [onVideoLoaded]);

  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const mediaError = video.error;
    
    let errorType: VideoDecodeError["type"] = "unknown";
    let message = "An unknown error occurred while loading the video.";
    
    if (mediaError) {
      switch (mediaError.code) {
        case MediaError.MEDIA_ERR_DECODE:
          errorType = "decode";
          message = "This recording can't be played in this browser.";
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorType = "src";
          message = "The video format is not supported.";
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorType = "network";
          message = "A network error occurred.";
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

  const handleSeek = useCallback((value: number[]) => {
    const newTime = value[0];
    onSeek(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
  }, [onSeek]);

  const handleSkip = useCallback((seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    onSeek(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
  }, [currentTime, duration, onSeek]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) videoRef.current.volume = newVolume;
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
    if (videoRef.current) videoRef.current.muted = !isMuted;
  }, [isMuted]);

  const handleFullscreen = useCallback(() => {
    if (containerRef.current) {
      document.fullscreenElement ? document.exitFullscreen() : containerRef.current.requestFullscreen();
    }
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(duration, percentage * duration));
    onSeek(time);
    if (videoRef.current) videoRef.current.currentTime = time;
  }, [duration, onSeek]);

  const handleProgressHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    setHoverTime(Math.max(0, Math.min(duration, percentage * duration)));
  }, [duration]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  }, [isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.code) {
        case "Space":
        case "KeyK":
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSkip(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSkip(5);
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
  }, [handlePlayPause, handleSkip, toggleMute, handleFullscreen]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercentage = (currentTime / duration) * 100;

  // Get marker color
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
        "relative bg-background rounded-xl overflow-hidden flex flex-col h-full",
        isFullscreen && "fixed inset-0 z-50 rounded-none"
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video area */}
      <div className="relative flex-1 min-h-0 bg-muted/10">
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
            className="w-full h-full object-contain"
            controls={false}
            playsInline
            preload="metadata"
            onLoadedMetadata={handleVideoLoadedMetadata}
            onError={handleVideoError}
            onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
          />
        ) : !videoUrl ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center opacity-40">
              <Play className="h-16 w-16 mx-auto mb-2" />
              <p className="text-sm">No video</p>
            </div>
          </div>
        ) : null}

        {/* Center play button - only when paused */}
        <div 
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-200 cursor-pointer",
            isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
          onClick={handlePlayPause}
        >
          <button className="p-6 rounded-full bg-primary/90 hover:bg-primary transition-transform hover:scale-105">
            <Play className="h-12 w-12 text-primary-foreground" fill="currentColor" />
          </button>
        </div>
      </div>

      {/* Minimal controls */}
      <div 
        className={cn(
          "bg-card/80 backdrop-blur-sm border-t border-border/30 transition-opacity duration-200",
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Timeline */}
        <div 
          ref={progressRef}
          className="relative h-8 px-4 cursor-pointer group"
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setHoverTime(null)}
          onClick={handleProgressClick}
        >
          {/* Track */}
          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-75"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Markers */}
          {annotations.map((a) => (
            <button
              key={a.id}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ring-1 ring-background transition-transform hover:scale-150 z-10",
                getMarkerColor(a.annotation_type)
              )}
              style={{ left: `calc(${(a.timestamp_seconds / duration) * 100}% + 16px - 5px)` }}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(a.timestamp_seconds);
                onMarkerClick?.(a.timestamp_seconds);
              }}
            />
          ))}

          {voiceNotes.map((v) => (
            <button
              key={v.id}
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent ring-1 ring-background transition-transform hover:scale-150 z-10"
              style={{ left: `calc(${(v.timestamp_seconds / duration) * 100}% + 16px - 5px)` }}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(v.timestamp_seconds);
                onMarkerClick?.(v.timestamp_seconds);
              }}
            />
          ))}

          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
            style={{ left: `calc(${progressPercentage}% + 16px)` }}
          />

          {/* Hover time */}
          {hoverTime !== null && (
            <div 
              className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-foreground text-background text-xs font-mono whitespace-nowrap pointer-events-none"
              style={{ left: `calc(${(hoverTime / duration) * 100}% + 16px)` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSkip(-5)}>
                  <SkipBack className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>-5s</TooltipContent>
            </Tooltip>

            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handlePlayPause}>
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" fill="currentColor" />}
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSkip(5)}>
                  <SkipForward className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>+5s</TooltipContent>
            </Tooltip>

            <span className="ml-2 text-sm font-mono text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMute}>
              {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.05}
              onValueChange={handleVolumeChange}
              className="w-16"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleFullscreen}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
