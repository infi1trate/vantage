import { useState, useMemo } from "react";
import { Annotation, VoiceNote } from "@/lib/captures";
import { AnnotationSuggestion } from "./SuggestionMarkers";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CoachSection } from "./rail/CoachSection";
import { AnnotationsSection } from "./rail/AnnotationsSection";
import { CommentsSection } from "./rail/CommentsSection";
import { HighlightsSection } from "./rail/HighlightsSection";
import { 
  Brain, 
  Bookmark, 
  MessageSquare, 
  Star,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type RailSection = "coach" | "annotations" | "comments" | "highlights";

interface SessionRightRailProps {
  sessionId: string;
  currentTime: number;
  annotations: Annotation[];
  voiceNotes: VoiceNote[];
  onAnnotationClick?: (annotation: Annotation) => void;
  onVoiceNoteClick?: (voiceNote: VoiceNote) => void;
  onMarkerClick: (time: number) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  // AI Coach
  suggestions?: AnnotationSuggestion[];
  onSuggestionAccept?: (suggestion: AnnotationSuggestion) => void;
  onSuggestionDismiss?: (suggestionId: string) => void;
  onGenerateSuggestions?: () => void;
  isLoadingSuggestions?: boolean;
  coachError?: string | null;
  // Comments (optional feature flag)
  commentsEnabled?: boolean;
  onSeekTo?: (time: number) => void;
}

export function SessionRightRail({
  sessionId,
  currentTime,
  annotations,
  voiceNotes,
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
  commentsEnabled = false,
  onSeekTo,
}: SessionRightRailProps) {
  const [activeSection, setActiveSection] = useState<RailSection>("coach");

  // Count highlights specifically (kill, death, highlight types)
  const highlightCount = useMemo(() => {
    return annotations.filter(a => 
      ["kill", "death", "highlight"].includes(a.annotation_type)
    ).length;
  }, [annotations]);

  // Count notes/markers (non-highlight annotations + voice notes)
  const annotationCount = useMemo(() => {
    return annotations.filter(a => 
      !["kill", "death", "highlight"].includes(a.annotation_type)
    ).length + voiceNotes.length;
  }, [annotations, voiceNotes]);

  // Determine coach state for indicator
  const coachHasContent = suggestions.length > 0;
  const coachState = useMemo(() => {
    if (coachError) return "failed";
    if (isLoadingSuggestions) return "running";
    if (coachHasContent) return "complete";
    return "idle";
  }, [coachError, isLoadingSuggestions, coachHasContent]);

  // Determine which tabs to show
  const tabs: Array<{
    id: RailSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    badge?: "new" | "loading" | "error";
  }> = [
    { 
      id: "coach", 
      label: "Coach", 
      icon: Brain,
      count: suggestions.length,
      badge: coachState === "running" ? "loading" : coachState === "complete" ? "new" : undefined,
    },
    { 
      id: "annotations", 
      label: "Notes", 
      icon: Bookmark,
      count: annotationCount,
    },
    { 
      id: "highlights", 
      label: "Highlights", 
      icon: Star,
      count: highlightCount,
    },
  ];

  // Conditionally add comments tab
  if (commentsEnabled) {
    tabs.splice(2, 0, {
      id: "comments",
      label: "Comments",
      icon: MessageSquare,
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <Tabs 
        value={activeSection} 
        onValueChange={(v) => setActiveSection(v as RailSection)} 
        className="flex flex-col h-full"
      >
        <div className="shrink-0 border-b border-border/30 px-2 pt-2">
          <TabsList className={cn(
            "grid w-full h-9",
            commentsEnabled ? "grid-cols-4" : "grid-cols-3"
          )}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger 
                  key={tab.id}
                  value={tab.id} 
                  className="text-xs gap-1 px-2 data-[state=active]:bg-background"
                >
                  {tab.badge === "loading" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">{tab.label}</span>
                  {(tab.count !== undefined && tab.count > 0) && (
                    <Badge 
                      variant={tab.badge === "new" ? "default" : "secondary"} 
                      className={cn(
                        "text-[10px] px-1 py-0 h-4 min-w-4 ml-0.5",
                        tab.badge === "new" && "bg-primary text-primary-foreground"
                      )}
                    >
                      {tab.count}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Tab content */}
        <TabsContent value="coach" className="flex-1 mt-0 overflow-hidden data-[state=inactive]:hidden">
          <CoachSection
            annotations={annotations}
            voiceNotes={voiceNotes}
            currentTime={currentTime}
            onMarkerClick={onMarkerClick}
            suggestions={suggestions}
            onSuggestionAccept={onSuggestionAccept}
            onSuggestionDismiss={onSuggestionDismiss}
            onGenerateSuggestions={onGenerateSuggestions}
            isLoadingSuggestions={isLoadingSuggestions}
            coachError={coachError}
          />
        </TabsContent>

        <TabsContent value="annotations" className="flex-1 mt-0 overflow-hidden data-[state=inactive]:hidden">
          <AnnotationsSection
            annotations={annotations.filter(a => 
              !["kill", "death", "highlight"].includes(a.annotation_type)
            )}
            voiceNotes={voiceNotes}
            currentTime={currentTime}
            onAnnotationClick={onAnnotationClick}
            onVoiceNoteClick={onVoiceNoteClick}
            onMarkerClick={onMarkerClick}
            onAnnotationDelete={onAnnotationDelete}
          />
        </TabsContent>

        {commentsEnabled && (
          <TabsContent value="comments" className="flex-1 mt-0 overflow-hidden data-[state=inactive]:hidden">
            <CommentsSection
              sessionId={sessionId}
              currentTime={currentTime}
              onSeekTo={onSeekTo || onMarkerClick}
            />
          </TabsContent>
        )}

        <TabsContent value="highlights" className="flex-1 mt-0 overflow-hidden data-[state=inactive]:hidden">
          <HighlightsSection
            annotations={annotations.filter(a => 
              ["kill", "death", "highlight"].includes(a.annotation_type)
            )}
            currentTime={currentTime}
            onAnnotationClick={onAnnotationClick}
            onMarkerClick={onMarkerClick}
            onAnnotationDelete={onAnnotationDelete}
          />
        </TabsContent>
      </Tabs>

      {/* Sync indicator - show when Coach is running but user is on another tab */}
      {activeSection !== "coach" && isLoadingSuggestions && (
        <div className="shrink-0 px-4 py-2 border-t border-border/30 bg-primary/5">
          <div className="flex items-center justify-center gap-2 text-[11px] text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Coach analyzing...</span>
          </div>
        </div>
      )}
    </div>
  );
}
