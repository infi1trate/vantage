import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  TrendingUp, 
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CoachSummary, CoachConfidence } from "./types";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CoachSummaryCardProps {
  summary: CoachSummary;
  isPlaceholder?: boolean;
}

const CONFIDENCE_CONFIG: Record<CoachConfidence, { label: string; color: string; bg: string }> = {
  high: { label: "High Confidence", color: "text-vantage-success", bg: "bg-vantage-success/10" },
  medium: { label: "Medium Confidence", color: "text-yellow-500", bg: "bg-yellow-500/10" },
  low: { label: "Exploratory", color: "text-muted-foreground", bg: "bg-muted" },
};

export function CoachSummaryCard({ summary, isPlaceholder }: CoachSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const confidenceConfig = CONFIDENCE_CONFIG[summary.overall_confidence];

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-semibold">Coach Summary</span>
              {isPlaceholder && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Preview
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={cn("text-[10px] px-1.5 py-0", confidenceConfig.color, confidenceConfig.bg)}
              >
                {confidenceConfig.label}
              </Badge>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3">
            {/* Focus Goal */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Target className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Focus for next session</span>
              </div>
              <p className="text-sm pl-4">{summary.focus_goal}</p>
            </div>

            {/* Patterns */}
            {summary.patterns.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Patterns noticed</span>
                </div>
                <ul className="space-y-0.5 pl-4">
                  {summary.patterns.map((pattern, i) => (
                    <li key={i} className="text-sm flex items-start gap-1.5">
                      <span className="text-muted-foreground">•</span>
                      <span>{pattern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Checklist Item */}
            {summary.checklist_item && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30 border border-border/30">
                <CheckCircle2 className="h-4 w-4 text-vantage-success shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Pre-game checklist</span>
                  <p className="text-sm">{summary.checklist_item}</p>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
