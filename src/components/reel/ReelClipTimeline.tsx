/**
 * Reel Clip Timeline
 * 
 * Visual timeline showing reel clips as resizable blocks.
 * Each block has left/right drag handles for trimming/extending.
 * Renders below the player, above the effects lane.
 */

import { memo, useRef, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { TrimmedClip } from "@/hooks/useClipTrimming";
import { Annotation } from "@/lib/captures";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ReelClipTimelineProps {
  clips: TrimmedClip[];
  annotations: Annotation[];
  totalDurationMs: number;
  currentTime: number; // seconds
  onSeek: (timeSec: number) => void;
  onTrimApply: (clipIndex: number, edge: "in" | "out", trimMs: number) => void;
  onTrimEnd: () => void;
  disabled?: boolean;
  className?: string;
}

function formatMs(ms: number): string {
  const secs = Math.abs(ms) / 1000;
  const mins = Math.floor(secs / 60);
  const s = (secs % 60).toFixed(1);
  return mins > 0 ? `${mins}:${s.padStart(4, "0")}` : `${s}s`;
}

export const ReelClipTimeline = memo(function ReelClipTimeline({
  clips,
  annotations,
  totalDurationMs,
  currentTime,
  onSeek,
  onTrimApply,
  onTrimEnd,
  disabled = false,
  className,
}: ReelClipTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeDrag, setActiveDrag] = useState<{
    clipIndex: number;
    edge: "in" | "out";
    startX: number;
    startTrimMs: number;
  } | null>(null);

  // Convert pixel delta to ms delta
  const pxToMs = useCallback(
    (px: number): number => {
      if (!trackRef.current) return 0;
      const trackWidth = trackRef.current.getBoundingClientRect().width;
      if (trackWidth === 0) return 0;
      return (px / trackWidth) * totalDurationMs;
    },
    [totalDurationMs],
  );

  // Mouse handlers for drag handles
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, clipIndex: number, edge: "in" | "out") => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const clip = clips[clipIndex];
      const initialTrim = edge === "in" ? clip.trimInMs : clip.trimOutMs;
      const startX = e.clientX;

      setActiveDrag({ clipIndex, edge, startX, startTrimMs: initialTrim });

      const handleMouseMove = (me: MouseEvent) => {
        const deltaPx = me.clientX - startX;
        const deltaMs = pxToMs(deltaPx);
        // Send absolute trim value: initial + drag delta
        onTrimApply(clipIndex, edge, initialTrim + deltaMs);
      };

      const handleMouseUp = () => {
        setActiveDrag(null);
        onTrimEnd();
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [clips, disabled, pxToMs, onTrimApply, onTrimEnd],
  );

  // Handle click to seek on timeline background
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current || activeDrag) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      const timeSec = (pct * totalDurationMs) / 1000;
      onSeek(Math.max(0, Math.min(timeSec, totalDurationMs / 1000)));
    },
    [totalDurationMs, onSeek, activeDrag],
  );

  // Playhead position
  const playheadPct = totalDurationMs > 0 ? (currentTime / (totalDurationMs / 1000)) * 100 : 0;

  // Cumulative positions for layout
  let cumulativeMs = 0;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* Label */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          Clips
        </span>
        <span className="text-[10px] text-muted-foreground">
          {formatMs(totalDurationMs)} total
        </span>
      </div>

      {/* Timeline track */}
      <div
        ref={trackRef}
        className={cn(
          "relative h-10 rounded-md bg-muted/20 border border-border/30 cursor-pointer overflow-hidden",
          disabled && "opacity-50 pointer-events-none",
        )}
        onClick={handleTrackClick}
      >
        {/* Clip blocks */}
        {clips.map((clip, i) => {
          const annotation = annotations.find(a => a.id === clip.momentId);
          const clipLabel = annotation?.title || annotation?.content || `Clip ${i + 1}`;
          const leftPct = (cumulativeMs / totalDurationMs) * 100;
          const widthPct = (clip.effectiveDurationMs / totalDurationMs) * 100;
          cumulativeMs += clip.effectiveDurationMs;

          // Is this clip active?
          const clipStartSec = (cumulativeMs - clip.effectiveDurationMs) / 1000;
          const clipEndSec = cumulativeMs / 1000;
          const isActive = currentTime >= clipStartSec && currentTime < clipEndSec;

          // Has been trimmed?
          const isTrimmed = clip.trimInMs !== 0 || clip.trimOutMs !== 0;

          return (
            <div
              key={clip.momentId}
              className={cn(
                "absolute top-0 h-full group",
                "transition-colors duration-100",
              )}
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
              }}
            >
              {/* Clip body */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "absolute inset-0 mx-[3px] rounded-sm flex items-center justify-center overflow-hidden",
                      "border transition-all duration-100",
                      isActive
                        ? "bg-primary/20 border-primary/60"
                        : "bg-muted/40 border-border/40 hover:bg-muted/60",
                      isTrimmed && "ring-1 ring-primary/30",
                    )}
                  >
                    <span className="text-[10px] font-medium text-foreground/70 truncate px-2">
                      {clipLabel}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{clipLabel}</span>
                    <span className="font-mono text-muted-foreground">
                      {formatMs(clip.effectiveDurationMs)}
                      {isTrimmed && " (trimmed)"}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* Left (in) handle */}
              <div
                className={cn(
                  "absolute left-0 top-0 w-[6px] h-full cursor-col-resize z-10",
                  "flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                  activeDrag?.clipIndex === i && activeDrag.edge === "in" && "opacity-100",
                )}
                onMouseDown={(e) => handleMouseDown(e, i, "in")}
              >
                <div className={cn(
                  "w-[3px] h-6 rounded-full",
                  "bg-primary/80 hover:bg-primary",
                )} />
              </div>

              {/* Right (out) handle */}
              <div
                className={cn(
                  "absolute right-0 top-0 w-[6px] h-full cursor-col-resize z-10",
                  "flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                  activeDrag?.clipIndex === i && activeDrag.edge === "out" && "opacity-100",
                )}
                onMouseDown={(e) => handleMouseDown(e, i, "out")}
              >
                <div className={cn(
                  "w-[3px] h-6 rounded-full",
                  "bg-primary/80 hover:bg-primary",
                )} />
              </div>
            </div>
          );
        })}

        {/* Playhead */}
        <div
          className="absolute top-0 w-0.5 h-full bg-primary z-20 pointer-events-none"
          style={{ left: `${Math.min(100, playheadPct)}%` }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
});

export default ReelClipTimeline;
