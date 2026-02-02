/**
 * Reel Compilation Status
 * 
 * Inline status indicator for reel compilation progress.
 * Used when a reel is still being assembled from moments.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Film,
} from "lucide-react";

export type CompilationPhase = "idle" | "assembling" | "processing" | "ready" | "error";

interface ReelCompilationStatusProps {
  phase: CompilationPhase;
  progress?: number;
  error?: string;
  className?: string;
}

const PHASE_CONFIG: Record<CompilationPhase, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
}> = {
  idle: {
    label: "Waiting...",
    icon: Film,
    iconClass: "text-muted-foreground",
  },
  assembling: {
    label: "Assembling clips...",
    icon: Loader2,
    iconClass: "text-primary animate-spin",
  },
  processing: {
    label: "Processing timeline...",
    icon: Loader2,
    iconClass: "text-primary animate-spin",
  },
  ready: {
    label: "Ready to edit",
    icon: CheckCircle2,
    iconClass: "text-vantage-success",
  },
  error: {
    label: "Compilation failed",
    icon: AlertTriangle,
    iconClass: "text-destructive",
  },
};

export const ReelCompilationStatus = memo(function ReelCompilationStatus({
  phase,
  progress = 0,
  error,
  className,
}: ReelCompilationStatusProps) {
  const config = PHASE_CONFIG[phase];
  const Icon = config.icon;
  const isLoading = phase === "assembling" || phase === "processing";

  if (phase === "ready") {
    // Don't show anything when ready - the editor is usable
    return null;
  }

  return (
    <div 
      className={cn(
        "flex flex-col gap-2 p-4 rounded-lg border",
        phase === "error" 
          ? "bg-destructive/5 border-destructive/20" 
          : "bg-muted/30 border-border/40",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", config.iconClass)} />
        <span className="text-sm font-medium text-foreground">
          {config.label}
        </span>
        {isLoading && progress > 0 && (
          <span className="text-xs text-muted-foreground ml-auto font-mono">
            {Math.round(progress)}%
          </span>
        )}
      </div>
      
      {isLoading && (
        <Progress value={progress} className="h-1.5" />
      )}
      
      {phase === "error" && error && (
        <p className="text-xs text-destructive/80">
          {error}
        </p>
      )}
      
      {isLoading && (
        <p className="text-[10px] text-muted-foreground">
          Your reel is being prepared. You can start editing once it's ready.
        </p>
      )}
    </div>
  );
});

export default ReelCompilationStatus;
