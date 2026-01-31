import { useMemo, memo, useCallback } from "react";
import { Annotation } from "@/lib/captures";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  Target,
  Skull,
  Star,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HighlightsSectionProps {
  annotations: Annotation[];
  currentTime: number;
  onAnnotationClick?: (annotation: Annotation) => void;
  onMarkerClick: (time: number) => void;
  onAnnotationDelete?: (annotationId: string) => void;
}

const EVENT_CONFIG: Record<string, { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  color: string; 
  bg: string 
}> = {
  kill: { label: "Kill", icon: Target, color: "text-vantage-success", bg: "bg-vantage-success/10" },
  death: { label: "Death", icon: Skull, color: "text-destructive", bg: "bg-destructive/10" },
  highlight: { label: "Highlight", icon: Star, color: "text-vantage-warning", bg: "bg-vantage-warning/10" },
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatRange = (start: number, end: number) => {
  return `${formatTime(start)} – ${formatTime(end)}`;
};

// Memoized list item to prevent re-renders when currentTime changes
const HighlightItem = memo(function HighlightItem({
  annotation,
  isActive,
  onClick,
  onDelete,
}: {
  annotation: Annotation;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const config = EVENT_CONFIG[annotation.annotation_type] || EVENT_CONFIG.highlight;
  const Icon = config.icon;
  
  return (
    <button
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all group",
        isActive 
          ? "bg-primary/10 border border-primary/30 shadow-sm" 
          : "hover:bg-muted/50 border border-transparent"
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <div className={cn(
        "shrink-0 p-2 rounded-lg transition-colors",
        isActive ? "bg-primary/20" : config.bg
      )}>
        <Icon className={cn(
          "h-4 w-4",
          isActive ? "text-primary" : config.color
        )} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs font-medium",
            isActive ? "text-primary" : config.color
          )}>
            {config.label}
          </span>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            {annotation.end_timestamp_seconds 
              ? formatRange(annotation.timestamp_seconds, annotation.end_timestamp_seconds)
              : formatTime(annotation.timestamp_seconds)
            }
          </span>
        </div>
        
        {annotation.title && (
          <p className={cn(
            "text-sm truncate mt-0.5",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}>
            {annotation.title}
          </p>
        )}
      </div>
      
      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1">
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
        )}
        <ChevronRight className={cn(
          "h-4 w-4 transition-opacity",
          isActive ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-50 text-muted-foreground"
        )} />
      </div>
    </button>
  );
});

export const HighlightsSection = memo(function HighlightsSection({
  annotations,
  currentTime,
  onAnnotationClick,
  onMarkerClick,
  onAnnotationDelete,
}: HighlightsSectionProps) {
  // Sort by time
  const items = useMemo(() => {
    return [...annotations].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
  }, [annotations]);

  // Find active item based on current playback time
  const activeItemId = useMemo(() => {
    const tolerance = 0.5;
    const active = items.find(item => {
      if (item.end_timestamp_seconds) {
        return currentTime >= item.timestamp_seconds - tolerance && 
               currentTime <= item.end_timestamp_seconds + tolerance;
      }
      return Math.abs(currentTime - item.timestamp_seconds) <= tolerance;
    });
    return active?.id;
  }, [items, currentTime]);

  const handleItemClick = useCallback((annotation: Annotation) => {
    onAnnotationClick?.(annotation) ?? onMarkerClick(annotation.timestamp_seconds);
  }, [onAnnotationClick, onMarkerClick]);

  // Count by type for summary
  const counts = useMemo(() => ({
    kill: items.filter(a => a.annotation_type === "kill").length,
    death: items.filter(a => a.annotation_type === "death").length,
    highlight: items.filter(a => a.annotation_type === "highlight").length,
  }), [items]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-vantage-warning/10 flex items-center justify-center">
          <Star className="h-7 w-7 text-vantage-warning/50" />
        </div>
        <h4 className="font-semibold mb-2">No highlights yet</h4>
        <p className="text-sm text-muted-foreground max-w-xs">
          Mark kills, deaths, and highlight moments during playback to track key events.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats summary */}
      <div className="shrink-0 px-3 py-2 border-b border-border/20 bg-muted/10">
        <div className="flex gap-4 justify-center">
          {counts.kill > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Target className="h-3.5 w-3.5 text-vantage-success" />
              <span className="text-vantage-success font-medium">{counts.kill}</span>
              <span className="text-muted-foreground">Kills</span>
            </div>
          )}
          {counts.death > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Skull className="h-3.5 w-3.5 text-destructive" />
              <span className="text-destructive font-medium">{counts.death}</span>
              <span className="text-muted-foreground">Deaths</span>
            </div>
          )}
          {counts.highlight > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Star className="h-3.5 w-3.5 text-vantage-warning" />
              <span className="text-vantage-warning font-medium">{counts.highlight}</span>
              <span className="text-muted-foreground">Highlights</span>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          <div className="space-y-0.5">
            {items.map((annotation) => (
              <HighlightItem
                key={annotation.id}
                annotation={annotation}
                isActive={annotation.id === activeItemId}
                onClick={() => handleItemClick(annotation)}
                onDelete={onAnnotationDelete ? () => onAnnotationDelete(annotation.id) : undefined}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
});
