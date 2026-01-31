/**
 * Processing Footer Toast
 * 
 * Fixed footer showing background processing jobs.
 * Persists across navigation, lightweight, responsive.
 * 
 * Design:
 * - Collapsed: "Processing video (1)" + spinner + chevron
 * - Expanded: list of jobs with progress, status, actions
 * - xs/sm: full-width sheet style
 * - lg+: docked panel at bottom-right
 */

import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProcessing } from "@/contexts/ProcessingContext";
import { ProcessingJob } from "@/lib/processingJobs";
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
  AlertCircle,
  EyeOff,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/localSessionStorage";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Memoized job item to prevent re-render storms
const ProcessingJobItem = memo(function ProcessingJobItem({
  job,
  onDismiss,
  onRetry,
  onCancel,
  onHide,
  compact = false,
}: {
  job: ProcessingJob;
  onDismiss: (id: string) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onHide: (id: string) => void;
  compact?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  
  const isActive = job.status === "queued" || job.status === "processing" || job.status === "uploading";
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  const isCancelled = job.status === "cancelled";
  
  const progress = job.progress;
  const currentStageLabel = job.step || (job.status === "queued" ? "Queued" : "Processing");
  
  const statusIcon = useMemo(() => {
    switch (job.status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-vantage-success shrink-0" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
      case "uploading":
        return <Upload className="h-4 w-4 text-primary animate-pulse shrink-0" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />;
      case "cancelled":
        return <X className="h-4 w-4 text-muted-foreground shrink-0" />;
      default:
        return <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  }, [job.status]);
  
  return (
    <div className={cn(
      "flex flex-col gap-1.5 p-3 rounded-lg transition-all duration-150",
      "bg-card/80 border border-border/60",
      isFailed && "border-destructive/40 bg-destructive/5",
      isCompleted && "border-vantage-success/30 bg-vantage-success/5",
      compact && "p-2"
    )}>
      <div className="flex items-center gap-2.5">
        {statusIcon}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium truncate",
              compact ? "text-xs max-w-[100px]" : "text-sm max-w-[140px] sm:max-w-[200px] lg:max-w-[280px]"
            )}>
              {job.sessionTitle}
            </span>
            {!compact && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {formatBytes(job.blobSize)}
              </span>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Completed: View & Annotate */}
          {isCompleted && (
            <Button
              variant="default"
              size="sm"
              className={cn("h-7 text-xs", compact ? "px-2" : "px-3")}
              asChild
            >
              <Link to={`/session/${job.sessionId}`}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                {!compact && <span>View & Annotate</span>}
                {compact && <span>View</span>}
              </Link>
            </Button>
          )}
          
          {/* Failed: Retry + Details */}
          {isFailed && (
            <>
              {job.retryCount < job.maxRetries && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => onRetry(job.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {!compact && <span className="ml-1.5">Retry</span>}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Retry processing</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    <Info className="h-3.5 w-3.5" />
                    {!compact && <span className="ml-1.5">Details</span>}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View error details</TooltipContent>
              </Tooltip>
            </>
          )}
          
          {/* Active: Hide + Cancel */}
          {isActive && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground"
                    onClick={() => onHide(job.id)}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Hide (continues in background)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => onCancel(job.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cancel processing</TooltipContent>
              </Tooltip>
            </>
          )}
          
          {/* Completed/Failed/Cancelled: Dismiss */}
          {(isCompleted || isFailed || isCancelled) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground"
                  onClick={() => onDismiss(job.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dismiss</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      
      {/* Progress bar for active jobs */}
      {isActive && (
        <div className="space-y-1 pl-6.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{currentStageLabel}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}
      
      {/* Error details for failed jobs */}
      {isFailed && showDetails && (
        <div className="mt-1 pl-6.5">
          <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">
              {job.errorMessage || "An unknown error occurred during processing."}
            </p>
          </div>
        </div>
      )}
      
      {/* Success info for completed jobs */}
      {isCompleted && !compact && (
        <div className="pl-6.5">
          <p className="text-xs text-muted-foreground">
            {job.localSaveSuccess && "Saved locally"}
            {job.localSaveSuccess && job.cloudUploadSuccess && " • "}
            {job.cloudUploadSuccess && "Uploaded to cloud"}
          </p>
        </div>
      )}
    </div>
  );
});

// Main footer component
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
  
  // Track hidden jobs (still processing but not shown)
  const [hiddenJobIds, setHiddenJobIds] = useState<Set<string>>(new Set());
  
  const handleDismiss = useCallback((id: string) => dismissJob(id), [dismissJob]);
  const handleRetry = useCallback((id: string) => retryJob(id), [retryJob]);
  const handleCancel = useCallback((id: string) => cancelJob(id), [cancelJob]);
  const handleHide = useCallback((id: string) => {
    setHiddenJobIds(prev => new Set([...prev, id]));
  }, []);
  
  // Filter out hidden active jobs
  const visibleActiveJobs = useMemo(() => 
    activeJobs.filter(j => !hiddenJobIds.has(j.id)),
    [activeJobs, hiddenJobIds]
  );
  
  // Failed jobs always show (not hideable)
  const failedJobs = useMemo(() => 
    jobs.filter(j => j.status === "failed"),
    [jobs]
  );
  
  const activeCount = visibleActiveJobs.length;
  const failedCount = failedJobs.length;
  const hasCompleted = completedJobs.some(j => j.status === "completed");
  const hasFailed = failedCount > 0;
  
  // Jobs to show (active + failed + recent completed)
  const visibleJobs = useMemo(() => {
    const active = visibleActiveJobs;
    const failed = failedJobs;
    const completed = completedJobs
      .filter(j => j.status === "completed")
      .slice(0, 3);
    return [...active, ...failed, ...completed];
  }, [visibleActiveJobs, failedJobs, completedJobs]);
  
  // Summary for collapsed state
  const summaryText = useMemo(() => {
    if (activeCount > 0) {
      return `Processing video${activeCount > 1 ? `s (${activeCount})` : ""}`;
    }
    if (hasFailed) {
      return `Processing failed (${failedCount})`;
    }
    if (hasCompleted) {
      return "Processing complete";
    }
    return "Processing";
  }, [activeCount, failedCount, hasCompleted, hasFailed]);
  
  // Don't render if no visible jobs
  if (!isFooterVisible || visibleJobs.length === 0) {
    return null;
  }
  
  // Find latest completed job for quick action
  const latestCompletedJob = completedJobs.find(j => j.status === "completed");
  
  return (
    <>
      {/* Spacer to prevent content overlap - add padding to body */}
      <div 
        className={cn(
          "fixed bottom-0 left-0 right-0 pointer-events-none",
          isFooterExpanded ? "h-[50vh] lg:h-auto" : "h-14"
        )} 
        aria-hidden="true"
      />
      
      {/* Footer container */}
      <div 
        className={cn(
          "fixed z-50 transition-all duration-200 ease-out",
          // Mobile/tablet: full-width bottom sheet
          "bottom-0 left-0 right-0",
          // Desktop: docked panel at bottom-right when expanded
          isFooterExpanded && "lg:left-auto lg:right-4 lg:bottom-4 lg:w-[420px] lg:rounded-xl",
          // Background and border
          "bg-background/95 backdrop-blur-md border-t border-border",
          isFooterExpanded && "lg:border lg:shadow-2xl",
          !isFooterExpanded && "shadow-[0_-4px_20px_rgba(0,0,0,0.12)]",
          // Safe area inset for mobile
          "pb-safe"
        )}
        role="region"
        aria-label="Video processing status"
      >
        {/* Collapsed header bar - always visible */}
        <div 
          className={cn(
            "flex items-center justify-between cursor-pointer",
            "px-3 sm:px-4 lg:px-4 py-3",
            "hover:bg-muted/40 active:bg-muted/60",
            "transition-colors duration-100",
            isFooterExpanded && "border-b border-border/50"
          )}
          onClick={() => setFooterExpanded(!isFooterExpanded)}
          role="button"
          aria-expanded={isFooterExpanded}
          aria-controls="processing-jobs-list"
        >
          <div className="flex items-center gap-2.5">
            {/* Status indicator */}
            {activeCount > 0 ? (
              <div className="relative">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                {activeCount > 1 && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 text-[9px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                    {activeCount}
                  </span>
                )}
              </div>
            ) : hasFailed ? (
              <div className="relative">
                <XCircle className="h-4 w-4 text-destructive" />
                {failedCount > 1 && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                    {failedCount}
                  </span>
                )}
              </div>
            ) : (
              <CheckCircle2 className="h-4 w-4 text-vantage-success" />
            )}
            
            <span className="font-medium text-sm">{summaryText}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Quick action for latest completed job (collapsed state only) */}
            {!isFooterExpanded && hasCompleted && activeCount === 0 && !hasFailed && latestCompletedJob && (
              <Button
                variant="default"
                size="sm"
                className="h-7 px-3 text-xs"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <Link to={`/session/${latestCompletedJob.sessionId}`}>
                  View & Annotate
                </Link>
              </Button>
            )}
            
            {/* Expand/collapse chevron */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0"
              tabIndex={-1}
            >
              {isFooterExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Expanded job list */}
        {isFooterExpanded && (
          <div 
            id="processing-jobs-list"
            className={cn(
              "overflow-y-auto overscroll-contain",
              "px-3 sm:px-4 lg:px-4 py-3",
              // Height constraints
              "max-h-[calc(50vh-60px)] sm:max-h-[40vh] lg:max-h-[50vh]"
            )}
          >
            <div className="space-y-2">
              {visibleJobs.map(job => (
                <ProcessingJobItem
                  key={job.id}
                  job={job}
                  onDismiss={handleDismiss}
                  onRetry={handleRetry}
                  onCancel={handleCancel}
                  onHide={handleHide}
                />
              ))}
              
              {visibleJobs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No active processing jobs
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
});

export default ProcessingFooter;
