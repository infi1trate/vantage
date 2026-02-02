/**
 * HUDMini
 * 
 * Minimal recording HUD shown during active capture.
 * Displays timer, pause/stop controls, and recording indicator.
 */

import { cn } from "@/lib/utils";
import { PopoverShell } from "./PopoverShell";
import { Square, Pause, Play, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { formatRecordingTime, RECORDING_LIMIT_SECONDS } from "./types";
import { Button } from "@/components/ui/button";

interface HUDMiniProps {
  duration: number;
  isPaused: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
}

export function HUDMini({
  duration,
  isPaused,
  micEnabled,
  cameraEnabled,
  onPause,
  onResume,
  onStop,
  onToggleMic,
  onToggleCamera,
}: HUDMiniProps) {
  const isNearLimit = duration >= RECORDING_LIMIT_SECONDS * 0.8;
  const timeRemaining = RECORDING_LIMIT_SECONDS - duration;

  return (
    <PopoverShell isHUD>
      <div className="flex items-center gap-3">
        {/* Recording indicator + timer */}
        <div className="flex items-center gap-2">
          {/* Pulsing dot */}
          <div className={cn(
            "w-2.5 h-2.5 rounded-full",
            isPaused 
              ? "bg-amber-500" 
              : "bg-destructive animate-pulse",
            "shadow-lg",
            isPaused 
              ? "shadow-amber-500/50" 
              : "shadow-destructive/50"
          )} />
          
          {/* Timer */}
          <span className={cn(
            "font-mono text-sm font-medium tabular-nums",
            isNearLimit && !isPaused && "text-amber-400"
          )}>
            {formatRecordingTime(duration)}
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-white/10" />

        {/* Quick toggles */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMic}
            className={cn(
              "h-7 w-7 p-0",
              micEnabled ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {micEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCamera}
            className={cn(
              "h-7 w-7 p-0",
              cameraEnabled ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {cameraEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-white/10" />

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Pause/Resume */}
          <Button
            variant="ghost"
            size="sm"
            onClick={isPaused ? onResume : onPause}
            className="h-8 w-8 p-0 hover:bg-white/10"
          >
            {isPaused ? (
              <Play className="w-4 h-4 fill-current text-vantage-green" />
            ) : (
              <Pause className="w-4 h-4 text-amber-500" />
            )}
          </Button>

          {/* Stop */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onStop}
            className="h-8 w-8 p-0 hover:bg-destructive/20"
          >
            <Square className="w-4 h-4 fill-current text-destructive" />
          </Button>
        </div>
      </div>

      {/* Time remaining warning */}
      {isNearLimit && (
        <div className="mt-2 text-[10px] text-amber-400 text-center">
          {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")} remaining
        </div>
      )}
    </PopoverShell>
  );
}
