/**
 * CommunityVideoPlayer - Premium video player for community posts
 * Features timeline-anchored emoji reactions and annotation markers
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ReactionPill, FloatingReaction } from "./ReactionPill";
import {
  TimelineReactionMarkers,
  TimelineAnnotationMarkers,
} from "./TimelineReactionMarkers";
import {
  CommunityReaction,
  ReactionType,
  addReaction,
} from "@/lib/communityReactions";
import { CommunityAnnotation } from "@/lib/community";
import { toast } from "sonner";

interface CommunityVideoPlayerProps {
  videoUrl: string | null;
  postId: string;
  userId?: string;
  reactions: CommunityReaction[];
  annotations: CommunityAnnotation[];
  onTimeUpdate?: (time: number) => void;
  onReactionAdded?: (reaction: CommunityReaction) => void;
  className?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function CommunityVideoPlayer({
  videoUrl,
  postId,
  userId,
  reactions,
  annotations,
  onTimeUpdate,
  onReactionAdded,
  className,
}: CommunityVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [floatingReactions, setFloatingReactions] = useState<
    { id: string; emoji: ReactionType }[]
  >([]);

  // Hide controls after inactivity
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setTimeout(() => setShowControls(false), 3000);
    return () => clearTimeout(timer);
  }, [isPlaying, showControls]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      onTimeUpdate?.(videoRef.current.currentTime);
    }
  }, [onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleSeekSlider = useCallback((values: number[]) => {
    handleSeek(values[0]);
  }, [handleSeek]);

  const handleVolumeChange = useCallback((values: number[]) => {
    const newVolume = values[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
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

  const handleReact = useCallback(
    async (emoji: ReactionType) => {
      if (!userId) {
        toast.error("Sign in to react");
        return;
      }

      try {
        const reaction = await addReaction(postId, userId, currentTime, emoji);

        // Show floating animation
        const id = crypto.randomUUID();
        setFloatingReactions((prev) => [...prev, { id, emoji }]);

        onReactionAdded?.(reaction);
      } catch (error: any) {
        if (error.message === "Already reacted") {
          // Silently handle duplicate - still show animation
          const id = crypto.randomUUID();
          setFloatingReactions((prev) => [...prev, { id, emoji }]);
        } else {
          console.error("Failed to add reaction:", error);
          toast.error("Failed to add reaction");
        }
      }
    },
    [userId, postId, currentTime, onReactionAdded]
  );

  const removeFloatingReaction = useCallback((id: string) => {
    setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!videoUrl) {
    return (
      <div
        className={cn(
          "aspect-video bg-muted/50 rounded-xl flex items-center justify-center",
          className
        )}
      >
        <p className="text-muted-foreground">Video not available</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative group rounded-xl overflow-hidden bg-black", className)}
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full aspect-video object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={handlePlayPause}
      />

      {/* Floating reactions */}
      <div className="absolute left-1/2 bottom-24 pointer-events-none">
        <AnimatePresence>
          {floatingReactions.map((fr) => (
            <FloatingReaction
              key={fr.id}
              emoji={fr.emoji}
              onComplete={() => removeFloatingReaction(fr.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"
          >
            {/* Center play button */}
            <button
              className="absolute inset-0 flex items-center justify-center"
              onClick={handlePlayPause}
            >
              <motion.div
                className={cn(
                  "p-4 rounded-full bg-white/20 backdrop-blur-sm",
                  "transition-transform hover:scale-110"
                )}
                whileTap={{ scale: 0.9 }}
              >
                {isPlaying ? (
                  <Pause className="h-8 w-8 text-white" fill="white" />
                ) : (
                  <Play className="h-8 w-8 text-white" fill="white" />
                )}
              </motion.div>
            </button>

            {/* Bottom controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
              {/* Timeline with markers */}
              <div className="space-y-1">
                {/* Reaction markers track */}
                <TimelineReactionMarkers
                  reactions={reactions}
                  duration={duration}
                  currentUserId={userId}
                  onSeek={handleSeek}
                />

                {/* Annotation markers track */}
                <TimelineAnnotationMarkers
                  annotations={annotations.map((a) => ({
                    id: a.id,
                    timestamp_seconds: a.timestamp_seconds,
                    content: a.content,
                  }))}
                  duration={duration}
                  onSeek={handleSeek}
                />

                {/* Progress bar */}
                <div className="relative group/slider">
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleSeekSlider}
                    className="cursor-pointer"
                  />
                </div>
              </div>

              {/* Control buttons */}
              <div className="flex items-center justify-between gap-3">
                {/* Left side */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={handlePlayPause}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" fill="white" />
                    ) : (
                      <Play className="h-4 w-4" fill="white" />
                    )}
                  </Button>

                  {/* Volume */}
                  <div className="flex items-center gap-1 group/volume">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={toggleMute}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-200">
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        step={0.05}
                        onValueChange={handleVolumeChange}
                        className="w-16"
                      />
                    </div>
                  </div>

                  {/* Time display */}
                  <span className="text-xs text-white/80 font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2">
                  {/* Reaction pill */}
                  {userId && (
                    <ReactionPill onReact={handleReact} disabled={!userId} />
                  )}

                  {/* Fullscreen */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white hover:bg-white/20"
                        onClick={handleFullscreen}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Fullscreen</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
