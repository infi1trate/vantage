import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CommunityTimeline } from "./CommunityTimeline";
import { EmojiReactionPill } from "./EmojiReactionPill";
import { FloatingEmoji } from "./FloatingEmoji";
import { CommunityReaction, ReactionEmoji } from "@/lib/communityReactions";
import { CommunityAnnotation } from "@/lib/community";
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface CommunityVideoPlayerProps {
  videoUrl: string | null;
  reactions: CommunityReaction[];
  annotations: CommunityAnnotation[];
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onReact?: (emoji: ReactionEmoji, timestamp: number) => void;
  canReact?: boolean;
  className?: string;
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function CommunityVideoPlayer({
  videoUrl,
  reactions,
  annotations,
  onTimeUpdate,
  onDurationChange,
  onReact,
  canReact = true,
  className,
}: CommunityVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showReactionPill, setShowReactionPill] = useState(false);
  const [floatingEmoji, setFloatingEmoji] = useState<string | null>(null);
  
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls when playing
  const resetHideControlsTimer = useCallback(() => {
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    setShowControls(true);
    setShowReactionPill(true);
    
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
        setShowReactionPill(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetHideControlsTimer();
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [isPlaying, resetHideControlsTimer]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      onDurationChange?.(dur);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const vol = value[0];
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    if (isFullscreen) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleReact = (emoji: ReactionEmoji) => {
    setFloatingEmoji(emoji);
    onReact?.(emoji, currentTime);
    resetHideControlsTimer();
  };

  const handleContainerClick = () => {
    handlePlayPause();
    resetHideControlsTimer();
  };

  const handleMouseMove = () => {
    resetHideControlsTimer();
  };

  if (!videoUrl) {
    return (
      <div className={cn("relative aspect-video bg-black rounded-xl flex items-center justify-center", className)}>
        <p className="text-muted-foreground">Video not available</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-video bg-black rounded-xl overflow-hidden group",
        className
      )}
      onMouseMove={handleMouseMove}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain cursor-pointer"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={handleContainerClick}
      />

      {/* Floating emoji feedback */}
      <FloatingEmoji
        emoji={floatingEmoji}
        onComplete={() => setFloatingEmoji(null)}
        className="left-1/2 bottom-24 -translate-x-1/2"
      />

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Emoji reaction pill - centered above timeline */}
        {canReact && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30">
            <EmojiReactionPill
              onReact={handleReact}
              isVisible={showReactionPill}
            />
          </div>
        )}

        {/* Bottom controls */}
        <div className="p-4 space-y-2">
          {/* Timeline */}
          <CommunityTimeline
            duration={duration}
            currentTime={currentTime}
            onSeek={handleSeek}
            reactions={reactions}
            annotations={annotations}
          />

          {/* Control bar */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayPause}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            {/* Time display */}
            <span className="text-xs font-mono text-white/80 min-w-[80px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Volume */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="h-8 w-8 text-white hover:bg-white/20"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <div className="w-20 hidden sm:block">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="cursor-pointer"
                />
              </div>
            </div>

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Center play button overlay when paused */}
      {!isPlaying && showControls && (
        <button
          onClick={handlePlayPause}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center pointer-events-auto hover:bg-white/30 transition-colors">
            <Play className="h-8 w-8 text-white ml-1" />
          </div>
        </button>
      )}
    </div>
  );
}
