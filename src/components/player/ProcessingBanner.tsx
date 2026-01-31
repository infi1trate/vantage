/**
 * Processing Banner
 * 
 * Shows status banners for sessions that are still being processed.
 * Includes progress, status messages, and actions for failed jobs.
 */

import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { ProcessingJob } from "@/lib/processingJobs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Loader2, 
  AlertCircle, 
  RotateCcw, 
  ArrowLeft,
  CheckCircle2,
  Clock,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessingBannerProps {
  job: ProcessingJob;
  onRetry?: () => void;
  onBack?: () => void;
  className?: string;
}

export const ProcessingBanner = memo(function ProcessingBanner({
  job,
  onRetry,
  onBack,
  className,
}: ProcessingBannerProps) {
  const navigate = useNavigate();
  
  const isActive = job.status === "queued" || job.status === "processing" || job.status === "uploading";
  const isFailed = job.status === "failed";
  const isComplete = job.status === "completed";
  
  // Determine icon and colors based on status
  const getStatusIcon = () => {
    switch (job.status) {
      case "queued":
        return <Clock className="h-5 w-5" />;
      case "processing":
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case "uploading":
        return <Upload className="h-5 w-5 animate-pulse" />;
      case "failed":
        return <AlertCircle className="h-5 w-5" />;
      case "completed":
        return <CheckCircle2 className="h-5 w-5" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin" />;
    }
  };

  const getStatusMessage = () => {
    if (job.step) return job.step;
    switch (job.status) {
      case "queued":
        return "Waiting in queue...";
      case "processing":
        return "Processing video...";
      case "uploading":
        return "Uploading to cloud...";
      case "failed":
        return "Processing failed";
      case "completed":
        return "Ready to view";
      default:
        return "Processing...";
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/library");
    }
  };

  // Failed state - show error with retry/back actions
  if (isFailed) {
    return (
      <Alert 
        variant="destructive" 
        className={cn(
          "border-destructive/50 bg-destructive/10",
          className
        )}
      >
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Processing Failed</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">
            {job.errorMessage || "An error occurred while processing this video."}
          </p>
          <div className="flex items-center gap-2">
            {onRetry && job.retryCount < job.maxRetries && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Retry Processing
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Library
            </Button>
          </div>
          {job.retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Retry {job.retryCount} of {job.maxRetries}
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Completed state - show success (auto-dismiss soon)
  if (isComplete) {
    return (
      <Alert 
        className={cn(
          "border-vantage-success/50 bg-vantage-success/10 text-vantage-success",
          className
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Video Ready</AlertTitle>
        <AlertDescription>
          Processing complete. You can now view and review your recording.
        </AlertDescription>
      </Alert>
    );
  }

  // Active processing state - show progress
  return (
    <div className={cn(
      "bg-primary/5 border border-primary/20 rounded-lg p-4",
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-primary">
          {getStatusIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-medium text-foreground">
              Processing Video
            </h3>
            <span className="text-sm font-mono-data text-muted-foreground">
              {Math.round(job.progress)}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            {getStatusMessage()}
          </p>
          <Progress value={job.progress} className="h-2" />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">
              Some features may be limited until processing completes.
            </p>
            <Button 
              size="sm" 
              variant="ghost" 
              className="text-xs h-7"
              onClick={handleBack}
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              Back to Library
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ProcessingBanner;
