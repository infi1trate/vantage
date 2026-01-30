import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Target, 
  Skull, 
  Star, 
  Swords,
  Brain,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Lightbulb,
  Dumbbell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CoachNote, CoachConfidence } from "./types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CoachNoteCardProps {
  note: CoachNote;
  isActive?: boolean;
  onSeek?: (time: number) => void;
  onAccept?: (note: CoachNote) => void;
  onDismiss?: (noteId: string) => void;
}

const TYPE_CONFIG: Record<CoachNote["type"], { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  color: string; 
  bg: string;
}> = {
  kill: { label: "Kill", icon: Target, color: "text-vantage-success", bg: "bg-vantage-success/10" },
  death: { label: "Death", icon: Skull, color: "text-destructive", bg: "bg-destructive/10" },
  fight_cluster: { label: "Fight", icon: Swords, color: "text-vantage-purple", bg: "bg-vantage-purple/10" },
  highlight: { label: "Highlight", icon: Star, color: "text-vantage-warning", bg: "bg-vantage-warning/10" },
};

const CONFIDENCE_STYLES: Record<CoachConfidence, { border: string; text: string }> = {
  high: { border: "border-vantage-success/30", text: "text-vantage-success" },
  medium: { border: "border-yellow-500/30", text: "text-yellow-500" },
  low: { border: "border-muted", text: "text-muted-foreground" },
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function CoachNoteCard({ 
  note, 
  isActive, 
  onSeek, 
  onAccept, 
  onDismiss 
}: CoachNoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = TYPE_CONFIG[note.type];
  const Icon = config.icon;
  const confidenceStyle = CONFIDENCE_STYLES[note.confidence];

  return (
    <Card
      className={cn(
        "border transition-all",
        isActive && "border-primary bg-primary/5 shadow-sm",
        !isActive && "hover:bg-muted/30",
        note.is_placeholder && "border-dashed"
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        {/* Header - always visible */}
        <div 
          className="p-3 cursor-pointer"
          onClick={() => onSeek?.(note.timestamp_seconds)}
        >
          <div className="flex items-start gap-2.5">
            {/* Type Icon */}
            <div className={cn("p-1.5 rounded shrink-0", config.bg)}>
              <Icon className={cn("h-3.5 w-3.5", config.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                  <Brain className="h-2.5 w-2.5" />
                  Coach
                </Badge>
                {note.is_placeholder && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
                    Preview
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium truncate">{note.title}</p>
              <button
                className="text-xs text-primary hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek?.(note.timestamp_seconds);
                }}
              >
                {formatTime(note.timestamp_seconds)}
                {note.end_timestamp_seconds && ` – ${formatTime(note.end_timestamp_seconds)}`}
              </button>

              {/* Preview of coaching content */}
              {!isExpanded && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                  <span className="font-medium">Try: </span>
                  {note.try_this}
                </p>
              )}
            </div>

            {/* Expand toggle */}
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 border-t border-border/20 pt-3">
            {/* What Happened */}
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">What happened</span>
              <p className="text-sm">{note.what_happened}</p>
            </div>

            {/* Why It Mattered */}
            {note.why_it_mattered && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Why it mattered</span>
                <p className="text-sm">{note.why_it_mattered}</p>
              </div>
            )}

            {/* Try This */}
            <div className="space-y-1 p-2 rounded-md bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-primary">Try this next time</span>
              </div>
              <p className="text-sm">{note.try_this}</p>
            </div>

            {/* Drill */}
            {note.drill && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Dumbbell className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Practice drill</span>
                </div>
                <p className="text-sm text-muted-foreground">{note.drill}</p>
              </div>
            )}

            {/* Confidence */}
            <div className={cn(
              "flex items-center justify-between p-2 rounded-md border",
              confidenceStyle.border
            )}>
              <div className="flex items-center gap-1.5">
                <span className={cn("text-xs font-medium", confidenceStyle.text)}>
                  {note.confidence === "high" && "High confidence"}
                  {note.confidence === "medium" && "Medium confidence"}
                  {note.confidence === "low" && "Exploratory insight"}
                </span>
              </div>
              {note.confidence_reason && (
                <span className="text-[10px] text-muted-foreground max-w-[60%] text-right">
                  {note.confidence_reason}
                </span>
              )}
            </div>

            {/* Actions */}
            {(onAccept || onDismiss) && (
              <div className="flex gap-2 pt-1">
                {onDismiss && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(note.id);
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Dismiss
                  </Button>
                )}
                {onAccept && (
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAccept(note);
                    }}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Accept
                  </Button>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
