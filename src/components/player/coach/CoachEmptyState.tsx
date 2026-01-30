import { Button } from "@/components/ui/button";
import { Brain, Shield, Target, TrendingUp, MessageSquare } from "lucide-react";

interface CoachEmptyStateProps {
  onRunCoach: () => void;
  disabled?: boolean;
}

export function CoachEmptyState({ onRunCoach, disabled }: CoachEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
        <Brain className="h-8 w-8 text-primary" />
      </div>
      
      <h4 className="font-semibold mb-2">Get Coach Review</h4>
      <p className="text-sm text-muted-foreground mb-3">
        Post-game analysis of your recorded session:
      </p>
      
      <ul className="text-xs text-muted-foreground mb-4 space-y-1.5 text-left max-w-xs mx-auto">
        <li className="flex items-start gap-2">
          <Target className="h-3 w-3 mt-0.5 text-primary shrink-0" />
          Key moments flagged with coaching notes
        </li>
        <li className="flex items-start gap-2">
          <TrendingUp className="h-3 w-3 mt-0.5 text-primary shrink-0" />
          Pattern detection across similar events
        </li>
        <li className="flex items-start gap-2">
          <MessageSquare className="h-3 w-3 mt-0.5 text-primary shrink-0" />
          Actionable tips for next session
        </li>
      </ul>
      
      {/* Non-cheating disclaimer */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mb-4 bg-muted/30 rounded-md py-2 px-3">
        <Shield className="h-3 w-3" />
        <span>Post-game only • Never real-time • Educational</span>
      </div>
      
      <Button onClick={onRunCoach} disabled={disabled}>
        <Brain className="h-4 w-4 mr-2" />
        Run Coach Review
      </Button>
    </div>
  );
}
