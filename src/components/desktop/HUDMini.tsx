/**
 * HUDMini
 * 
 * Minimal floating recording HUD shown during active capture.
 * Small vertical pill with stop, timer, pause/resume controls.
 * Syncs with popover state.
 */

import { cn } from "@/lib/utils";
import { Square, Pause, Play } from "lucide-react";
import { formatRecordingTime } from "./types";
import { Button } from "@/components/ui/button";

interface HUDMiniProps {
  duration: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function HUDMini({
  duration,
  isPaused,
  onPause,
  onResume,
  onStop,
}: HUDMiniProps) {
  return (
    <div className={cn(
      // Base pill shape
      "flex flex-col items-center gap-2 px-2 py-3 rounded-2xl",
      // Glass effect
      "bg-background/95 backdrop-blur-xl",
      "border border-white/10",
      "shadow-2xl shadow-black/50"
    )}>
      {/* Stop button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onStop}
        className="h-10 w-10 p-0 rounded-xl hover:bg-destructive/20 group"
      >
        <Square className="w-5 h-5 fill-current text-destructive group-hover:scale-110 transition-transform" />
      </Button>

      {/* Divider */}
      <div className="w-6 h-px bg-white/10" />

      {/* Timer with REC dot */}
      <div className="flex flex-col items-center gap-1">
        {/* REC indicator */}
        <div className={cn(
          "w-2 h-2 rounded-full",
          isPaused 
            ? "bg-amber-500" 
            : "bg-destructive animate-pulse"
        )} />
        
        {/* Time */}
        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
          {formatRecordingTime(duration)}
        </span>
      </div>

      {/* Divider */}
      <div className="w-6 h-px bg-white/10" />

      {/* Pause/Resume button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={isPaused ? onResume : onPause}
        className={cn(
          "h-10 w-10 p-0 rounded-xl group",
          isPaused ? "hover:bg-vantage-green/20" : "hover:bg-amber-500/20"
        )}
      >
        {isPaused ? (
          <Play className="w-5 h-5 fill-current text-vantage-green group-hover:scale-110 transition-transform" />
        ) : (
          <Pause className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
        )}
      </Button>
    </div>
  );
}
