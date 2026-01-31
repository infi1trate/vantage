import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SelectionState } from "./TimelineSelection";
import { 
  Target, 
  Skull, 
  Star, 
  Bookmark, 
  FileText, 
  Mic,
} from "lucide-react";

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
        "flex items-center gap-1.5 px-3 py-2 rounded-xl",
        "bg-card/95 backdrop-blur-sm border border-border/50 shadow-lg",
        // Subtle, fast entrance animation
        "animate-scale-in origin-bottom",
        className
      )}
      role="toolbar"
      aria-label="Moment actions"
    >
      {/* Selection indicator */}
      <span className="px-2 py-1 text-xs font-mono text-muted-foreground tabular-nums bg-muted/30 rounded-md">
        {selectionLabel}
      </span>

      <div className="w-px h-6 bg-border mx-1" aria-hidden="true" />

      {/* Instant create buttons - with icons and labels for accessibility */}
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-3 text-xs text-vantage-success hover:text-vantage-success hover:bg-vantage-success/10 gap-1.5"
        onClick={() => onCreateMarker("kill")}
        aria-label="Mark as Kill"
      >
        <Target className="h-3.5 w-3.5" />
        Kill
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
        onClick={() => onCreateMarker("death")}
        aria-label="Mark as Death"
      >
        <Skull className="h-3.5 w-3.5" />
        Death
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-3 text-xs text-vantage-warning hover:text-vantage-warning hover:bg-vantage-warning/10 gap-1.5"
        onClick={() => onCreateMarker("highlight")}
        aria-label="Mark as Highlight"
      >
        <Star className="h-3.5 w-3.5" />
        Highlight
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-3 text-xs gap-1.5"
        onClick={() => onCreateMarker("marker")}
        aria-label="Add Marker"
      >
        <Bookmark className="h-3.5 w-3.5" />
        Marker
      </Button>

      <div className="w-px h-6 bg-border mx-1" aria-hidden="true" />

      {/* Drawer-opening buttons - with icons and labels */}
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-3 text-xs gap-1.5"
        onClick={onOpenNote}
        aria-label="Add text note"
      >
        <FileText className="h-3.5 w-3.5" />
        Note
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-3 text-xs gap-1.5"
        onClick={onOpenVoice}
        aria-label="Add voice note"
      >
        <Mic className="h-3.5 w-3.5" />
        Voice
      </Button>
    </div>
  );
}
