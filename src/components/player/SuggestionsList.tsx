import { AnnotationSuggestion } from "./SuggestionMarkers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Crosshair,
  Skull,
  Swords,
  Star,
  Check,
  X,
  Sparkles,
  Loader2,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SuggestionsListProps {
  suggestions: AnnotationSuggestion[];
  onAccept: (suggestion: AnnotationSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
  onSeek: (time: number) => void;
  onGenerateSuggestions: () => void;
  isLoading: boolean;
  currentTime: number;
}

const SUGGESTION_ICONS: Record<AnnotationSuggestion["suggestion_type"], React.ReactNode> = {
  kill: <Crosshair className="h-3.5 w-3.5" />,
  death: <Skull className="h-3.5 w-3.5" />,
  fight_cluster: <Swords className="h-3.5 w-3.5" />,
  highlight: <Star className="h-3.5 w-3.5" />,
};

const SUGGESTION_COLORS: Record<AnnotationSuggestion["suggestion_type"], string> = {
  kill: "text-vantage-success bg-vantage-success/10",
  death: "text-destructive bg-destructive/10",
  fight_cluster: "text-vantage-purple bg-vantage-purple/10",
  highlight: "text-vantage-warning bg-vantage-warning/10",
};

const SUGGESTION_LABELS: Record<AnnotationSuggestion["suggestion_type"], string> = {
  kill: "Kill",
  death: "Death",
  fight_cluster: "Fight Cluster",
  highlight: "Highlight",
};

export function SuggestionsList({
  suggestions,
  onAccept,
  onDismiss,
  onSeek,
  onGenerateSuggestions,
  isLoading,
  currentTime,
}: SuggestionsListProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Empty state
  if (suggestions.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Wand2 className="h-7 w-7 text-muted-foreground" />
        </div>
        <h4 className="text-sm font-medium mb-2">Get Annotation Suggestions</h4>
        <p className="text-xs text-muted-foreground mb-4 max-w-xs">
          AI will analyze your session and suggest potential kills, deaths, fight clusters, and highlights to annotate.
        </p>
        <Button onClick={onGenerateSuggestions} disabled={isLoading}>
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Suggestions
        </Button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">
          Analyzing session...
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Looking for kills, deaths, and highlights
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Suggestions</span>
          <Badge variant="secondary" className="text-xs">
            {suggestions.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onGenerateSuggestions}
          disabled={isLoading}
          className="h-7 text-xs"
        >
          Refresh
        </Button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {suggestions.map((suggestion) => {
            const isActive = Math.abs(currentTime - suggestion.timestamp_seconds) < 0.5;
            const typeColor = SUGGESTION_COLORS[suggestion.suggestion_type];
            const icon = SUGGESTION_ICONS[suggestion.suggestion_type];
            const label = SUGGESTION_LABELS[suggestion.suggestion_type];

            return (
              <Card
                key={suggestion.id}
                className={cn(
                  "p-3 border transition-colors cursor-pointer",
                  "hover:bg-muted/30",
                  isActive && "border-primary bg-primary/5"
                )}
                onClick={() => onSeek(suggestion.timestamp_seconds)}
              >
                <div className="flex items-start gap-2.5">
                  {/* Icon */}
                  <div className={cn("p-1.5 rounded shrink-0", typeColor)}>
                    {icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-medium">{label}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
                        <Sparkles className="h-2 w-2" />
                        Suggested
                      </Badge>
                    </div>
                    <p className="text-sm truncate">{suggestion.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatTime(suggestion.timestamp_seconds)}
                      {suggestion.end_timestamp_seconds && ` – ${formatTime(suggestion.end_timestamp_seconds)}`}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-2.5 ml-8">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(suggestion.id);
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAccept(suggestion);
                    }}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Accept
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer hint */}
      <div className="shrink-0 p-2 border-t border-border/30 text-center">
        <p className="text-[11px] text-muted-foreground">
          Accepting converts suggestion to annotation
        </p>
      </div>
    </div>
  );
}
