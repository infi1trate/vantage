import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  XCircle,
  AlertCircle,
  Chrome,
  Globe,
  Eye,
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { PreflightGateResult, PreflightIssue } from "@/lib/capturePreflightGate";

interface BrowserNotSupportedProps {
  preflightResult: PreflightGateResult;
  onBack: () => void;
  onContinuePreview?: () => void;
}

export function BrowserNotSupported({
  preflightResult,
  onBack,
  onContinuePreview,
}: BrowserNotSupportedProps) {
  const [copied, setCopied] = useState(false);
  
  const criticalIssues = preflightResult.issues.filter(i => i.severity === "critical");
  const warnings = preflightResult.issues.filter(i => i.severity === "warning");
  
  const handleCopyDiagnostics = useCallback(async () => {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      browser: preflightResult.browserInfo,
      issues: preflightResult.issues,
      selectedFormat: preflightResult.selectedFormat,
      supported: preflightResult.supported,
      canPreview: preflightResult.canPreview,
    };
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setCopied(true);
      toast.success("Diagnostics copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [preflightResult]);
  
  const IssueItem = ({ issue }: { issue: PreflightIssue }) => (
    <div className={`
      flex items-start gap-3 p-3 rounded-lg
      ${issue.severity === "critical" 
        ? "bg-destructive/10 border border-destructive/30" 
        : "bg-warning/10 border border-warning/30"
      }
    `}>
      {issue.severity === "critical" ? (
        <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
      )}
      <div>
        <h4 className={`text-sm font-medium ${
          issue.severity === "critical" ? "text-destructive" : "text-warning"
        }`}>
          {issue.title}
        </h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          {issue.description}
        </p>
      </div>
    </div>
  );

  return (
    <Card className="p-6 bg-card border-border/30 max-w-xl mx-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="font-display text-2xl tracking-wide mb-2">
            BROWSER NOT SUPPORTED
          </h2>
          <p className="text-muted-foreground text-sm">
            Your browser is missing required capabilities for screen capture.
          </p>
        </div>

        {/* Detected Browser */}
        <div className="flex items-center justify-center gap-2 p-3 bg-muted/30 rounded-lg">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            Detected: <strong>{preflightResult.browserInfo.name} {preflightResult.browserInfo.version}</strong>
          </span>
        </div>

        {/* Critical Issues */}
        {criticalIssues.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-destructive">
              Missing Capabilities ({criticalIssues.length})
            </h3>
            <div className="space-y-2">
              {criticalIssues.map(issue => (
                <IssueItem key={issue.id} issue={issue} />
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-warning">
              Compatibility Warnings ({warnings.length})
            </h3>
            <div className="space-y-2">
              {warnings.map(issue => (
                <IssueItem key={issue.id} issue={issue} />
              ))}
            </div>
          </div>
        )}

        {/* Recommended Browsers */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recommended Browsers
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <a
              href="https://www.google.com/chrome/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group"
            >
              <Chrome className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
              <span className="text-xs font-medium">Chrome</span>
              <Badge variant="outline" className="text-[10px] bg-vantage-success/10 text-vantage-success border-vantage-success/30">
                Best
              </Badge>
            </a>
            <a
              href="https://www.microsoft.com/edge"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group"
            >
              <Globe className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
              <span className="text-xs font-medium">Edge</span>
              <Badge variant="outline" className="text-[10px]">
                Good
              </Badge>
            </a>
            <a
              href="https://brave.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group"
            >
              <Globe className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
              <span className="text-xs font-medium">Brave</span>
              <Badge variant="outline" className="text-[10px]">
                Good
              </Badge>
            </a>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
          {/* Continue in Preview Mode - only if possible */}
          {preflightResult.canPreview && onContinuePreview && (
            <Button
              variant="outline"
              onClick={onContinuePreview}
              className="w-full"
            >
              <Eye className="mr-2 h-4 w-4" />
              Continue in Preview Mode
              <Badge variant="outline" className="ml-2 text-[10px]">
                No Recording
              </Badge>
            </Button>
          )}
          
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={onBack}
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            <Button
              variant="outline"
              onClick={handleCopyDiagnostics}
              className="flex-1"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Diagnostics
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Help Link */}
        <p className="text-center text-xs text-muted-foreground">
          Need help?{" "}
          <a
            href="https://docs.lovable.dev/features/security"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            View troubleshooting guide
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>
    </Card>
  );
}
