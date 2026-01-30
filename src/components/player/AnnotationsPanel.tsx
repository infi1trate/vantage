import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Annotation, VoiceNote, createAnnotation } from "@/lib/captures";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  X,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type PanelMode = "list" | "note" | "voice" | "drawer";

interface AnnotationsPanelProps {
  sessionId: string;
  currentTime: number;
  annotations: Annotation[];
  voiceNotes: VoiceNote[];
  onAnnotationCreated: (annotation: Annotation) => void;
  onAnnotationClick?: (annotation: Annotation) => void;
  onMarkerClick: (time: number) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  mode?: PanelMode;
  onModeChange?: (mode: PanelMode) => void;
  pendingTime?: number;
  pendingEndTime?: number;
}

const MARKER_TYPES = [
  { type: "marker" as const, label: "Tag", icon: Bookmark, color: "text-primary", bg: "bg-primary/10" },
  { type: "kill" as const, label: "Kill", icon: Target, color: "text-vantage-success", bg: "bg-vantage-success/10" },
  { type: "death" as const, label: "Death", icon: Skull, color: "text-destructive", bg: "bg-destructive/10" },
  { type: "highlight" as const, label: "Highlight", icon: Star, color: "text-vantage-warning", bg: "bg-vantage-warning/10" },
  { type: "objective" as const, label: "Objective", icon: Flag, color: "text-accent", bg: "bg-accent/10" },
];

export function AnnotationsPanel({
  sessionId,
  currentTime,
  annotations,
  voiceNotes,
  onAnnotationCreated,
  onAnnotationClick,
  onMarkerClick,
  onAnnotationDelete,
  mode = "list",
  onModeChange,
  pendingTime,
  pendingEndTime,
}: AnnotationsPanelProps) {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedType, setSelectedType] = useState<Annotation["annotation_type"]>("marker");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Track if we opened via floating bar
  const activeTime = pendingTime ?? currentTime;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleQuickAdd = useCallback(async (type: Annotation["annotation_type"]) => {
    if (!user) return;
    
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
      toast.error("Failed to add marker");
    }
  }, [user, sessionId, currentTime, onAnnotationCreated, onAnnotationDelete]);

  const handleCreate = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    
    try {
      const annotation = await createAnnotation(
        sessionId,
        user.id,
        currentTime,
        selectedType,
        title || undefined,
        notes || undefined
      );
      onAnnotationCreated(annotation);
      toast.success("Marker added");
      setIsCreating(false);
      setTitle("");
      setNotes("");
    } catch (error) {
      toast.error("Failed to add marker");
    } finally {
      setSaving(false);
    }
  }, [user, sessionId, currentTime, selectedType, title, notes, onAnnotationCreated]);

  const getTypeConfig = (type: Annotation["annotation_type"]) => {
    return MARKER_TYPES.find(t => t.type === type) || MARKER_TYPES[0];
  };

  // Combine all markers
  const allMarkers = [
    ...annotations.map(a => ({ id: a.id, time: a.timestamp_seconds, type: "annotation" as const, data: a })),
    ...voiceNotes.map(v => ({ id: v.id, time: v.timestamp_seconds, type: "voice" as const, data: v })),
  ].sort((a, b) => a.time - b.time);

  // Handle note mode submission
  const handleNoteSubmit = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    
    try {
      const annotation = await createAnnotation(
        sessionId,
        user.id,
        activeTime,
        "note",
        title || undefined,
        notes || undefined
      );
      onAnnotationCreated(annotation);
      toast.success("Note added");
      setTitle("");
      setNotes("");
      onModeChange?.("list");
    } catch (error) {
      toast.error("Failed to add note");
    } finally {
      setSaving(false);
    }
  }, [user, sessionId, activeTime, title, notes, onAnnotationCreated, onModeChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Note creation mode */}
      {mode === "note" && (
        <div className="shrink-0 p-4 border-b border-border/30 bg-muted/30 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium">
              Add note @ {formatTime(activeTime)}
              {pendingEndTime && ` – ${formatTime(pendingEndTime)}`}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              onClick={() => onModeChange?.("list")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mb-2 h-8 text-sm bg-background"
            autoFocus
          />
          <Textarea
            placeholder="Write your note..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mb-3 text-sm bg-background resize-none"
            rows={4}
          />
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => onModeChange?.("list")}
            >
              Cancel
            </Button>
            <Button 
              size="sm" 
              className="flex-1" 
              onClick={handleNoteSubmit} 
              disabled={saving || (!title && !notes)}
            >
              {saving ? "Saving..." : "Add Note"}
            </Button>
          </div>
        </div>
      )}

      {/* Voice recording mode */}
      {mode === "voice" && (
        <div className="shrink-0 p-4 border-b border-border/30 bg-muted/30 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium">
              Voice note @ {formatTime(activeTime)}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              onClick={() => onModeChange?.("list")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4 animate-pulse">
              <Mic className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">Voice recording coming soon</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onModeChange?.("list")}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Header - only show in list mode */}
      {mode === "list" && (
        <div className="shrink-0 px-4 py-3 border-b border-border/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold tracking-tight">Annotations</h2>
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              {annotations.length + voiceNotes.length} markers
            </span>
          </div>
        </div>
      )}

      {/* Create form drawer */}
      {isCreating && (
        <div className="shrink-0 p-4 border-b border-border/30 bg-muted/30 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium">New marker @ {formatTime(currentTime)}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsCreating(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Type selection */}
          <div className="flex gap-1 mb-3">
            {MARKER_TYPES.map((m) => (
              <Button
                key={m.type}
                variant={selectedType === m.type ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedType(m.type)}
              >
                <m.icon className={cn("h-4 w-4", selectedType === m.type ? "" : m.color)} />
              </Button>
            ))}
          </div>

          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mb-2 h-8 text-sm bg-background"
          />
          <Textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mb-3 text-sm bg-background resize-none"
            rows={2}
          />
          <Button size="sm" className="w-full" onClick={handleCreate} disabled={saving}>
            {saving ? "Saving..." : "Add Marker"}
          </Button>
        </div>
      )}

      {/* Markers list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {allMarkers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bookmark className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No annotations yet</p>
              <p className="text-xs mt-1 opacity-70">Tag key moments as you review</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {allMarkers.map((marker) => {
                const isNearCurrent = Math.abs(marker.time - currentTime) < 2;

                if (marker.type === "annotation") {
                  const annotation = marker.data as Annotation;
                  const config = getTypeConfig(annotation.annotation_type);
                  
                  return (
                    <button
                      key={marker.id}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all group",
                        isNearCurrent 
                          ? "bg-primary/10 border border-primary/20" 
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => onAnnotationClick ? onAnnotationClick(annotation) : onMarkerClick(annotation.timestamp_seconds)}
                    >
                      <div className={cn("p-1.5 rounded", config.bg)}>
                        <config.icon className={cn("h-4 w-4", config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-mono tabular-nums",
                            isNearCurrent ? "text-primary" : "text-muted-foreground"
                          )}>
                            {formatTime(annotation.timestamp_seconds)}
                          </span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1 opacity-70">
                            {config.label}
                          </Badge>
                        </div>
                        {annotation.title && (
                          <p className="text-sm font-medium truncate mt-0.5">{annotation.title}</p>
                        )}
                        {annotation.content && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{annotation.content}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onAnnotationDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAnnotationDelete(annotation.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </Button>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                } else {
                  const voiceNote = marker.data as VoiceNote;
                  
                  return (
                    <button
                      key={marker.id}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                        isNearCurrent 
                          ? "bg-accent/10 border border-accent/20" 
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => onMarkerClick(voiceNote.timestamp_seconds)}
                    >
                      <div className="p-1.5 rounded bg-accent/10">
                        <Mic className="h-4 w-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-mono tabular-nums",
                            isNearCurrent ? "text-accent" : "text-muted-foreground"
                          )}>
                            {formatTime(voiceNote.timestamp_seconds)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {voiceNote.duration_seconds.toFixed(1)}s
                          </span>
                        </div>
                        {voiceNote.transcription ? (
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                            {voiceNote.transcription}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground/50 italic mt-0.5">
                            Voice memo
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
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
