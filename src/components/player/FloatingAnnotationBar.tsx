import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SelectionState } from "./TimelineSelection";

interface FloatingAnnotationBarProps {
  selection: SelectionState;
  onCreateMarker: (type: "kill" | "death" | "highlight" | "marker") => void;
  onOpenNote: () => void;
  onOpenVoice: () => void;
  className?: string;
}

export function FloatingAnnotationBar({
  selection,
  onCreateMarker,
  onOpenNote,
  onOpenVoice,
  className,
}: FloatingAnnotationBarProps) {
  if (selection.type === null) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const selectionLabel = selection.type === "range" 
    ? `${formatTime(selection.rangeStart!)} – ${formatTime(selection.rangeEnd!)}`
    : formatTime(selection.point!);

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1.5 rounded-lg",
        "bg-card/95 backdrop-blur-sm border border-border/50 shadow-lg",
        "animate-fade-in",
        className
      )}
    >
      {/* Selection indicator */}
      <span className="px-2 py-0.5 text-xs font-mono text-muted-foreground tabular-nums">
        {selectionLabel}
      </span>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Instant create buttons */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2.5 text-xs text-vantage-success hover:text-vantage-success hover:bg-vantage-success/10"
        onClick={() => onCreateMarker("kill")}
      >
        Kill
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => onCreateMarker("death")}
      >
        Death
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2.5 text-xs text-vantage-warning hover:text-vantage-warning hover:bg-vantage-warning/10"
        onClick={() => onCreateMarker("highlight")}
      >
        Highlight
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2.5 text-xs"
        onClick={() => onCreateMarker("marker")}
      >
        Marker
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Drawer-opening buttons */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2.5 text-xs"
        onClick={onOpenNote}
      >
        Note
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2.5 text-xs"
        onClick={onOpenVoice}
      >
        Voice
      </Button>
    </div>
  );
}
