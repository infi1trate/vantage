import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollText, ChevronDown, Clock, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChallengeRulesSectionProps {
  rules: string | null;
  clipDurationMin?: number | null;
  clipDurationMax?: number | null;
  requiredMomentsMin?: number;
  requiredMomentsMax?: number;
  momentLabel?: string | null;
}

export function ChallengeRulesSection({ 
  rules, 
  clipDurationMin = 5,
  clipDurationMax = 60,
  requiredMomentsMin = 1,
  requiredMomentsMax = 1,
  momentLabel,
}: ChallengeRulesSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!rules) return null;

  const rulesLines = rules.split('\n').filter(line => line.trim());
  const summaryLines = rulesLines.slice(0, 3);
  const hasMore = rulesLines.length > 3;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ScrollText className="h-5 w-5 text-primary" />
          Rules & Requirements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Clip Duration Requirement */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Clip Duration:</span>
          <span className="font-medium">
            {clipDurationMin}s – {clipDurationMax}s
          </span>
        </div>

        {/* Required Moments */}
        {(requiredMomentsMin > 1 || requiredMomentsMax > 1) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Required Moments:</span>
            <span className="font-medium">
              {requiredMomentsMin === requiredMomentsMax
                ? `${requiredMomentsMin} ${momentLabel || "moments"}`
                : `${requiredMomentsMin}–${requiredMomentsMax} ${momentLabel || "moments"}`}
            </span>
          </div>
        )}

        {/* Rules Content */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="prose prose-sm prose-invert max-w-none">
            {/* Summary (always visible) */}
            {summaryLines.map((line, i) => (
              <p key={i} className="text-muted-foreground mb-2">
                {line}
              </p>
            ))}
            
            {/* Expanded content */}
            <CollapsibleContent>
              {rulesLines.slice(3).map((line, i) => (
                <p key={i + 3} className="text-muted-foreground mb-2">
                  {line}
                </p>
              ))}
            </CollapsibleContent>
          </div>

          {/* Expand/Collapse trigger */}
          {hasMore && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="mt-2 text-primary hover:text-primary/80">
                <ChevronDown className={cn(
                  "h-4 w-4 mr-1 transition-transform",
                  isOpen && "rotate-180"
                )} />
                {isOpen ? "Show less" : `Show ${rulesLines.length - 3} more rules`}
              </Button>
            </CollapsibleTrigger>
          )}
        </Collapsible>
      </CardContent>
    </Card>
  );
}
