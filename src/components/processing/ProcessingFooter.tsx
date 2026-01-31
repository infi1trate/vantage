/**
 * Processing Footer Toast
 * 
 * Fixed footer showing background processing jobs.
 * Persists across navigation, lightweight, responsive.
 */

import { memo, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useProcessing } from "@/contexts/ProcessingContext";
import { ProcessingJob, ProcessingStatus } from "@/lib/processingJobs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ChevronUp, 
  ChevronDown,
  X,
  RotateCcw,
  Eye,
  Upload,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/localSessionStorage";

// Memoized job item to prevent re-render storms
const ProcessingJobItem = memo(function ProcessingJobItem({
  job,
  onDismiss,
  onRetry,
  onCancel,
}: {
  job: ProcessingJob;
  onDismiss: (id: string) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const isActive = job.status === "queued" || job.status === "processing" || job.status === "uploading";
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  
  // Use direct progress from job (set by ProcessingManager)
  const progress = job.progress;
  
  // Use step label from job
  const currentStageLabel = job.step || (job.status === "queued" ? "Queued" : "Processing");
  
  const statusIcon = useMemo(() => {
    switch (job.status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
      case "uploading":
        return <Upload className="h-4 w-4 text-primary animate-pulse shrink-0" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />;
      default:
        return <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  }, [job.status]);
  
  return (
    <div className={cn(
      "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-colors",
      "bg-card/50 border border-border/50",
      isFailed && "border-destructive/30 bg-destructive/5"
    )}>
      {statusIcon}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate max-w-[120px] sm:max-w-[180px] md:max-w-[240px]">
            {job.sessionTitle}
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {formatBytes(job.blobSize)}
          </span>
        </div>
        
        {isActive && (
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{currentStageLabel}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        )}
        
        {isFailed && (
          <p className="text-xs text-destructive mt-1 truncate">
            {job.errorMessage || "Processing failed"}
          </p>
        )}
        
        {isCompleted && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {job.localSaveSuccess ? "Saved locally" : ""}
            {job.cloudUploadSuccess ? " • Uploaded" : ""}
          </p>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {isCompleted && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            asChild
          >
            <Link to={`/session/${job.sessionId}`}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">View</span>
            </Link>
          </Button>
        )}
        
        {isFailed && job.retryCount < job.maxRetries && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => onRetry(job.id)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
        
        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-destructive"
            onClick={() => onCancel(job.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        
        {(isCompleted || isFailed || job.status === "cancelled") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground"
            onClick={() => onDismiss(job.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
});

export const ProcessingFooter = memo(function ProcessingFooter() {
  const { 
    jobs, 
    activeJobs, 
    completedJobs,
    isFooterExpanded, 
    setFooterExpanded,
    isFooterVisible,
    dismissJob,
    retryJob,
    cancelJob,
  } = useProcessing();
  
  const handleDismiss = useCallback((id: string) => dismissJob(id), [dismissJob]);
  const handleRetry = useCallback((id: string) => retryJob(id), [retryJob]);
  const handleCancel = useCallback((id: string) => cancelJob(id), [cancelJob]);
  
  const activeCount = activeJobs.length;
  const hasCompleted = completedJobs.some(j => j.status === "completed");
  const hasFailed = completedJobs.some(j => j.status === "failed");
  
  // Summary for collapsed state
  const summaryText = useMemo(() => {
    if (activeCount > 0) {
      return `Processing ${activeCount} video${activeCount > 1 ? "s" : ""}...`;
    }
    if (hasFailed) {
      return "Processing failed";
    }
    if (hasCompleted) {
      return "Processing complete";
    }
    return "Processing";
  }, [activeCount, hasCompleted, hasFailed]);
  
  // Don't render if no jobs - AFTER all hooks
  if (!isFooterVisible || jobs.length === 0) {
    return null;
  }
  
  return (
    <div 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-background/95 backdrop-blur-md border-t border-border",
        "shadow-[0_-4px_20px_rgba(0,0,0,0.15)]",
        "transition-all duration-200 ease-out",
        // Responsive padding
        "px-3 sm:px-4 md:px-6",
        // Max height when expanded
        isFooterExpanded ? "max-h-[50vh] sm:max-h-[40vh]" : "max-h-16"
      )}
    >
      {/* Header - always visible */}
      <div 
        className={cn(
          "flex items-center justify-between py-3 cursor-pointer",
          "hover:bg-muted/30 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6",
          "transition-colors"
        )}
        onClick={() => setFooterExpanded(!isFooterExpanded)}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          {activeCount > 0 ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : hasFailed ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          
          <span className="font-medium text-sm">{summaryText}</span>
          
          {jobs.length > 1 && (
            <span className="text-xs text-muted-foreground">
              ({jobs.length} total)
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Quick action for latest completed job */}
          {!isFooterExpanded && hasCompleted && activeCount === 0 && (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <Link to={`/session/${completedJobs.find(j => j.status === "completed")?.sessionId}`}>
                View & Annotate
              </Link>
            </Button>
          )}
          
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            {isFooterExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      
      {/* Expanded content */}
      {isFooterExpanded && (
        <div className="pb-3 overflow-y-auto max-h-[calc(50vh-60px)] sm:max-h-[calc(40vh-60px)]">
          <div className="space-y-2">
            {/* Active jobs first */}
            {activeJobs.map(job => (
              <ProcessingJobItem
                key={job.id}
                job={job}
                onDismiss={handleDismiss}
                onRetry={handleRetry}
                onCancel={handleCancel}
              />
            ))}
            
            {/* Then completed/failed */}
            {completedJobs.slice(0, 5).map(job => (
              <ProcessingJobItem
                key={job.id}
                job={job}
                onDismiss={handleDismiss}
                onRetry={handleRetry}
                onCancel={handleCancel}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default ProcessingFooter;
