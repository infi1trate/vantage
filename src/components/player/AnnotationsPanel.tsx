import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Annotation, VoiceNote, createAnnotation } from "@/lib/captures";
import { AnnotationsList } from "./AnnotationsList";
import { CoachRail } from "./coach";
import { AnnotationSuggestion } from "./SuggestionMarkers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Target, 
  Skull, 
  Star, 
  Flag, 
  Bookmark,
  Mic,
  X,
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
  // AI Suggestions
  suggestions?: AnnotationSuggestion[];
  onSuggestionAccept?: (suggestion: AnnotationSuggestion) => void;
  onSuggestionDismiss?: (suggestionId: string) => void;
  onGenerateSuggestions?: () => void;
  isLoadingSuggestions?: boolean;
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
  suggestions = [],
  onSuggestionAccept,
  onSuggestionDismiss,
  onGenerateSuggestions,
  isLoadingSuggestions = false,
}: AnnotationsPanelProps) {
  const { user } = useAuth();
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

  // List mode - use the new CoachRail component
  if (mode === "list") {
    return (
      <CoachRail
        annotations={annotations}
        voiceNotes={voiceNotes}
        currentTime={currentTime}
        onAnnotationClick={onAnnotationClick}
        onMarkerClick={onMarkerClick}
        onAnnotationDelete={onAnnotationDelete}
        suggestions={suggestions}
        onSuggestionAccept={onSuggestionAccept}
        onSuggestionDismiss={onSuggestionDismiss}
        onGenerateSuggestions={onGenerateSuggestions}
        isLoadingSuggestions={isLoadingSuggestions}
      />
    );
  }

  // Note creation mode
  if (mode === "note") {
    return (
      <div className="flex flex-col h-full">
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

        {/* Show list below */}
        <div className="flex-1 opacity-50">
          <AnnotationsList
            annotations={annotations}
            voiceNotes={voiceNotes}
            currentTime={currentTime}
            onAnnotationClick={onAnnotationClick}
            onMarkerClick={onMarkerClick}
            onAnnotationDelete={onAnnotationDelete}
          />
        </div>
      </div>
    );
  }

  // Voice recording mode
  if (mode === "voice") {
    return (
      <div className="flex flex-col h-full">
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

        {/* Show list below */}
        <div className="flex-1 opacity-50">
          <AnnotationsList
            annotations={annotations}
            voiceNotes={voiceNotes}
            currentTime={currentTime}
            onAnnotationClick={onAnnotationClick}
            onMarkerClick={onMarkerClick}
            onAnnotationDelete={onAnnotationDelete}
          />
        </div>
      </div>
    );
  }

  // Drawer mode is handled by parent component
  return null;
}
