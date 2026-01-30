import { Check, X, Loader2, AlertCircle, Info } from "lucide-react";
import { type PreflightCheck, type PreflightStatus } from "@/hooks/usePreflightChecks";
import { cn } from "@/lib/utils";

interface PreflightChecklistProps {
  checks: PreflightCheck[];
  allPassed: boolean;
  isRunning: boolean;
}

function StatusIcon({ status }: { status: PreflightStatus }) {
  switch (status) {
    case "passed":
      return <Check className="h-4 w-4 text-vantage-success" />;
    case "failed":
      return <X className="h-4 w-4 text-destructive" />;
    case "checking":
      return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />;
    case "pending":
    default:
      return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
  }
}

function getStatusBgColor(status: PreflightStatus): string {
  switch (status) {
    case "passed":
      return "bg-vantage-success/10";
    case "failed":
      return "bg-destructive/10";
    case "checking":
      return "bg-muted/50";
    default:
      return "bg-muted/20";
  }
}

export function PreflightChecklist({ checks, allPassed, isRunning }: PreflightChecklistProps) {
  const failedChecks = checks.filter(c => c.status === "failed");
  
  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        {allPassed ? (
          <div className="flex items-center gap-2 text-vantage-success">
            <Check className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-wider">Ready to Record</span>
          </div>
        ) : isRunning ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium uppercase tracking-wider">Checking...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-wider">
              {failedChecks.length} {failedChecks.length === 1 ? "Issue" : "Issues"} Found
            </span>
          </div>
        )}
      </div>
      
      <ul className="space-y-2">
        {checks.map((check) => (
          <li 
            key={check.id}
            className={cn(
              "flex items-start gap-3 rounded-md px-3 py-2 transition-colors",
              getStatusBgColor(check.status)
            )}
          >
            <div className="mt-0.5">
              <StatusIcon status={check.status} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-sm",
                  check.status === "passed" && "text-foreground",
                  check.status === "failed" && "text-destructive font-medium",
                  check.status === "checking" && "text-muted-foreground",
                  check.status === "pending" && "text-muted-foreground"
                )}>
                  {check.label}
                </span>
                {!check.required && check.status !== "failed" && (
                  <span className="text-xs text-muted-foreground">(optional)</span>
                )}
              </div>
              {check.status === "failed" && check.fix && (
                <p className="text-xs text-muted-foreground mt-1">
                  {check.fix}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      
      {/* Info callout about system audio */}
      <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-md bg-muted/30 text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p className="text-xs">
          Sharing a browser tab can include tab audio. Sharing a window often cannot.
        </p>
      </div>
    </div>
  );
}
