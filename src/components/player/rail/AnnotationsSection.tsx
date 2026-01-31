import { useMemo, memo, useCallback } from "react";
import { Annotation, VoiceNote } from "@/lib/captures";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  Bookmark,
  FileText,
  Mic,
  ChevronRight,
  Trash2,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AnnotationsSectionProps {
  annotations: Annotation[];
  voiceNotes: VoiceNote[];
  currentTime: number;
  onAnnotationClick?: (annotation: Annotation) => void;
  onVoiceNoteClick?: (voiceNote: VoiceNote) => void;
  onMarkerClick: (time: number) => void;
  onAnnotationDelete?: (annotationId: string) => void;
}

const EVENT_CONFIG: Record<string, { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  color: string; 
  bg: string 
}> = {
  marker: { label: "Marker", icon: Flag, color: "text-primary", bg: "bg-primary/10" },
  note: { label: "Note", icon: FileText, color: "text-accent", bg: "bg-accent/10" },
  objective: { label: "Objective", icon: Bookmark, color: "text-muted-foreground", bg: "bg-muted/30" },
  voice: { label: "Voice", icon: Mic, color: "text-accent", bg: "bg-accent/10" },
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatRange = (start: number, end: number) => {
  return `${formatTime(start)} – ${formatTime(end)}`;
};

// Item type for combined list
type CombinedItem = {
  id: string;
  type: "annotation" | "voice";
  time: number;
  endTime?: number;
  eventType: string;
  data: Annotation | VoiceNote;
};

// Memoized list item
const AnnotationItem = memo(function AnnotationItem({
  item,
  isActive,
  onClick,
  onDelete,
}: {
  item: CombinedItem;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const config = EVENT_CONFIG[item.eventType] || EVENT_CONFIG.marker;
  const Icon = config.icon;
  
  const snippet = useMemo(() => {
    if (item.type === "annotation") {
      const a = item.data as Annotation;
      return a.title || a.content || null;
    } else {
      const v = item.data as VoiceNote;
      return v.transcription || null;
    }
  }, [item]);
  
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
            isActive ? "text-primary" : "text-muted-foreground"
          )}>
            {config.label}
          </span>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            {item.endTime 
              ? formatRange(item.time, item.endTime)
              : formatTime(item.time)
            }
          </span>
        </div>
        
        {snippet && (
          <p className={cn(
            "text-sm truncate mt-0.5",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}>
            {snippet}
          </p>
        )}
      </div>
      
      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1">
        {onDelete && item.type === "annotation" && (
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

export const AnnotationsSection = memo(function AnnotationsSection({
  annotations,
  voiceNotes,
  currentTime,
  onAnnotationClick,
  onVoiceNoteClick,
  onMarkerClick,
  onAnnotationDelete,
}: AnnotationsSectionProps) {
  // Combine and sort all items
  const items = useMemo<CombinedItem[]>(() => {
    const combined: CombinedItem[] = [
      ...annotations.map(a => ({
        id: a.id,
        type: "annotation" as const,
        time: a.timestamp_seconds,
        endTime: a.end_timestamp_seconds || undefined,
        eventType: a.annotation_type,
        data: a,
      })),
      ...voiceNotes.map(v => ({
        id: v.id,
        type: "voice" as const,
        time: v.timestamp_seconds,
        eventType: "voice",
        data: v,
      })),
    ];
    return combined.sort((a, b) => a.time - b.time);
  }, [annotations, voiceNotes]);

  // Find active item based on current playback time
  const activeItemId = useMemo(() => {
    const tolerance = 0.5;
    const active = items.find(item => {
      if (item.endTime) {
        return currentTime >= item.time - tolerance && currentTime <= item.endTime + tolerance;
      }
      return Math.abs(currentTime - item.time) <= tolerance;
    });
    return active?.id;
  }, [items, currentTime]);

  const handleItemClick = useCallback((item: CombinedItem) => {
    if (item.type === "annotation") {
      const annotation = item.data as Annotation;
      onAnnotationClick?.(annotation) ?? onMarkerClick(annotation.timestamp_seconds);
    } else {
      const voiceNote = item.data as VoiceNote;
      onVoiceNoteClick?.(voiceNote) ?? onMarkerClick(voiceNote.timestamp_seconds);
    }
  }, [onAnnotationClick, onVoiceNoteClick, onMarkerClick]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
          <Bookmark className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <h4 className="font-semibold mb-2">No notes yet</h4>
        <p className="text-sm text-muted-foreground max-w-xs">
          Add notes and voice memos as you review to capture your thoughts.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <div className="space-y-0.5">
          {items.map((item) => (
            <AnnotationItem
              key={item.id}
              item={item}
              isActive={item.id === activeItemId}
              onClick={() => handleItemClick(item)}
              onDelete={onAnnotationDelete ? () => onAnnotationDelete(item.id) : undefined}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
});
