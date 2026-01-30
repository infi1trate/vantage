import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Annotation, VoiceNote, createAnnotation } from "@/lib/captures";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Target, 
  Skull, 
  Star, 
  Flag, 
  Bookmark,
  Mic,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MarkerListProps {
  sessionId: string;
  currentTime: number;
  annotations: Annotation[];
  voiceNotes: VoiceNote[];
  onAnnotationCreated: (annotation: Annotation) => void;
  onMarkerClick: (time: number) => void;
  onAnnotationDelete?: (annotationId: string) => void;
}

const QUICK_TAGS = [
  { type: "marker" as const, label: "Tag", icon: Bookmark, color: "text-primary" },
  { type: "kill" as const, label: "Kill", icon: Target, color: "text-vantage-success" },
  { type: "death" as const, label: "Death", icon: Skull, color: "text-destructive" },
  { type: "highlight" as const, label: "Highlight", icon: Star, color: "text-vantage-warning" },
  { type: "objective" as const, label: "Objective", icon: Flag, color: "text-accent" },
];

export function MarkerList({
  sessionId,
  currentTime,
  annotations,
  voiceNotes,
  onAnnotationCreated,
  onMarkerClick,
  onAnnotationDelete,
}: MarkerListProps) {
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleQuickAdd = useCallback(async (type: Annotation["annotation_type"]) => {
    if (!user) return;
    setAdding(true);
    
    try {
      const annotation = await createAnnotation(sessionId, user.id, currentTime, type);
      onAnnotationCreated(annotation);
      toast.success("Marker added", {
        action: {
          label: "Undo",
          onClick: () => onAnnotationDelete?.(annotation.id),
        },
      });
    } catch (error) {
      console.error("Error creating annotation:", error);
      toast.error("Failed to add marker");
    } finally {
      setAdding(false);
    }
  }, [user, sessionId, currentTime, onAnnotationCreated, onAnnotationDelete]);

  const getTypeConfig = (type: Annotation["annotation_type"]) => {
    return QUICK_TAGS.find(t => t.type === type) || QUICK_TAGS[0];
  };

  // Combine and sort all markers
  const allMarkers = [
    ...annotations.map(a => ({ 
      id: a.id, 
      time: a.timestamp_seconds, 
      type: "annotation" as const, 
      data: a 
    })),
    ...voiceNotes.map(v => ({ 
      id: v.id, 
      time: v.timestamp_seconds, 
      type: "voice" as const, 
      data: v 
    })),
  ].sort((a, b) => a.time - b.time);

  return (
    <div className="flex flex-col h-full">
      {/* Quick add bar */}
      <div className="p-3 border-b border-border/30">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-muted-foreground font-mono">
            @ {formatTime(currentTime)}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TAGS.map((tag) => (
            <Button
              key={tag.type}
              variant="outline"
              size="sm"
              className="h-7 px-2 gap-1"
              onClick={() => handleQuickAdd(tag.type)}
              disabled={adding}
            >
              <tag.icon className={cn("h-3 w-3", tag.color)} />
              <span className="text-xs">{tag.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Markers list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {allMarkers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bookmark className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No markers yet</p>
              <p className="text-xs mt-1">Add tags at key moments</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {allMarkers.map((marker) => {
                if (marker.type === "annotation") {
                  const annotation = marker.data as Annotation;
                  const config = getTypeConfig(annotation.annotation_type);
                  const isNearCurrent = Math.abs(annotation.timestamp_seconds - currentTime) < 2;
                  
                  return (
                    <button
                      key={marker.id}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors group",
                        isNearCurrent ? "bg-primary/10" : "hover:bg-muted/50"
                      )}
                      onClick={() => onMarkerClick(annotation.timestamp_seconds)}
                    >
                      <config.icon className={cn("h-4 w-4 shrink-0", config.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-primary">
                            {formatTime(annotation.timestamp_seconds)}
                          </span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {config.label}
                          </Badge>
                        </div>
                        {annotation.title && (
                          <p className="text-sm truncate mt-0.5">{annotation.title}</p>
                        )}
                      </div>
                      {onAnnotationDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAnnotationDelete(annotation.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </button>
                  );
                } else {
                  const voiceNote = marker.data as VoiceNote;
                  const isNearCurrent = Math.abs(voiceNote.timestamp_seconds - currentTime) < 2;
                  
                  return (
                    <button
                      key={marker.id}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors",
                        isNearCurrent ? "bg-accent/10" : "hover:bg-muted/50"
                      )}
                      onClick={() => onMarkerClick(voiceNote.timestamp_seconds)}
                    >
                      <Mic className="h-4 w-4 shrink-0 text-accent" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-primary">
                            {formatTime(voiceNote.timestamp_seconds)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {voiceNote.duration_seconds.toFixed(1)}s
                          </span>
                        </div>
                        {voiceNote.transcription ? (
                          <p className="text-sm truncate mt-0.5 text-muted-foreground">
                            {voiceNote.transcription}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground/50 italic mt-0.5">
                            Voice memo
                          </p>
                        )}
                      </div>
                    </button>
                  );
                }
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
