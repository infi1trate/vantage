import { useState, useRef, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubmissionMoment } from "@/lib/challenges";

interface BundleEntryViewerProps {
  moments: SubmissionMoment[];
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  totalDuration: number; // seconds
}

function formatTimestamp(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function BundleEntryViewer({
  moments,
  videoUrl,
  thumbnailUrl,
  totalDuration,
}: BundleEntryViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeMomentIndex, setActiveMomentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const sorted = [...moments].sort((a, b) => a.order - b.order);
  const activeMoment = sorted[activeMomentIndex];

  // Seek to moment start when switching
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeMoment) return;
    video.currentTime = activeMoment.start_ms / 1000;
  }, [activeMomentIndex, activeMoment]);

  // Monitor playback to auto-advance
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeMoment) return;

    const onTimeUpdate = () => {
      const endSec = activeMoment.end_ms / 1000;
      if (video.currentTime >= endSec) {
        // Auto-advance to next moment
        if (activeMomentIndex < sorted.length - 1) {
          setActiveMomentIndex((i) => i + 1);
        } else {
          video.pause();
          setIsPlaying(false);
        }
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [activeMoment, activeMomentIndex, sorted.length]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      if (activeMoment) {
        const startSec = activeMoment.start_ms / 1000;
        const endSec = activeMoment.end_ms / 1000;
        if (video.currentTime < startSec || video.currentTime >= endSec) {
          video.currentTime = startSec;
        }
      }
      video.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, activeMoment]);

  const handleJump = (index: number) => {
    setActiveMomentIndex(index);
    const video = videoRef.current;
    if (video && isPlaying) {
      const m = sorted[index];
      if (m) {
        video.currentTime = m.start_ms / 1000;
        video.play().catch(() => {});
      }
    }
  };

  const handlePrev = () => {
    if (activeMomentIndex > 0) handleJump(activeMomentIndex - 1);
  };

  const handleNext = () => {
    if (activeMomentIndex < sorted.length - 1) handleJump(activeMomentIndex + 1);
  };

  return (
    <div className="space-y-3">
      {/* Video player */}
      <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            playsInline
          />
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt="Entry preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="h-10 w-10 text-muted-foreground" />
          </div>
        )}

        {/* Playback controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity">
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrev}
              disabled={activeMomentIndex === 0}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10"
              onClick={handlePlayPause}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" fill="currentColor" />
              )}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8"
              onClick={handleNext}
              disabled={activeMomentIndex === sorted.length - 1}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Current moment indicator */}
        <Badge
          variant="secondary"
          className="absolute top-2 right-2 bg-background/80 backdrop-blur text-xs"
        >
          Moment {activeMomentIndex + 1} / {sorted.length}
        </Badge>
      </div>

      {/* Moment playlist */}
      <div className="space-y-1">
        {sorted.map((moment, index) => {
          const isActive = index === activeMomentIndex;
          const durationSec = (moment.end_ms - moment.start_ms) / 1000;

          return (
            <button
              key={`${moment.annotation_id}-${moment.order}`}
              onClick={() => handleJump(index)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all text-sm",
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-accent/50"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium shrink-0",
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {index + 1}
              </span>

              <span className="flex-1 truncate font-medium">
                {moment.label || `Moment ${index + 1}`}
              </span>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" />
                <span className="font-mono">
                  {formatTimestamp(moment.start_ms / 1000)}
                </span>
                <span>·</span>
                <span>{Math.round(durationSec)}s</span>
              </div>

              {isActive && isPlaying && (
                <div className="flex gap-0.5 shrink-0">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-primary rounded-full animate-pulse"
                      style={{
                        height: `${8 + Math.random() * 8}px`,
                        animationDelay: `${i * 150}ms`,
                      }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
