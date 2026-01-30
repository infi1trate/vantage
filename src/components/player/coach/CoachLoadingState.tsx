import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoachLoadingStateProps {
  currentStep?: number;
}

const LOADING_STEPS = [
  "Extracting key moments",
  "Analyzing patterns",
  "Writing coach notes",
  "Generating summary",
];

export function CoachLoadingState({ currentStep = 0 }: CoachLoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-sm font-medium mb-1">Analyzing session...</p>
      <p className="text-xs text-muted-foreground mb-6">
        This may take a moment
      </p>
      
      {/* Progress steps */}
      <div className="space-y-2 text-left w-full max-w-[200px]">
        {LOADING_STEPS.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          
          return (
            <div 
              key={step}
              className={cn(
                "flex items-center gap-2 text-xs transition-colors",
                isComplete && "text-vantage-success",
                isCurrent && "text-foreground",
                !isComplete && !isCurrent && "text-muted-foreground/50"
              )}
            >
              {isComplete ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : isCurrent ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-current" />
              )}
              <span>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
