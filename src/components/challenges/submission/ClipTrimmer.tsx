import { useState, useRef, useEffect, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, SkipBack, SkipForward, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClipTrimmerProps {
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  totalDuration: number; // in seconds
  minDuration?: number; // in seconds
  maxDuration?: number; // in seconds
  startMs: number;
  endMs: number;
  onRangeChange: (startMs: number, endMs: number) => void;
  annotationTimestamp?: number; // in seconds - used to auto-position around annotation
}

export function ClipTrimmer({
  videoUrl,
  thumbnailUrl,
  totalDuration,
  minDuration = 5,
  maxDuration = 60,
  startMs,
  endMs,
  onRangeChange,
  annotationTimestamp,
}: ClipTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startMs / 1000);
  const [isDragging, setIsDragging] = useState(false);

  // Convert to seconds for internal calculations
  const startSec = startMs / 1000;
  const endSec = endMs / 1000;
  const clipDuration = endSec - startSec;

  // Validation
  const isTooShort = clipDuration < minDuration;
  const isTooLong = clipDuration > maxDuration;
  const isValid = !isTooShort && !isTooLong;

  // Auto-position around annotation with pre-roll on initial mount
  useEffect(() => {
    if (annotationTimestamp !== undefined && startMs === 0 && endMs === 0) {
      const preRoll = 3; // 3 seconds before annotation
      const postRoll = Math.min(maxDuration - preRoll, 12); // rest of allowed time after
      const newStart = Math.max(0, annotationTimestamp - preRoll);
      const newEnd = Math.min(totalDuration, annotationTimestamp + postRoll);
      onRangeChange(newStart * 1000, newEnd * 1000);
    }
  }, [annotationTimestamp, startMs, endMs, totalDuration, maxDuration, onRangeChange]);

  // Handle video time updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      
      // Loop within clip range
      if (time >= endSec) {
        video.currentTime = startSec;
        setCurrentTime(startSec);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [startSec, endSec]);

  // Seek to start when range changes
  useEffect(() => {
    if (videoRef.current && !isDragging) {
      videoRef.current.currentTime = startSec;
      setCurrentTime(startSec);
    }
  }, [startSec, isDragging]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      // Simulate playback for demo
      setIsPlaying(!isPlaying);
      return;
    }

    if (isPlaying) {
      video.pause();
    } else {
      if (video.currentTime < startSec || video.currentTime >= endSec) {
        video.currentTime = startSec;
      }
      video.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, startSec, endSec]);

  const handleRangeChange = (values: number[]) => {
    setIsDragging(true);
    const [newStart, newEnd] = values;
    onRangeChange(newStart * 1000, newEnd * 1000);
  };

  const handleRangeCommit = () => {
    setIsDragging(false);
  };

  const handleSkip = (seconds: number) => {
    const video = videoRef.current;
    if (video) {
      const newTime = Math.max(startSec, Math.min(endSec, video.currentTime + seconds));
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.floor(seconds)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  return (
    <div className="space-y-3">
      {/* Video Preview */}
      <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            playsInline
            muted={false}
          />
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt="Clip preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted via-background to-muted">
            <div className="text-center">
              <Play className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Preview unavailable</p>
            </div>
          </div>
        )}

        {/* Playback controls overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity">
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleSkip(-5)}
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
              onClick={() => handleSkip(5)}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Current time badge */}
        <Badge
          variant="secondary"
          className="absolute top-2 right-2 font-mono text-xs bg-background/80 backdrop-blur"
        >
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </Badge>
      </div>

      {/* Trim Timeline */}
      <div className="space-y-2">
        <div className="relative pt-2">
          {/* Selected range background */}
          <div
            className="absolute top-0 h-1 bg-primary/30 rounded-full"
            style={{
              left: `${(startSec / totalDuration) * 100}%`,
              width: `${((endSec - startSec) / totalDuration) * 100}%`,
            }}
          />

          {/* Annotation marker */}
          {annotationTimestamp !== undefined && (
            <div
              className="absolute -top-0.5 w-3 h-3 rounded-full bg-yellow-500 border-2 border-background shadow-lg transform -translate-x-1/2"
              style={{ left: `${(annotationTimestamp / totalDuration) * 100}%` }}
              title="Annotated moment"
            />
          )}

          {/* Range slider */}
          <Slider
            value={[startSec, endSec]}
            min={0}
            max={totalDuration}
            step={0.1}
            onValueChange={handleRangeChange}
            onValueCommit={handleRangeCommit}
            className="cursor-pointer"
          />
        </div>

        {/* Time labels */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">{formatTime(startSec)}</span>
          <span className="font-mono">{formatTime(endSec)}</span>
        </div>
      </div>

      {/* Duration validation */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 rounded-lg border text-sm",
          isValid
            ? "bg-green-500/10 border-green-500/30 text-green-500"
            : "bg-destructive/10 border-destructive/30 text-destructive"
        )}
      >
        <div className="flex items-center gap-2">
          {isValid ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>
            Clip duration: <strong>{formatDuration(clipDuration)}</strong>
          </span>
        </div>
        <span className="text-muted-foreground">
          ({formatDuration(minDuration)} – {formatDuration(maxDuration)} allowed)
        </span>
      </div>
    </div>
  );
}
