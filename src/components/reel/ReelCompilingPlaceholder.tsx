/**
 * Reel Compiling Placeholder
 * 
 * Shows assembly progress with step-based indicators.
 * Progress is TRUTHFUL - derived from actual assembly_step, NOT simulated.
 * Also handles failed state with retry option.
 */

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Film, Sparkles, AlertCircle, Clock, RefreshCw, Loader2, Check, ArrowLeft, Bell, SkipForward, Wand2, Search, FileQuestion } from "lucide-react";
import { motion } from "framer-motion";
import { AssemblyDebugPanel, type AssemblyStep } from "./AssemblyDebugPanel";
import { ClipValidationError, formatTimestamp, parseClipValidationError, parseLastError, getErrorMessage, getReasonLabel, getPrimaryCtaConfig, getErrorCategory, getAssetErrorContent } from "@/lib/reels";

import type { SegmentProgress, SegmentStatus } from "@/hooks/useReelAssembly";

/**
 * Assembly progress from useReelAssembly hook
 */
export interface AssemblyProgress {
  percent: number;
  stage: number;
  step: AssemblyStep | null;
  stepStartedAt: string | null;
  /** For collecting_clips: which segment is currently being resolved (1-indexed for display) */
  currentSegmentIndex?: number;
  /** For collecting_clips: total number of segments */
  totalSegments?: number;
  /** For collecting_clips: status of each segment */
  segments?: SegmentProgress[];
}

interface ReelCompilingPlaceholderProps {
  clipCount?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  className?: string;
  /** Whether assembly failed */
  isFailed?: boolean;
  /** Whether assembly needs attention (stalled but recoverable) */
  isNeedsAttention?: boolean;
  /** Whether waiting for source video to be ready */
  isWaitingForSource?: boolean;
  /** Error message to display (may be JSON for structured clip errors) */
  errorMessage?: string | null;
  /** Retry handler */
  onRetry?: () => Promise<void>;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Cancel handler - returns to session detail */
  onCancel?: () => void;
  /** Check session video handler - navigates to session media panel */
  onCheckSession?: () => void;
  /** Leave and notify handler - keeps job in background */
  onLeaveAndNotify?: () => void;
  /** Skip failing clip handler - removes the failing moment and retries */
  onSkipClip?: (momentId: string) => Promise<void>;
  /** Auto-fix clip handler - attempts to repair invalid range */
  onAutoFix?: (momentId: string) => Promise<void>;
  /** Real progress from assembly hook (truthful, not simulated) */
  progress?: AssemblyProgress;
  /** Debug instrumentation data */
  debugData?: {
    assemblyStep: AssemblyStep | null;
    stepStartedAt: string | null;
    stepCompletedAt: string | null;
    reelUpdatedAt: string | null;
    /** Per-segment status for debug panel */
    segments?: SegmentProgress[];
    /** Current segment being resolved (1-indexed) */
    currentSegmentIndex?: number;
    /** Total segments */
    totalSegments?: number;
  };
}

// Assembly steps configuration (MANIFEST-FIRST - only 2 steps!)
const ASSEMBLY_STEPS = [
  { id: "collecting_clips", label: "Collecting clips", range: [0, 50] },
  { id: "finalizing_manifest", label: "Creating timeline", range: [50, 100] },
] as const;

/**
 * Get active step index from current assembly step
 */
function getActiveStepFromStep(step: AssemblyStep | null): number {
  if (!step) return 0;
  
  switch (step) {
    case "collecting_clips":
      return 0;
    case "finalizing_manifest":
      return 1;
    case "ready":
      return 2; // All complete
    default:
      return 0;
  }
}

/**
 * Check if a step is complete based on current step
 */
function isStepComplete(stepIndex: number, currentStep: AssemblyStep | null): boolean {
  const activeIndex = getActiveStepFromStep(currentStep);
  return stepIndex < activeIndex || currentStep === "ready";
}

export const ReelCompilingPlaceholder = memo(function ReelCompilingPlaceholder({
  clipCount = 3,
  aspectRatio = "16:9",
  className,
  isFailed = false,
  isNeedsAttention = false,
  isWaitingForSource = false,
  errorMessage,
  onRetry,
  isRetrying = false,
  onCancel,
  onCheckSession,
  onLeaveAndNotify,
  onSkipClip,
  onAutoFix,
  progress,
  debugData,
}: ReelCompilingPlaceholderProps) {
  // Determine if we're in an error-like state (failed or needs attention)
  const hasIssue = isFailed || isNeedsAttention;

  // Parse structured clip error from errorMessage if available
  const clipError = useMemo(() => parseClipValidationError(errorMessage ?? null), [errorMessage]);
  
  // Parse structured LastError from errorMessage if available
  const lastError = useMemo(() => parseLastError(errorMessage ?? null), [errorMessage]);
  
  // Get the reason label and primary CTA config based on error type
  const reasonLabel = useMemo(() => {
    if (!clipError) return null;
    return getReasonLabel(clipError.reason);
  }, [clipError]);
  
  const primaryCta = useMemo(() => {
    if (!clipError) return null;
    return getPrimaryCtaConfig(clipError.reason);
  }, [clipError]);
  
  const errorCategory = useMemo(() => {
    if (!clipError) return null;
    return getErrorCategory(clipError.reason);
  }, [clipError]);
  
  // Get human-friendly content for asset_not_ready errors
  const assetErrorContent = useMemo(() => {
    if (!clipError || clipError.reason !== "asset_not_ready") return null;
    return getAssetErrorContent(clipError.assetStatus);
  }, [clipError]);
  
  // User-friendly error display - use getErrorMessage which handles all formats
  const displayErrorMessage = useMemo(() => {
    return getErrorMessage(errorMessage ?? null);
  }, [errorMessage]);

  // Calculate truthful progress based on resolved segments for collecting_clips
  const segmentProgress = useMemo(() => {
    if (!progress?.segments || progress.segments.length === 0) {
      return { resolvedCount: 0, totalCount: 0, progressPercent: 0 };
    }
    const resolved = progress.segments.filter(s => s.status === "resolved" || s.status === "skipped").length;
    const total = progress.segments.length;
    // collecting_clips = 0-50%, so scale resolved/total to that range
    const progressPercent = total > 0 ? Math.round((resolved / total) * 50) : 0;
    return { resolvedCount: resolved, totalCount: total, progressPercent };
  }, [progress?.segments]);
  
  // Use truthful progress: for collecting_clips, use segment-based progress
  const displayProgress = useMemo(() => {
    if (progress?.step === "collecting_clips" && segmentProgress.totalCount > 0) {
      return segmentProgress.progressPercent;
    }
    return progress?.percent ?? 0;
  }, [progress?.step, progress?.percent, segmentProgress.progressPercent, segmentProgress.totalCount]);
  
  const currentStep = progress?.step ?? null;
  const activeStepIndex = getActiveStepFromStep(currentStep);

  // Aspect ratio to padding-bottom percentage
  const aspectPadding = {
    "16:9": "56.25%",
    "9:16": "177.78%",
    "1:1": "100%",
  }[aspectRatio];

  return (
    <div className={cn("w-full h-full flex flex-col", className)}>
      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div 
          className={cn(
            "relative w-full max-w-2xl overflow-hidden rounded-xl border",
            isFailed 
              ? "bg-destructive/5 border-destructive/30"
              : isNeedsAttention
                ? "bg-vantage-warning/5 border-vantage-warning/30"
                : "bg-gradient-to-br from-muted/40 via-muted/20 to-muted/40 border-border/30"
          )}
          style={{ maxHeight: aspectRatio === "9:16" ? "70%" : undefined }}
        >
          {/* Maintain aspect ratio */}
          <div style={{ paddingBottom: aspectPadding }} />
          
          {/* Shimmer overlay - only when assembling (not failed or needs attention) */}
          {!hasIssue && (
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12"
                animate={{
                  x: ["-100%", "200%"],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
          )}
          
          {/* Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
            {isFailed ? (
              <>
                {/* Failed State - Clear recovery path */}
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>

                <div className="text-center max-w-sm">
                  <p className="text-lg font-semibold text-foreground">
                    Couldn't assemble this reel
                  </p>
                  
                  {/* Show specific failing clip with reason label */}
                  {clipError && (
                    <div className="mt-3 space-y-2">
                      {/* Reason label badge */}
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                        {errorCategory === "video_not_ready" && <Clock className="h-3 w-3" />}
                        {errorCategory === "invalid_range" && <Wand2 className="h-3 w-3" />}
                        {errorCategory === "missing_source" && <AlertCircle className="h-3 w-3" />}
                        {reasonLabel}
                      </div>
                      
                      {/* Clip info */}
                      <div className="px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/20 inline-block">
                        <p className="text-sm font-medium text-destructive">
                          {clipError.momentLabel} at {formatTimestamp(clipError.timestampSeconds)}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {!clipError && displayErrorMessage && (
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {displayErrorMessage}
                    </p>
                  )}
                </div>

                {/* Recovery CTAs - contextual based on error type */}
                <div className="flex flex-col items-center gap-3 mt-3">
                  {/* Primary CTA - based on error category */}
                  {clipError && primaryCta && (
                    <>
                      {primaryCta.action === "wait_retry" && onRetry && (
                        <Button
                          onClick={onRetry}
                          disabled={isRetrying}
                          className="gap-2 min-w-[200px]"
                          size="lg"
                        >
                          {isRetrying ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Waiting...
                            </>
                          ) : (
                            <>
                              <Clock className="h-4 w-4" />
                              {primaryCta.label}
                            </>
                          )}
                        </Button>
                      )}
                      {primaryCta.action === "auto_fix" && onAutoFix && (
                        <Button
                          onClick={() => onAutoFix(clipError.momentId)}
                          disabled={isRetrying}
                          className="gap-2 min-w-[200px]"
                          size="lg"
                        >
                          {isRetrying ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Fixing...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-4 w-4" />
                              {primaryCta.label}
                            </>
                          )}
                        </Button>
                      )}
                      {primaryCta.action === "skip_clip" && onSkipClip && (
                        <Button
                          onClick={() => onSkipClip(clipError.momentId)}
                          disabled={isRetrying}
                          className="gap-2 min-w-[200px]"
                          size="lg"
                        >
                          {isRetrying ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Skipping...
                            </>
                          ) : (
                            <>
                              <SkipForward className="h-4 w-4" />
                              {primaryCta.label}
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                  
                  {/* Secondary: Retry (if not already primary) */}
                  {onRetry && (!clipError || primaryCta?.action !== "wait_retry") && (
                    <Button
                      variant={clipError ? "outline" : "default"}
                      onClick={onRetry}
                      disabled={isRetrying}
                      className="gap-2 min-w-[200px]"
                      size="lg"
                    >
                      {isRetrying && !clipError ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Retry
                        </>
                      )}
                    </Button>
                  )}
                  
                  {/* Tertiary: Back to session */}
                  {onCancel && (
                    <button
                      onClick={onCancel}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                    >
                      Back to session
                    </button>
                  )}
                </div>

                {/* Reassurance text */}
                <p className="text-xs text-muted-foreground/70 mt-4 text-center max-w-xs">
                  {errorCategory === "video_not_ready"
                    ? "The video is still processing. Wait a moment and try again."
                    : errorCategory === "invalid_range"
                    ? "We'll automatically fix the clip timing and continue."
                    : clipError
                    ? "Skip this clip to continue with remaining clips."
                    : "Your format and selected clips are preserved — just hit retry."}
                </p>
              </>
            ) : isNeedsAttention ? (
              <>
                {/* Needs Attention State - Asset error or Specific clip issue or timeout */}
                
                {/* Asset not ready - Human-friendly display */}
                {assetErrorContent ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-vantage-warning/10 flex items-center justify-center">
                      <FileQuestion className="h-8 w-8 text-vantage-warning" />
                    </div>

                    <div className="text-center max-w-sm">
                      <p className="text-lg font-semibold text-foreground">
                        {assetErrorContent.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        {assetErrorContent.body}
                      </p>
                    </div>

                    {/* Recovery CTAs from asset error content */}
                    <div className="flex flex-col items-center gap-3 mt-3">
                      {/* Primary CTA */}
                      {assetErrorContent.primaryCta.action === "check_session" && (onCheckSession || onCancel) && (
                        <Button
                          onClick={onCheckSession || onCancel}
                          className="gap-2 min-w-[200px]"
                          size="lg"
                        >
                          <Search className="h-4 w-4" />
                          {assetErrorContent.primaryCta.label}
                        </Button>
                      )}
                      {assetErrorContent.primaryCta.action === "wait_retry" && onRetry && (
                        <Button
                          onClick={onRetry}
                          disabled={isRetrying}
                          className="gap-2 min-w-[200px]"
                          size="lg"
                        >
                          {isRetrying ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Checking...
                            </>
                          ) : (
                            <>
                              <Clock className="h-4 w-4" />
                              {assetErrorContent.primaryCta.label}
                            </>
                          )}
                        </Button>
                      )}
                      {assetErrorContent.primaryCta.action === "back_to_session" && onCancel && (
                        <Button
                          onClick={onCancel}
                          className="gap-2 min-w-[200px]"
                          size="lg"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          {assetErrorContent.primaryCta.label}
                        </Button>
                      )}

                      {/* Secondary CTA */}
                      {assetErrorContent.secondaryCta.action === "leave_notify" && onLeaveAndNotify && (
                        <Button
                          variant="outline"
                          onClick={onLeaveAndNotify}
                          className="gap-2 min-w-[200px]"
                          size="lg"
                        >
                          <Bell className="h-4 w-4" />
                          {assetErrorContent.secondaryCta.label}
                        </Button>
                      )}
                      {assetErrorContent.secondaryCta.action === "back_to_session" && onCancel && 
                       assetErrorContent.primaryCta.action !== "back_to_session" && (
                        <Button
                          variant="outline"
                          onClick={onCancel}
                          className="gap-2 min-w-[200px]"
                          size="lg"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          {assetErrorContent.secondaryCta.label}
                        </Button>
                      )}

                      {/* Tertiary CTA - text link */}
                      {assetErrorContent.tertiaryCta && (
                        <>
                          {assetErrorContent.tertiaryCta.action === "back_to_session" && onCancel && 
                           assetErrorContent.primaryCta.action !== "back_to_session" &&
                           assetErrorContent.secondaryCta.action !== "back_to_session" && (
                            <button
                              onClick={onCancel}
                              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                            >
                              {assetErrorContent.tertiaryCta.label}
                            </button>
                          )}
                          {assetErrorContent.tertiaryCta.action === "retry" && onRetry && (
                            <button
                              onClick={onRetry}
                              disabled={isRetrying}
                              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline disabled:opacity-50"
                            >
                              Retry
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Standard clip error or timeout display */}
                    <div className="w-16 h-16 rounded-full bg-vantage-warning/10 flex items-center justify-center">
                      {errorCategory === "video_not_ready" ? (
                        <Clock className="h-8 w-8 text-vantage-warning" />
                      ) : errorCategory === "invalid_range" ? (
                        <Wand2 className="h-8 w-8 text-vantage-warning" />
                      ) : clipError ? (
                        <AlertCircle className="h-8 w-8 text-vantage-warning" />
                      ) : (
                        <Clock className="h-8 w-8 text-vantage-warning" />
                      )}
                    </div>

                    <div className="text-center max-w-sm">
                      <p className="text-lg font-semibold text-foreground">
                        {clipError
                          ? "We hit an issue assembling one clip"
                          : "This is taking longer than expected"}
                      </p>
                      
                      {/* Show specific failing clip with reason label */}
                      {clipError && (
                        <div className="mt-3 space-y-2">
                          {/* Reason label badge */}
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-vantage-warning/10 text-vantage-warning text-xs font-medium">
                            {errorCategory === "video_not_ready" && <Clock className="h-3 w-3" />}
                            {errorCategory === "invalid_range" && <Wand2 className="h-3 w-3" />}
                            {errorCategory === "missing_source" && <AlertCircle className="h-3 w-3" />}
                            {reasonLabel}
                          </div>
                          
                          {/* Clip info */}
                          <div className="px-4 py-2 rounded-lg bg-vantage-warning/10 border border-vantage-warning/20 inline-block">
                            <p className="text-sm font-medium text-vantage-warning">
                              {clipError.momentLabel} at {formatTimestamp(clipError.timestampSeconds)}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {!clipError && displayErrorMessage && (
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                          {displayErrorMessage}
                        </p>
                      )}
                    </div>

                    {/* Recovery CTAs - contextual based on error type */}
                    <div className="flex flex-col items-center gap-3 mt-3">
                      {/* Primary CTA - based on error category */}
                      {clipError && primaryCta && (
                        <>
                          {primaryCta.action === "wait_retry" && onRetry && (
                            <Button
                              onClick={onRetry}
                              disabled={isRetrying}
                              className="gap-2 min-w-[200px]"
                              size="lg"
                            >
                              {isRetrying ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Waiting...
                                </>
                              ) : (
                                <>
                                  <Clock className="h-4 w-4" />
                                  {primaryCta.label}
                                </>
                              )}
                            </Button>
                          )}
                          {primaryCta.action === "auto_fix" && onAutoFix && (
                            <Button
                              onClick={() => onAutoFix(clipError.momentId)}
                              disabled={isRetrying}
                              className="gap-2 min-w-[200px]"
                              size="lg"
                            >
                              {isRetrying ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Fixing...
                                </>
                              ) : (
                                <>
                                  <Wand2 className="h-4 w-4" />
                                  {primaryCta.label}
                                </>
                              )}
                            </Button>
                          )}
                          {primaryCta.action === "skip_clip" && onSkipClip && (
                            <Button
                              onClick={() => onSkipClip(clipError.momentId)}
                              disabled={isRetrying}
                              className="gap-2 min-w-[200px]"
                              size="lg"
                            >
                              {isRetrying ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Skipping...
                                </>
                              ) : (
                                <>
                                  <SkipForward className="h-4 w-4" />
                                  {primaryCta.label}
                                </>
                              )}
                            </Button>
                          )}
                        </>
                      )}

                      {/* Secondary: Retry (if not already primary) */}
                      {onRetry && (!clipError || primaryCta?.action !== "wait_retry") && (
                        <Button
                          variant={clipError ? "outline" : "default"}
                          onClick={onRetry}
                          disabled={isRetrying}
                          className="gap-2 min-w-[200px]"
                          size="lg"
                        >
                          {isRetrying && !clipError ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Retrying...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4" />
                              Retry
                            </>
                          )}
                        </Button>
                      )}

                      {/* Leave and notify me (only show if no specific clip error - timeout scenario) */}
                      {!clipError && onLeaveAndNotify && (
                        <Button
                          variant="outline"
                          onClick={onLeaveAndNotify}
                          className="gap-2 min-w-[200px]"
                          size="lg"
                        >
                          <Bell className="h-4 w-4" />
                          Leave and notify me
                        </Button>
                      )}

                      {/* Tertiary: Back to session */}
                      {onCancel && (
                        <button
                          onClick={onCancel}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                        >
                          Back to session
                        </button>
                      )}
                    </div>

                    {/* Reassurance text */}
                    <p className="text-xs text-muted-foreground/70 mt-4 text-center max-w-xs">
                      {errorCategory === "video_not_ready"
                        ? "The video is still processing. Wait a moment and try again."
                        : errorCategory === "invalid_range"
                        ? "We'll automatically fix the clip timing and continue."
                        : clipError
                        ? "Skip this clip to continue with remaining clips."
                        : "Your format and clips are saved. You'll get a notification when it's ready."}
                    </p>
                  </>
                )}
              </>
            ) : isWaitingForSource ? (
              <>
                {/* Waiting for Source State */}
                <motion.div
                  className="relative"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <motion.div
                    className="absolute -top-1 -right-1"
                    animate={{ 
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  </motion.div>
                </motion.div>
                
                {/* Title + Subtitle */}
                <div className="text-center">
                  <p className="text-base font-semibold text-foreground">
                    Finishing session processing…
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Reel will assemble when ready.
                  </p>
                </div>
                
                {/* Pulsing progress indicator */}
                <div className="w-full max-w-xs">
                  <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-primary/50 rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: ["0%", "30%", "0%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                </div>
                
                {/* Background helper text */}
                <p className="text-xs text-muted-foreground/70 text-center mt-2">
                  You can leave this page — we'll keep working in the background.
                </p>
                
                {/* Leave and notify / Cancel options */}
                <div className="flex flex-col items-center gap-3 mt-3">
                  {onLeaveAndNotify && (
                    <Button
                      variant="outline"
                      onClick={onLeaveAndNotify}
                      className="gap-2 min-w-[200px]"
                      size="lg"
                    >
                      <Bell className="h-4 w-4" />
                      Leave and notify me
                    </Button>
                  )}
                  
                  {onCancel && (
                    <button
                      onClick={onCancel}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                    >
                      Back to session
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Assembling State */}
                <motion.div
                  className="relative"
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Film className="h-8 w-8 text-primary" />
                  </div>
                  <motion.div
                    className="absolute -top-1 -right-1"
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="h-5 w-5 text-vantage-warning" />
                  </motion.div>
                </motion.div>
                
                {/* Title + Subtitle */}
                <div className="text-center">
                  <p className="text-base font-semibold text-foreground">
                    Assembling your reel…
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Stitching clips + preparing preview
                  </p>
                </div>
                
                {/* Step-based Progress */}
                <div className="w-full max-w-xs space-y-3">
                  {/* Progress bar */}
                  <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${displayProgress}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                  
                  {/* Step checklist */}
                  <div className="space-y-2">
                    {ASSEMBLY_STEPS.map((step, index) => {
                      const isComplete = isStepComplete(index, currentStep);
                      const isActive = index === activeStepIndex && !isComplete && currentStep !== "ready";
                      
                      return (
                        <div
                          key={step.id}
                          className={cn(
                            "flex items-center gap-2.5 text-sm transition-opacity",
                            isComplete ? "opacity-100" : isActive ? "opacity-100" : "opacity-40"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors",
                            isComplete 
                              ? "bg-vantage-success text-white" 
                              : isActive 
                                ? "bg-primary/20 border-2 border-primary"
                                : "bg-muted/50 border border-border"
                          )}>
                            {isComplete ? (
                              <Check className="h-3 w-3" />
                            ) : isActive ? (
                              <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            ) : null}
                          </div>
                          <span className={cn(
                            "font-medium flex-1",
                            isComplete 
                              ? "text-vantage-success" 
                              : isActive 
                                ? "text-foreground"
                                : "text-muted-foreground"
                          )}>
                            {/* Show "Resolving clip X of Y" when actively collecting clips */}
                            {isActive && step.id === "collecting_clips" && segmentProgress.totalCount > 0 ? (
                              <span>
                                Resolving clip {segmentProgress.resolvedCount + 1} of {segmentProgress.totalCount}
                                {segmentProgress.resolvedCount > 0 && (
                                  <span className="text-vantage-success/80 ml-1">
                                    ({segmentProgress.resolvedCount} done)
                                  </span>
                                )}
                              </span>
                            ) : isActive && step.id === "collecting_clips" && progress?.currentSegmentIndex !== undefined && progress?.totalSegments ? (
                              <span>Resolving clip {progress.currentSegmentIndex} of {progress.totalSegments}</span>
                            ) : (
                              step.label
                            )}
                          </span>
                          {isActive && (
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                              {Math.round(displayProgress)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Background helper text */}
                <p className="text-xs text-muted-foreground/70 text-center mt-2">
                  Running in background — you can leave this page, we'll keep working.
                </p>
                
                {/* Debug panel - subtle instrumentation for dev visibility */}
                {debugData && (
                  <AssemblyDebugPanel
                    currentStep={debugData.assemblyStep}
                    stepStartedAt={debugData.stepStartedAt}
                    stepCompletedAt={debugData.stepCompletedAt}
                    reelUpdatedAt={debugData.reelUpdatedAt}
                    segments={debugData.segments}
                    currentSegmentIndex={debugData.currentSegmentIndex}
                    totalSegments={debugData.totalSegments}
                  />
                )}
                
                {/* Cancel option */}
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 underline-offset-2 hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Timeline Placeholder */}
      <div className="shrink-0 px-4 pb-4">
        <div className={cn(
          "rounded-lg border p-3",
          isFailed 
            ? "bg-destructive/5 border-destructive/20"
            : isNeedsAttention
              ? "bg-vantage-warning/5 border-vantage-warning/20"
              : "bg-muted/20 border-border/30"
        )}>
          {/* Timeline header */}
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
            <div className="flex-1" />
            <Skeleton className="h-3 w-12" />
          </div>
          
          {/* Placeholder clip blocks */}
          <div className="flex gap-1.5 h-12">
            {Array.from({ length: Math.min(clipCount, 5) }).map((_, i) => (
              <motion.div
                key={i}
                className={cn(
                  "flex-1 rounded border",
                  isFailed 
                    ? "bg-destructive/10 border-destructive/20"
                    : isNeedsAttention
                      ? "bg-vantage-warning/10 border-vantage-warning/20"
                      : "bg-muted/50 border-border/20"
                )}
                initial={{ opacity: 0.3 }}
                animate={hasIssue ? {} : { opacity: [0.3, 0.5, 0.3] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
          
          {/* Disabled message */}
          <p className={cn(
            "text-[10px] text-center mt-2",
            isFailed 
              ? "text-destructive/60" 
              : isNeedsAttention
                ? "text-vantage-warning/60"
                : "text-muted-foreground/60"
          )}>
            {isFailed 
              ? "Assembly must complete before editing"
              : isNeedsAttention
                ? "Waiting for assembly to complete"
                : "FX and editing will be available once assembly completes"
            }
          </p>
        </div>
      </div>
    </div>
  );
});

export default ReelCompilingPlaceholder;
