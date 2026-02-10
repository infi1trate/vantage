import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Tag,
  Crosshair,
  Skull,
  Flame,
  Star,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipTrimmer } from "./ClipTrimmer";
import type { MomentData } from "./MomentCollector";

const TYPE_META: Record<string, { icon: typeof Tag; color: string }> = {
  kill: { icon: Crosshair, color: "text-red-400" },
  death: { icon: Skull, color: "text-orange-400" },
  highlight: { icon: Flame, color: "text-yellow-400" },
  streak: { icon: Star, color: "text-amber-400" },
};

function getTypeMeta(type: string) {
  return TYPE_META[type.toLowerCase()] ?? { icon: Tag, color: "text-muted-foreground" };
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

interface ClipConfirmationMultiProps {
  moments: MomentData[];
  onMomentsChange: (moments: MomentData[]) => void;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  totalDuration: number;
  minClipDuration: number;
  maxClipDuration: number;
  formatTimestamp: (seconds: number) => string;
}

export function ClipConfirmationMulti({
  moments,
  onMomentsChange,
  videoUrl,
  thumbnailUrl,
  totalDuration,
  minClipDuration,
  maxClipDuration,
  formatTimestamp,
}: ClipConfirmationMultiProps) {
  // Track which moment index has its trimmer expanded
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const allValid = moments.every((m) => {
    const dur = (m.clipEndMs - m.clipStartMs) / 1000;
    return dur >= minClipDuration && dur <= maxClipDuration;
  });

  const handleRangeChange = (annotationId: string, startMs: number, endMs: number) => {
    onMomentsChange(
      moments.map((m) =>
        m.annotationId === annotationId
          ? { ...m, clipStartMs: startMs, clipEndMs: endMs }
          : m
      )
    );
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Clips look good</h4>
      <p className="text-sm text-muted-foreground">
        Each moment has been auto-clipped. You can continue or adjust any clip below.
      </p>

      {/* Moment rows */}
      <div className="space-y-2">
        {moments.map((moment, index) => {
          const meta = getTypeMeta(moment.annotationType);
          const Icon = meta.icon;
          const durationSec = (moment.clipEndMs - moment.clipStartMs) / 1000;
          const isValid = durationSec >= minClipDuration && durationSec <= maxClipDuration;
          const isExpanded = expandedIndex === index;

          return (
            <div key={moment.annotationId} className="space-y-2">
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-sm",
                  isValid
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-destructive/30 bg-destructive/5"
                )}
              >
                {/* Index */}
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-medium shrink-0">
                  {index + 1}
                </span>

                {/* Icon + label */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.color)} />
                  <span className="font-medium truncate">{moment.label}</span>
                </div>

                {/* Duration */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  <span className="font-mono">{formatDuration(durationSec)}</span>
                </div>

                {/* Status */}
                {isValid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                )}

                {/* Adjust toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 px-1.5 text-xs text-muted-foreground"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                >
                  <SlidersHorizontal className="h-3 w-3" />
                </Button>
              </div>

              {/* Expanded trimmer */}
              {isExpanded && (
                <div className="pl-4">
                  <ClipTrimmer
                    videoUrl={videoUrl}
                    thumbnailUrl={thumbnailUrl}
                    totalDuration={totalDuration}
                    minDuration={minClipDuration}
                    maxDuration={maxClipDuration}
                    startMs={moment.clipStartMs}
                    endMs={moment.clipEndMs}
                    onRangeChange={(startMs, endMs) =>
                      handleRangeChange(moment.annotationId, startMs, endMs)
                    }
                    annotationTimestamp={moment.timestampSeconds}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall status */}
      {allValid && (
        <div className="flex items-center gap-2 text-xs text-green-500">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>All clips within range — ready to continue</span>
        </div>
      )}
    </div>
  );
}
