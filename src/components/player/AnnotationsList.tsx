import { useState, useMemo } from "react";
import { Annotation, VoiceNote } from "@/lib/captures";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Target, 
  Skull, 
  Star, 
  Flag, 
  Bookmark,
  Mic,
  FileText,
  ChevronRight,
  Trash2,
  ListFilter,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FilterType = "all" | "kill" | "death" | "highlight" | "note" | "voice";

interface AnnotationsListProps {
  annotations: Annotation[];
  voiceNotes: VoiceNote[];
  currentTime: number;
  onAnnotationClick?: (annotation: Annotation) => void;
  onVoiceNoteClick?: (voiceNote: VoiceNote) => void;
  onMarkerClick: (time: number) => void;
  onAnnotationDelete?: (annotationId: string) => void;
}

const FILTER_OPTIONS: { type: FilterType; label: string; icon?: React.ComponentType<{ className?: string }> }[] = [
  { type: "all", label: "All" },
  { type: "kill", label: "Kills", icon: Target },
  { type: "death", label: "Deaths", icon: Skull },
  { type: "highlight", label: "Highlights", icon: Star },
  { type: "note", label: "Notes", icon: FileText },
  { type: "voice", label: "Voice", icon: Mic },
];

const EVENT_CONFIG: Record<string, { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  color: string; 
  bg: string 
}> = {
  kill: { label: "Kill", icon: Target, color: "text-vantage-success", bg: "bg-vantage-success/10" },
  death: { label: "Death", icon: Skull, color: "text-destructive", bg: "bg-destructive/10" },
  highlight: { label: "Highlight", icon: Star, color: "text-vantage-warning", bg: "bg-vantage-warning/10" },
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

export function AnnotationsList({
  annotations,
  voiceNotes,
  currentTime,
  onAnnotationClick,
  onVoiceNoteClick,
  onMarkerClick,
  onAnnotationDelete,
}: AnnotationsListProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // Combine and sort all items
  const allItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: "annotation" | "voice";
      time: number;
      endTime?: number;
      eventType: string;
      data: Annotation | VoiceNote;
    }> = [
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
    return items.sort((a, b) => a.time - b.time);
  }, [annotations, voiceNotes]);

  // Filter items based on active filter
  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return allItems;
    if (activeFilter === "voice") return allItems.filter(i => i.type === "voice");
    return allItems.filter(i => i.type === "annotation" && i.eventType === activeFilter);
  }, [allItems, activeFilter]);

  // Get counts for filter badges
  const counts = useMemo(() => {
    const c: Record<FilterType, number> = {
      all: allItems.length,
      kill: annotations.filter(a => a.annotation_type === "kill").length,
      death: annotations.filter(a => a.annotation_type === "death").length,
      highlight: annotations.filter(a => a.annotation_type === "highlight").length,
      note: annotations.filter(a => a.annotation_type === "note").length,
      voice: voiceNotes.length,
    };
    return c;
  }, [allItems.length, annotations, voiceNotes.length]);

  // Find active item based on current playback time
  const activeItemId = useMemo(() => {
    const tolerance = 0.5;
    const active = filteredItems.find(item => {
      if (item.endTime) {
        return currentTime >= item.time - tolerance && currentTime <= item.endTime + tolerance;
      }
      return Math.abs(currentTime - item.time) <= tolerance;
    });
    return active?.id;
  }, [filteredItems, currentTime]);

  const handleItemClick = (item: typeof allItems[0]) => {
    if (item.type === "annotation") {
      const annotation = item.data as Annotation;
      onAnnotationClick?.(annotation) ?? onMarkerClick(annotation.timestamp_seconds);
    } else {
      const voiceNote = item.data as VoiceNote;
      onVoiceNoteClick?.(voiceNote) ?? onMarkerClick(voiceNote.timestamp_seconds);
    }
  };

  const getItemConfig = (eventType: string) => {
    return EVENT_CONFIG[eventType] || EVENT_CONFIG.marker;
  };

  const getItemSnippet = (item: typeof allItems[0]): string | null => {
    if (item.type === "annotation") {
      const a = item.data as Annotation;
      return a.title || a.content || null;
    } else {
      const v = item.data as VoiceNote;
      return v.transcription || null;
    }
  };

  const getItemDuration = (item: typeof allItems[0]): string | null => {
    if (item.type === "voice") {
      const v = item.data as VoiceNote;
      return `${v.duration_seconds.toFixed(1)}s`;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with count */}
      <div className="shrink-0 px-4 py-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-tight">Annotations</h2>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
            {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="shrink-0 px-3 py-2 border-b border-border/20 bg-muted/20">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {FILTER_OPTIONS.map((filter) => {
            const count = counts[filter.type];
            const isActive = activeFilter === filter.type;
            
            return (
              <button
                key={filter.type}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                onClick={() => setActiveFilter(filter.type)}
              >
                {filter.icon && <filter.icon className="h-3 w-3" />}
                <span>{filter.label}</span>
                {count > 0 && (
                  <span className={cn(
                    "text-[10px] px-1 py-0.5 rounded-sm min-w-[18px] text-center",
                    isActive ? "bg-primary-foreground/20" : "bg-muted"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bookmark className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">
                {activeFilter === "all" ? "No annotations yet" : `No ${activeFilter} annotations`}
              </p>
              <p className="text-xs mt-1 opacity-70">
                {activeFilter === "all" 
                  ? "Tag key moments as you review" 
                  : "Try a different filter"}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredItems.map((item) => {
                const config = getItemConfig(item.eventType);
                const Icon = config.icon;
                const isActive = item.id === activeItemId;
                const snippet = getItemSnippet(item);
                const duration = getItemDuration(item);
                
                return (
                  <button
                    key={item.id}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all group",
                      isActive 
                        ? "bg-primary/10 border border-primary/30 shadow-sm" 
                        : "hover:bg-muted/50 border border-transparent"
                    )}
                    onClick={() => handleItemClick(item)}
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
                      {/* Label + Timestamp */}
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
                        {duration && (
                          <span className="text-[10px] text-muted-foreground/70 bg-muted px-1 py-0.5 rounded">
                            {duration}
                          </span>
                        )}
                      </div>
                      
                      {/* Snippet */}
                      {snippet && (
                        <p className={cn(
                          "text-sm truncate mt-0.5",
                          isActive ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {snippet}
                        </p>
                      )}
                      {!snippet && item.type === "voice" && (
                        <p className="text-xs text-muted-foreground/50 italic mt-0.5">
                          Voice memo
                        </p>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="shrink-0 flex items-center gap-1">
                      {onAnnotationDelete && item.type === "annotation" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAnnotationDelete(item.id);
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
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer sync indicator */}
      {activeItemId && (
        <div className="shrink-0 px-4 py-2 border-t border-border/30 bg-primary/5">
          <p className="text-[11px] text-primary text-center font-medium">
            ● Synced to playback
          </p>
        </div>
      )}
    </div>
  );
}
