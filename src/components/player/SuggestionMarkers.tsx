import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Crosshair,
  Skull,
  Swords,
  Star,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnnotationSuggestion {
  id: string;
  timestamp_seconds: number;
  end_timestamp_seconds?: number;
  suggestion_type: "kill" | "death" | "fight_cluster" | "highlight";
  title: string;
  reason: string;
  confidence: "high" | "medium" | "low";
}

interface SuggestionMarkersProps {
  suggestions: AnnotationSuggestion[];
  duration: number;
  onAccept: (suggestion: AnnotationSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
  onSeek: (time: number) => void;
}

const SUGGESTION_ICONS: Record<AnnotationSuggestion["suggestion_type"], React.ReactNode> = {
  kill: <Crosshair className="h-3 w-3" />,
  death: <Skull className="h-3 w-3" />,
  fight_cluster: <Swords className="h-3 w-3" />,
  highlight: <Star className="h-3 w-3" />,
};

const SUGGESTION_COLORS: Record<AnnotationSuggestion["suggestion_type"], string> = {
  kill: "border-vantage-success/50 bg-vantage-success/10 text-vantage-success",
  death: "border-destructive/50 bg-destructive/10 text-destructive",
  fight_cluster: "border-vantage-purple/50 bg-vantage-purple/10 text-vantage-purple",
  highlight: "border-vantage-warning/50 bg-vantage-warning/10 text-vantage-warning",
};

const SUGGESTION_LABELS: Record<AnnotationSuggestion["suggestion_type"], string> = {
  kill: "Kill",
  death: "Death",
  fight_cluster: "Fight",
  highlight: "Highlight",
};

export function SuggestionMarkers({
  suggestions,
  duration,
  onAccept,
  onDismiss,
  onSeek,
}: SuggestionMarkersProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (suggestions.length === 0) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {suggestions.map((suggestion) => {
        const position = (suggestion.timestamp_seconds / duration) * 100;
        const isExpanded = expandedId === suggestion.id;
        const typeColor = SUGGESTION_COLORS[suggestion.suggestion_type];
        const icon = SUGGESTION_ICONS[suggestion.suggestion_type];
        const label = SUGGESTION_LABELS[suggestion.suggestion_type];

        return (
          <div
            key={suggestion.id}
            className="absolute top-0 bottom-6 z-15"
            style={{ left: `${position}%` }}
          >
            {/* Subtle dashed marker line */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "absolute top-2 bottom-0 w-1 rounded-full transition-all",
                    "border border-dashed opacity-60 hover:opacity-100",
                    typeColor,
                    isExpanded && "opacity-100"
                  )}
                  style={{ transform: "translateX(-50%)" }}
                  onClick={() => {
                    setExpandedId(isExpanded ? null : suggestion.id);
                    onSeek(suggestion.timestamp_seconds);
                  }}
                >
                  {/* Sparkle indicator at top */}
                  <div className={cn(
                    "absolute -top-1 left-1/2 -translate-x-1/2",
                    "w-4 h-4 rounded-full flex items-center justify-center",
                    "border border-dashed",
                    typeColor
                  )}>
                    <Sparkles className="h-2.5 w-2.5" />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="flex items-center gap-1.5 mb-1">
                  {icon}
                  <span className="font-medium">{suggestion.title}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    Suggested
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatTime(suggestion.timestamp_seconds)}
                  {suggestion.end_timestamp_seconds && ` – ${formatTime(suggestion.end_timestamp_seconds)}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click to expand
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Expanded card */}
            {isExpanded && (
              <Card className={cn(
                "absolute top-0 left-2 w-56 p-3 z-50 animate-in fade-in-0 slide-in-from-left-2",
                "bg-popover border shadow-lg"
              )}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className={cn("p-1 rounded", typeColor)}>
                      {icon}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatTime(suggestion.timestamp_seconds)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 gap-0.5">
                    <Sparkles className="h-2.5 w-2.5" />
                    Suggested
                  </Badge>
                </div>

                <p className="text-sm mb-2">{suggestion.title}</p>
                <p className="text-xs text-muted-foreground mb-3">
                  {suggestion.reason}
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      onDismiss(suggestion.id);
                      setExpandedId(null);
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => {
                      onAccept(suggestion);
                      setExpandedId(null);
                    }}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Accept
                  </Button>
                </div>
              </Card>
            )}
          </div>
        );
      })}
    </>
  );
}
