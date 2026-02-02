/**
 * RecordingStateBody
 * 
 * Body content shown in the popover during active recording or paused state.
 * Displays timer, source info, and pause/stop controls.
 */

import { cn } from "@/lib/utils";
import { Pause, Play, Square, Monitor, AppWindow, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRecordingTime, CaptureSourceType, RECORDING_LIMIT_SECONDS } from "./types";

interface RecordingStateBodyProps {
  duration: number;
  isPaused: boolean;
  sourceType: CaptureSourceType;
  sourceName?: string;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

// Get source icon
function getSourceIcon(type: CaptureSourceType) {
  switch (type) {
    case "screen": return Monitor;
    case "window": return AppWindow;
    case "camera": return Video;
  }
}

// Get source label
function getSourceLabel(type: CaptureSourceType) {
  switch (type) {
    case "screen": return "Full screen";
    case "window": return "Specific window";
    case "camera": return "Camera only";
  }
}

export function RecordingStateBody({
  duration,
  isPaused,
  sourceType,
  sourceName,
  onPause,
  onResume,
  onStop,
}: RecordingStateBodyProps) {
  const SourceIcon = getSourceIcon(sourceType);
  const isNearLimit = duration >= RECORDING_LIMIT_SECONDS * 0.8;
  const timeRemaining = RECORDING_LIMIT_SECONDS - duration;

  return (
    <div className="flex flex-col items-center py-4">
      {/* Timer section */}
      <div className="flex items-center gap-3 mb-2">
        {/* REC indicator dot */}
        <div className={cn(
          "w-3 h-3 rounded-full",
          isPaused 
            ? "bg-amber-500" 
            : "bg-destructive animate-pulse",
          "shadow-lg",
          isPaused 
            ? "shadow-amber-500/50" 
            : "shadow-destructive/50"
        )} />
        
        {/* Large timer */}
        <span className={cn(
          "font-mono text-4xl font-bold tabular-nums",
          isNearLimit && !isPaused ? "text-amber-400" : "text-foreground"
        )}>
          {formatRecordingTime(duration)}
        </span>
      </div>

      {/* Status line */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <span className={cn(
          "uppercase text-xs font-semibold tracking-wider",
          isPaused ? "text-amber-500" : "text-vantage-green"
        )}>
          {isPaused ? "Paused" : "Recording"}
        </span>
        <span className="text-white/20">·</span>
        <SourceIcon className="w-4 h-4" />
        <span className="truncate max-w-[180px]">
          {sourceName || getSourceLabel(sourceType)}
        </span>
      </div>

      {/* Time remaining warning */}
      {isNearLimit && !isPaused && (
        <div className="mb-4 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30">
          <span className="text-xs font-medium text-amber-400">
            {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")} remaining
          </span>
        </div>
      )}

      {/* Control buttons */}
      <div className="flex items-center gap-3 w-full px-2">
        {/* Pause/Resume button */}
        <Button
          onClick={isPaused ? onResume : onPause}
          variant="outline"
          className={cn(
            "flex-1 h-12 text-sm font-semibold uppercase tracking-wider",
            "border-2 rounded-xl",
            isPaused 
              ? "border-vantage-green/50 text-vantage-green hover:bg-vantage-green/10" 
              : "border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
          )}
        >
          {isPaused ? (
            <>
              <Play className="w-4 h-4 mr-2 fill-current" />
              Resume
            </>
          ) : (
            <>
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </>
          )}
        </Button>

        {/* Stop button */}
        <Button
          onClick={onStop}
          className={cn(
            "flex-1 h-12 text-sm font-semibold uppercase tracking-wider",
            "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
            "shadow-lg shadow-destructive/25",
            "rounded-xl",
            "transition-all duration-150 active:scale-[0.98]"
          )}
        >
          <Square className="w-4 h-4 mr-2 fill-current" />
          Stop
        </Button>
      </div>
    </div>
  );
}
