import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Clock,
  Lightbulb,
  Target,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeedbackCardData {
  id: string;
  timestamp_seconds: number;
  type: "strength" | "improvement" | "pattern" | "intent";
  title: string;
  description: string;
  player_intent?: string;
  behavioral_indicator?: string;
  recommendation?: string;
  confidence: "high" | "medium" | "low";
}

interface FeedbackCardProps {
  card: FeedbackCardData;
  onSeekTo?: (time: number) => void;
}

const TYPE_CONFIG = {
  strength: {
    icon: CheckCircle,
    color: "text-vantage-success",
    bgColor: "bg-vantage-success/10",
    borderColor: "border-vantage-success/30",
    label: "Strength",
  },
  improvement: {
    icon: AlertTriangle,
    color: "text-vantage-warning",
    bgColor: "bg-vantage-warning/10",
    borderColor: "border-vantage-warning/30",
    label: "Area for Improvement",
  },
  pattern: {
    icon: TrendingUp,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    label: "Pattern Detected",
  },
  intent: {
    icon: MessageSquare,
    color: "text-accent",
    bgColor: "bg-accent/10",
    borderColor: "border-accent/30",
    label: "Intent Analysis",
  },
};

const CONFIDENCE_STYLES = {
  high: "bg-vantage-success/20 text-vantage-success border-vantage-success/30",
  medium: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  low: "bg-muted text-muted-foreground border-muted-foreground/30",
};

export function FeedbackCard({ card, onSeekTo }: FeedbackCardProps) {
  const config = TYPE_CONFIG[card.type];
  const Icon = config.icon;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className={cn("p-4 border", config.borderColor, config.bgColor)}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn("p-2 rounded-lg", config.bgColor)}>
          <Icon className={cn("h-5 w-5", config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn("text-xs font-medium", config.color)}>
              {config.label}
            </span>
            <Badge
              variant="outline"
              className={cn("text-xs h-5", CONFIDENCE_STYLES[card.confidence])}
            >
              {card.confidence} confidence
            </Badge>
            {card.timestamp_seconds > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-xs gap-1"
                    onClick={() => onSeekTo?.(card.timestamp_seconds)}
                  >
                    <Clock className="h-3 w-3" />
                    {formatTime(card.timestamp_seconds)}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Jump to this moment</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Title */}
          <h4 className="font-semibold text-sm mb-1">{card.title}</h4>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-3">{card.description}</p>

          {/* Player Intent */}
          {card.player_intent && (
            <div className="mb-2 p-2 rounded bg-accent/10 border border-accent/20">
              <div className="flex items-center gap-1.5 text-xs text-accent font-medium mb-1">
                <MessageSquare className="h-3 w-3" />
                Player Said
              </div>
              <p className="text-xs text-muted-foreground italic">
                "{card.player_intent}"
              </p>
            </div>
          )}

          {/* Behavioral Indicator */}
          {card.behavioral_indicator && (
            <div className="mb-2 p-2 rounded bg-muted/50 border border-border/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
                <Brain className="h-3 w-3" />
                Gameplay Heuristic
              </div>
              <p className="text-xs text-muted-foreground">
                {card.behavioral_indicator}
              </p>
            </div>
          )}

          {/* Recommendation */}
          {card.recommendation && (
            <div className="p-2 rounded bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-1.5 text-xs text-primary font-medium mb-1">
                <Target className="h-3 w-3" />
                Recommendation
              </div>
              <p className="text-xs text-foreground">{card.recommendation}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
