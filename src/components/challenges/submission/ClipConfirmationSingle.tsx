import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipTrimmer } from "./ClipTrimmer";

interface Annotation {
  id: string;
  annotation_type: string;
  title?: string | null;
  content?: string | null;
  timestamp_seconds: number;
}

interface ClipConfirmationSingleProps {
  selectedAnnotation: Annotation | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  totalDuration: number;
  minClipDuration: number;
  maxClipDuration: number;
  clipStartMs: number;
  clipEndMs: number;
  onRangeChange: (startMs: number, endMs: number) => void;
  formatTimestamp: (seconds: number) => string;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function ClipConfirmationSingle({
  selectedAnnotation,
  videoUrl,
  thumbnailUrl,
  totalDuration,
  minClipDuration,
  maxClipDuration,
  clipStartMs,
  clipEndMs,
  onRangeChange,
  formatTimestamp,
}: ClipConfirmationSingleProps) {
  const [showTrimmer, setShowTrimmer] = useState(false);

  const clipDurationSec = (clipEndMs - clipStartMs) / 1000;
  const isValid = clipDurationSec >= minClipDuration && clipDurationSec <= maxClipDuration;

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Clip looks good</h4>

      {/* Passive preview */}
      <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt="Clip preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted via-background to-muted" />
        )}
      </div>

      {/* Summary row */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm",
          isValid
            ? "bg-green-500/10 border-green-500/30 text-green-500"
            : "bg-destructive/10 border-destructive/30 text-destructive"
        )}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            Clip duration: <strong>{formatDuration(clipDurationSec)}</strong>
          </span>
        </div>
        {selectedAnnotation && (
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            around {formatTimestamp(selectedAnnotation.timestamp_seconds)}
          </span>
        )}
      </div>

      {/* Optional adjust */}
      {!showTrimmer ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground h-auto py-1 px-2"
          onClick={() => setShowTrimmer(true)}
        >
          <SlidersHorizontal className="h-3 w-3 mr-1.5" />
          Adjust clip timing
        </Button>
      ) : (
        <ClipTrimmer
          videoUrl={videoUrl}
          thumbnailUrl={thumbnailUrl}
          totalDuration={totalDuration}
          minDuration={minClipDuration}
          maxDuration={maxClipDuration}
          startMs={clipStartMs}
          endMs={clipEndMs}
          onRangeChange={onRangeChange}
          annotationTimestamp={selectedAnnotation?.timestamp_seconds}
        />
      )}
    </div>
  );
}
