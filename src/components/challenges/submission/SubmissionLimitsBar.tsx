import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubmissionLimitsBarProps {
  currentSubmissions: number;
  maxSubmissions: number;
}

export function SubmissionLimitsBar({
  currentSubmissions,
  maxSubmissions,
}: SubmissionLimitsBarProps) {
  const remaining = maxSubmissions - currentSubmissions;
  const isAtLimit = remaining <= 0;
  const isNearLimit = remaining === 1;

  if (maxSubmissions <= 1) {
    // Single submission challenge - only show if already submitted
    if (isAtLimit) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">
            You have already submitted to this challenge.
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 rounded-lg border",
        isAtLimit
          ? "bg-destructive/10 border-destructive/30"
          : isNearLimit
          ? "bg-yellow-500/10 border-yellow-500/30"
          : "bg-muted/30 border-border"
      )}
    >
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm">
          <span className="text-muted-foreground">Submissions: </span>
          <span className="font-medium">
            {currentSubmissions} / {maxSubmissions}
          </span>
        </span>
      </div>

      {isAtLimit ? (
        <Badge variant="destructive" className="text-xs">
          Limit reached
        </Badge>
      ) : (
        <Badge
          variant="secondary"
          className={cn(
            "text-xs",
            isNearLimit && "bg-yellow-500/20 text-yellow-600 dark:text-yellow-500"
          )}
        >
          {remaining} remaining
        </Badge>
      )}
    </div>
  );
}
