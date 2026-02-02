/**
 * Render Queue Footer
 * 
 * Fixed footer showing active render/export jobs.
 * Persists across navigation, shows granular progress.
 * 
 * Features:
 * - Collapsed: Summary of active jobs + quick action
 * - Expanded: Full job list with stage progress
 * - Completed: View + Show in folder
 * - Failed: Error reason + Retry
 */

import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown,
  X,
  RotateCcw,
  Eye,
  Download,
  AlertCircle,
  Film,
  Sparkles,
  Upload,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { useRenderQueue } from "@/hooks/useRenderQueue";
import { RenderJob, RenderJobType } from "@/lib/renderQueue";

// Job type labels and icons
const JOB_TYPE_CONFIG: Record<RenderJobType, { label: string; icon: typeof Film }> = {
  reel_assembly: { label: "Assembling reel", icon: Film },
  composite_reel: { label: "Rendering reel", icon: Film },
  apply_effects: { label: "Applying effects", icon: Sparkles },
  generate_package: { label: "Generating package", icon: Sparkles },
  export_video: { label: "Exporting video", icon: Download },
  export_platform: { label: "Publishing", icon: Upload },
};

// ============= Job Item Component =============

interface RenderJobItemProps {
  job: RenderJob;
  onDismiss: (id: string) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  compact?: boolean;
}

const RenderJobItem = memo(function RenderJobItem({
  job,
  onDismiss,
  onRetry,
  onCancel,
  compact = false,
}: RenderJobItemProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const isActive = job.status === "queued" || job.status === "processing" || job.status === "uploading";
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  const isNeedsAttention = job.status === "needs_attention";
  const isCancelled = job.status === "cancelled";
  
  const typeConfig = JOB_TYPE_CONFIG[job.type];
  const TypeIcon = typeConfig.icon;
  
  const currentStage = job.stages[job.currentStageIndex];
  const stageLabel = currentStage?.label || (job.status === "queued" ? "Queued" : "Processing");
  
  const statusIcon = useMemo(() => {
    switch (job.status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-vantage-success shrink-0" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
      case "needs_attention":
        return <AlertCircle className="h-4 w-4 text-vantage-warning shrink-0" />;
      case "uploading":
        return <Upload className="h-4 w-4 text-primary animate-pulse shrink-0" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />;
      case "cancelled":
        return <X className="h-4 w-4 text-muted-foreground shrink-0" />;
      default:
        return <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  }, [job.status, TypeIcon]);
  
  return (
    <div className={cn(
      "flex flex-col gap-2 p-3 rounded-lg transition-all duration-150",
      "bg-card/80 border border-border/60",
      isFailed && "border-destructive/40 bg-destructive/5",
      isNeedsAttention && "border-vantage-warning/40 bg-vantage-warning/5",
      isCompleted && "border-vantage-success/30 bg-vantage-success/5",
      compact && "p-2"
    )}>
      {/* Header row */}
      <div className="flex items-center gap-2.5">
        {statusIcon}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium truncate",
              compact ? "text-xs max-w-[100px]" : "text-sm max-w-[160px] sm:max-w-[220px]"
            )}>
              {/* Show reel title for assembly jobs, session title otherwise */}
              {job.type === "reel_assembly" && job.reelTitle 
                ? job.reelTitle 
                : job.sessionTitle}
            </span>
            <Badge variant="secondary" className="text-[9px] px-1.5 shrink-0">
              {typeConfig.label}
            </Badge>
            {/* Show aspect ratio + clip count for reel assembly */}
            {job.type === "reel_assembly" && (job.aspectRatio || job.clipCount) && !compact && (
              <span className="text-[10px] text-muted-foreground">
                {job.aspectRatio}{job.clipCount ? ` · ${job.clipCount} clips` : ""}
              </span>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Completed actions */}
          {isCompleted && (
            <>
              <Button
                variant="default"
                size="sm"
                className={cn("h-7 gap-1.5", compact ? "px-2 text-xs" : "px-3")}
                asChild
              >
                {/* Link to reel editor for reel_assembly jobs */}
                {job.type === "reel_assembly" && job.reelId ? (
                  <Link to={`/reel/${job.reelId}`}>
                    <Film className="h-3.5 w-3.5" />
                    {!compact && <span>Open Editor</span>}
                  </Link>
                ) : (
                  <Link to={`/session/${job.sessionId}`}>
                    <Eye className="h-3.5 w-3.5" />
                    {!compact && <span>View</span>}
                  </Link>
                )}
              </Button>
              {job.downloadPath && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2">
                      <FolderOpen className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Show in folder</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
          
          {/* Failed actions */}
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
                      {!compact && <span className="ml-1">Retry</span>}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Retry</TooltipContent>
                </Tooltip>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setShowDetails(!showDetails)}
              >
                <AlertCircle className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          
          {/* Needs attention actions - "Fix & continue" CTA + Retry */}
          {isNeedsAttention && (
            <>
              {/* Primary: Open editor to fix the issue */}
              {job.type === "reel_assembly" && job.reelId && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 gap-1.5"
                  asChild
                >
                  <Link to={`/reel/${job.reelId}`}>
                    <Film className="h-3.5 w-3.5" />
                    {!compact && <span>Fix & continue</span>}
                  </Link>
                </Button>
              )}
              
              {/* Secondary: Retry */}
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
                      {!compact && <span className="ml-1">Retry</span>}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Retry assembly</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
          
          {/* Active job actions */}
          {isActive && job.canCancel && (
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
              <TooltipContent>Cancel</TooltipContent>
            </Tooltip>
          )}
          
          {/* Dismiss button for terminal states */}
          {(isCompleted || isFailed || isNeedsAttention || isCancelled) && (
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
      
      {/* Progress for active jobs */}
      {isActive && (
        <div className="space-y-1.5 pl-6.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{stageLabel}</span>
            <span className="font-mono">{job.overallProgress}%</span>
          </div>
          <Progress value={job.overallProgress} className="h-1.5" />
          
          {/* Stage indicators (compact view) */}
          {!compact && (
            <div className="flex items-center gap-1 mt-1.5">
              {job.stages.map((stage, i) => (
                <div
                  key={stage.id}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    stage.status === "completed" && "bg-primary",
                    stage.status === "active" && "bg-primary/50",
                    stage.status === "pending" && "bg-muted",
                    stage.status === "failed" && "bg-destructive",
                  )}
                  title={stage.label}
                />
              ))}
            </div>
          )}
          
          {/* Preview ready indicator */}
          {job.previewReadyAt && !compact && (
            <p className="text-[10px] text-muted-foreground">
              Preview ready — final render in progress
            </p>
          )}
        </div>
      )}
      
      {/* Error details */}
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
      
      {/* Needs attention warning */}
      {isNeedsAttention && (
        <div className="mt-1 pl-6.5">
          <div className="flex items-start gap-2 p-2 rounded bg-vantage-warning/10 border border-vantage-warning/20">
            <AlertCircle className="h-3.5 w-3.5 text-vantage-warning shrink-0 mt-0.5" />
            <p className="text-xs text-vantage-warning">
              {job.errorMessage || "This is taking longer than expected."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

// ============= Main Footer Component =============

export const RenderQueueFooter = memo(function RenderQueueFooter() {
  const {
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    needsAttentionJobs,
    hasActiveJobs,
    cancelJob,
    retryJob,
    dismissJob,
  } = useRenderQueue();
  
  const [isExpanded, setExpanded] = useState(false);
  const [hiddenJobIds, setHiddenJobIds] = useState<Set<string>>(new Set());
  
  const handleDismiss = useCallback((id: string) => {
    dismissJob(id);
    setHiddenJobIds(prev => new Set([...prev, id]));
  }, [dismissJob]);
  
  // Filter visible jobs
  const visibleJobs = useMemo(() => {
    const active = activeJobs.filter(j => !hiddenJobIds.has(j.id));
    const attention = needsAttentionJobs.filter(j => !hiddenJobIds.has(j.id));
    const failed = failedJobs.filter(j => !hiddenJobIds.has(j.id));
    const completed = completedJobs.filter(j => !hiddenJobIds.has(j.id)).slice(0, 3);
    return [...active, ...attention, ...failed, ...completed];
  }, [activeJobs, needsAttentionJobs, failedJobs, completedJobs, hiddenJobIds]);
  
  const activeCount = activeJobs.filter(j => !hiddenJobIds.has(j.id)).length;
  const attentionCount = needsAttentionJobs.filter(j => !hiddenJobIds.has(j.id)).length;
  const failedCount = failedJobs.filter(j => !hiddenJobIds.has(j.id)).length;
  const hasCompleted = completedJobs.some(j => !hiddenJobIds.has(j.id));
  
  // Summary text - must be before early return
  const summaryText = useMemo(() => {
    if (activeCount > 0) {
      const job = activeJobs[0];
      const typeLabel = JOB_TYPE_CONFIG[job.type]?.label || "Processing";
      return activeCount > 1 ? `${typeLabel} (${activeCount})` : typeLabel;
    }
    if (attentionCount > 0) {
      return `Needs attention (${attentionCount})`;
    }
    if (failedCount > 0) {
      return `Failed (${failedCount})`;
    }
    if (hasCompleted) {
      return "Complete";
    }
    return "Processing";
  }, [activeCount, attentionCount, failedCount, hasCompleted, activeJobs]);
  
  const latestCompleted = completedJobs.find(j => !hiddenJobIds.has(j.id));
  
  // Don't render if nothing to show
  if (visibleJobs.length === 0) {
    return null;
  }
  
  
  return (
    <>
      {/* Spacer */}
      <div 
        className={cn(
          "fixed bottom-0 left-0 right-0 pointer-events-none",
          isExpanded ? "h-[50vh] lg:h-auto" : "h-14"
        )}
        aria-hidden="true"
      />
      
      {/* Footer container */}
      <div 
        className={cn(
          "fixed z-50 transition-all duration-200 ease-out",
          "bottom-0 left-0 right-0",
          isExpanded && "lg:left-auto lg:right-4 lg:bottom-4 lg:w-[420px] lg:rounded-xl",
          "bg-background/95 backdrop-blur-md border-t border-border",
          isExpanded && "lg:border lg:shadow-2xl",
          !isExpanded && "shadow-[0_-4px_20px_rgba(0,0,0,0.12)]",
          "pb-safe"
        )}
        role="region"
        aria-label="Render queue status"
      >
        {/* Header bar */}
        <div 
          className={cn(
            "flex items-center justify-between cursor-pointer",
            "px-3 sm:px-4 py-3",
            "hover:bg-muted/40 active:bg-muted/60",
            "transition-colors duration-100",
            isExpanded && "border-b border-border/50"
          )}
          onClick={() => setExpanded(!isExpanded)}
          role="button"
          aria-expanded={isExpanded}
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
            ) : failedCount > 0 ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-vantage-success" />
            )}
            
            <span className="font-medium text-sm">{summaryText}</span>
            
            {/* Overall progress for active jobs */}
            {activeCount > 0 && activeJobs[0] && (
              <span className="text-xs text-muted-foreground font-mono">
                {activeJobs[0].overallProgress}%
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Quick action for completed (when collapsed) */}
            {!isExpanded && hasCompleted && activeCount === 0 && failedCount === 0 && latestCompleted && (
              <Button
                variant="default"
                size="sm"
                className="h-7 px-3 text-xs"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <Link to={`/session/${latestCompleted.sessionId}`}>
                  View
                </Link>
              </Button>
            )}
            
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" tabIndex={-1}>
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        {/* Expanded job list */}
        {isExpanded && (
          <div className={cn(
            "overflow-y-auto overscroll-contain",
            "px-3 sm:px-4 py-3",
            "max-h-[calc(50vh-60px)] sm:max-h-[40vh] lg:max-h-[50vh]"
          )}>
            <div className="space-y-2">
              {visibleJobs.map(job => (
                <RenderJobItem
                  key={job.id}
                  job={job}
                  onDismiss={handleDismiss}
                  onRetry={retryJob}
                  onCancel={cancelJob}
                />
              ))}
              
              {visibleJobs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No active jobs
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
});

export default RenderQueueFooter;
