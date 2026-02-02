/**
 * Reel Editor State Badge
 * 
 * Visual indicator for the current editor state.
 * Shows: Assembling | Draft | Ready | Exporting | Failed
 */

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, Download, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditorState, STATE_BADGE_STYLES } from "@/hooks/useEditorState";

interface EditorStateBadgeProps {
  state: EditorState;
  statusLabel: string;
  showProgress: boolean;
  progressPercent: number;
  className?: string;
}

export const EditorStateBadge = memo(function EditorStateBadge({
  state,
  statusLabel,
  showProgress,
  progressPercent,
  className,
}: EditorStateBadgeProps) {
  const styles = STATE_BADGE_STYLES[state];
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] font-medium gap-1.5 px-2 py-0.5",
          styles.bg,
          styles.text,
          styles.border
        )}
      >
        {state === "waiting_for_source" && (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
        {state === "compiling" && (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
        {state === "ready" && (
          <Check className="h-3 w-3" />
        )}
        {state === "exporting" && (
          <Download className="h-3 w-3 animate-pulse" />
        )}
        {state === "failed" && (
          <AlertCircle className="h-3 w-3" />
        )}
        {state === "needs_attention" && (
          <AlertCircle className="h-3 w-3" />
        )}
        {statusLabel}
      </Badge>
      
      {showProgress && state === "exporting" && (
        <div className="flex items-center gap-2 min-w-[80px]">
          <Progress value={progressPercent} className="h-1.5 flex-1" />
          <span className="text-[10px] font-mono text-muted-foreground">
            {progressPercent}%
          </span>
        </div>
      )}
    </div>
  );
});
