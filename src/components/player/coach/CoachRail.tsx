import { useState, useMemo } from "react";
import { Annotation, VoiceNote } from "@/lib/captures";
import { AnnotationSuggestion } from "../SuggestionMarkers";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Brain, 
  Bookmark,
  RefreshCw,
  Loader2,
  Target,
  Skull,
  Star,
  Flag,
  Mic,
  FileText,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  CoachState, 
  CoachNote, 
  CoachSummary,
  suggestionToCoachNote,
  generateClientSummary,
} from "./types";
import { CoachSummaryCard } from "./CoachSummaryCard";
import { CoachNoteCard } from "./CoachNoteCard";
import { CoachEmptyState } from "./CoachEmptyState";
import { CoachLoadingState } from "./CoachLoadingState";
import { CoachErrorState } from "./CoachErrorState";

interface CoachRailProps {
  annotations: Annotation[];
  voiceNotes: VoiceNote[];
  currentTime: number;
  onAnnotationClick?: (annotation: Annotation) => void;
  onVoiceNoteClick?: (voiceNote: VoiceNote) => void;
  onMarkerClick: (time: number) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  // AI Suggestions / Coach
  suggestions?: AnnotationSuggestion[];
  onSuggestionAccept?: (suggestion: AnnotationSuggestion) => void;
  onSuggestionDismiss?: (suggestionId: string) => void;
  onGenerateSuggestions?: () => void;
  isLoadingSuggestions?: boolean;
  coachError?: string | null;
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

export function CoachRail({
  annotations,
  voiceNotes,
  currentTime,
  onAnnotationClick,
  onVoiceNoteClick,
  onMarkerClick,
  onAnnotationDelete,
  suggestions = [],
  onSuggestionAccept,
  onSuggestionDismiss,
  onGenerateSuggestions,
  isLoadingSuggestions = false,
  coachError,
}: CoachRailProps) {
  const [activeTab, setActiveTab] = useState<"coach" | "notes">("coach");

  // Derive coach state from props
  const coachState: CoachState = useMemo(() => {
    if (coachError) return "failed";
    if (isLoadingSuggestions) return "running";
    if (suggestions.length > 0) return "complete";
    return "not_run";
  }, [coachError, isLoadingSuggestions, suggestions.length]);

  // Convert suggestions to coach notes
  const coachNotes: CoachNote[] = useMemo(() => {
    return suggestions.map(suggestionToCoachNote);
  }, [suggestions]);

  // Generate client-side summary
  const coachSummary: CoachSummary | null = useMemo(() => {
    return generateClientSummary(coachNotes);
  }, [coachNotes]);

  // Find active coach note based on current playback time
  const activeNoteId = useMemo(() => {
    const tolerance = 0.5;
    const active = coachNotes.find(note => {
      if (note.end_timestamp_seconds) {
        return currentTime >= note.timestamp_seconds - tolerance && 
               currentTime <= note.end_timestamp_seconds + tolerance;
      }
      return Math.abs(currentTime - note.timestamp_seconds) <= tolerance;
    });
    return active?.id;
  }, [coachNotes, currentTime]);

  // Manual annotations (user's own markers/highlights/notes)
  const manualItems = useMemo(() => {
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

  // Find active manual item
  const activeManualId = useMemo(() => {
    const tolerance = 0.5;
    const active = manualItems.find(item => {
      if (item.endTime) {
        return currentTime >= item.time - tolerance && currentTime <= item.endTime + tolerance;
      }
      return Math.abs(currentTime - item.time) <= tolerance;
    });
    return active?.id;
  }, [manualItems, currentTime]);

  const handleItemClick = (item: typeof manualItems[0]) => {
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

  const getItemSnippet = (item: typeof manualItems[0]): string | null => {
    if (item.type === "annotation") {
      const a = item.data as Annotation;
      return a.title || a.content || null;
    } else {
      const v = item.data as VoiceNote;
      return v.transcription || null;
    }
  };

  const handleAcceptNote = (note: CoachNote) => {
    const suggestion = suggestions.find(s => s.id === note.id);
    if (suggestion && onSuggestionAccept) {
      onSuggestionAccept(suggestion);
    }
  };

  const handleDismissNote = (noteId: string) => {
    if (onSuggestionDismiss) {
      onSuggestionDismiss(noteId);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">Coach</h2>
          </div>
          
          {/* Coach CTA based on state */}
          {coachState === "complete" && onGenerateSuggestions && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={onGenerateSuggestions}
              disabled={isLoadingSuggestions}
            >
              <RefreshCw className="h-3 w-3" />
              Re-run
            </Button>
          )}
        </div>

        {/* Primary CTA for not_run state */}
        {coachState === "not_run" && onGenerateSuggestions && (
          <Button
            className="w-full mt-3"
            onClick={onGenerateSuggestions}
            disabled={isLoadingSuggestions}
          >
            <Brain className="h-4 w-4 mr-2" />
            Run Coach Review
          </Button>
        )}
      </div>

      {/* Coach State Content */}
      {coachState === "not_run" && (
        <CoachEmptyState 
          onRunCoach={() => onGenerateSuggestions?.()} 
          disabled={isLoadingSuggestions} 
        />
      )}

      {coachState === "running" && (
        <CoachLoadingState currentStep={1} />
      )}

      {coachState === "failed" && (
        <CoachErrorState 
          error={coachError || undefined}
          onRetry={() => onGenerateSuggestions?.()}
          disabled={isLoadingSuggestions}
        />
      )}

      {coachState === "complete" && (
        <>
          {/* Tabs for Coach Notes vs Manual Notes */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "coach" | "notes")} className="flex flex-col flex-1 min-h-0">
            <TabsList className="grid w-full grid-cols-2 mx-3 mt-2" style={{ width: 'calc(100% - 1.5rem)' }}>
              <TabsTrigger value="coach" className="text-xs gap-1">
                <Brain className="h-3 w-3" />
                Coach Notes
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 min-w-4 ml-1">
                  {coachNotes.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="notes" className="text-xs gap-1">
                <Bookmark className="h-3 w-3" />
                Your Notes
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 min-w-4 ml-1">
                  {manualItems.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Coach Notes Tab */}
            <TabsContent value="coach" className="flex-1 mt-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-3">
                  {/* Summary Card */}
                  {coachSummary && (
                    <CoachSummaryCard 
                      summary={coachSummary} 
                      isPlaceholder={coachNotes.some(n => n.is_placeholder)}
                    />
                  )}

                  {/* Coach Notes List */}
                  {coachNotes.map((note) => (
                    <CoachNoteCard
                      key={note.id}
                      note={note}
                      isActive={note.id === activeNoteId}
                      onSeek={onMarkerClick}
                      onAccept={handleAcceptNote}
                      onDismiss={handleDismissNote}
                    />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Manual Notes Tab */}
            <TabsContent value="notes" className="flex-1 mt-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-2">
                  {manualItems.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <Bookmark className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">No manual notes yet</p>
                      <p className="text-xs mt-1 opacity-70">
                        Tag key moments as you review
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {manualItems.map((item) => {
                        const config = getItemConfig(item.eventType);
                        const Icon = config.icon;
                        const isActive = item.id === activeManualId;
                        const snippet = getItemSnippet(item);
                        
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
            </TabsContent>
          </Tabs>

          {/* Sync indicator */}
          {(activeNoteId || activeManualId) && (
            <div className="shrink-0 px-4 py-2 border-t border-border/30 bg-primary/5">
              <p className="text-[11px] text-primary text-center font-medium">
                ● Synced to playback
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
