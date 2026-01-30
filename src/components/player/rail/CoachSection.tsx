import { useState, useMemo } from "react";
import { Annotation, VoiceNote } from "@/lib/captures";
import { AnnotationSuggestion } from "../SuggestionMarkers";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  Brain, 
  RefreshCw,
} from "lucide-react";
import { 
  CoachState, 
  CoachNote, 
  CoachSummary,
  suggestionToCoachNote,
  generateClientSummary,
} from "../coach/types";
import { CoachSummaryCard } from "../coach/CoachSummaryCard";
import { CoachNoteCard } from "../coach/CoachNoteCard";
import { CoachEmptyState } from "../coach/CoachEmptyState";
import { CoachLoadingState } from "../coach/CoachLoadingState";
import { CoachErrorState } from "../coach/CoachErrorState";

interface CoachSectionProps {
  annotations: Annotation[];
  voiceNotes: VoiceNote[];
  currentTime: number;
  onMarkerClick: (time: number) => void;
  // AI Coach
  suggestions?: AnnotationSuggestion[];
  onSuggestionAccept?: (suggestion: AnnotationSuggestion) => void;
  onSuggestionDismiss?: (suggestionId: string) => void;
  onGenerateSuggestions?: () => void;
  isLoadingSuggestions?: boolean;
  coachError?: string | null;
}

export function CoachSection({
  currentTime,
  onMarkerClick,
  suggestions = [],
  onSuggestionAccept,
  onSuggestionDismiss,
  onGenerateSuggestions,
  isLoadingSuggestions = false,
  coachError,
}: CoachSectionProps) {
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
      {/* Header with actions */}
      <div className="shrink-0 px-4 py-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">AI Coach</h2>
          </div>
          
          {/* Re-run button when complete */}
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

      {/* Content based on state */}
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
        <ScrollArea className="flex-1">
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
      )}

      {/* Sync indicator */}
      {coachState === "complete" && activeNoteId && (
        <div className="shrink-0 px-4 py-2 border-t border-border/30 bg-primary/5">
          <p className="text-[11px] text-primary text-center font-medium">
            ● Synced to playback
          </p>
        </div>
      )}
    </div>
  );
}
