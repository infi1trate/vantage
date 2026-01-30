import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Square, X, Circle, Pause, Play, Eye, Chrome, ExternalLink, AlertTriangle, Copy, Check, RotateCcw } from "lucide-react";
import type { CaptureState, CaptureError } from "@/hooks/useCaptureManager";
import { type PreflightCheck } from "@/hooks/usePreflightChecks";
import { PreflightChecklist } from "./PreflightChecklist";
import { useState } from "react";
import { toast } from "sonner";

interface CaptureControlsProps {
  captureState: CaptureState;
  onStartRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onStopRecording: () => void;
  onStopPreview: () => void;
  onCancel: () => void;
  // Preflight props
  preflightChecks?: PreflightCheck[];
  preflightPassed?: boolean;
  preflightRunning?: boolean;
  // Preview-only mode props
  previewOnly?: boolean;
  recordingDisabledReason?: string | null;
  // Inline recording error (shown when start recording fails but preview stays active)
  inlineError?: CaptureError | null;
  onDismissError?: () => void;
  onRetryRecording?: () => void;
}

export function CaptureControls({
  captureState,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onStopPreview,
  onCancel,
  preflightChecks,
  preflightPassed = true,
  preflightRunning = false,
  previewOnly = false,
  recordingDisabledReason,
  inlineError,
  onDismissError,
  onRetryRecording,
}: CaptureControlsProps) {
  const [copied, setCopied] = useState(false);
  
  const isPreviewReady = captureState === "preview_ready";
  const isStarting = captureState === "starting";
  const isRecording = captureState === "recording";
  const isPaused = captureState === "paused";
  const isFinalizing = captureState === "finalizing";
  const isActiveRecording = isRecording || isPaused;
  
  const canStartRecording = !previewOnly && preflightPassed && !preflightRunning && !isStarting && !inlineError;

  // Copy diagnostics for inline error
  const handleCopyDiagnostics = async () => {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      error: inlineError,
      userAgent: navigator.userAgent,
      isSecureContext: window.isSecureContext,
      mediaRecorderSupported: typeof MediaRecorder !== "undefined",
    };
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setCopied(true);
      toast.success("Diagnostics copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Inline Recording Error - shown when start recording fails but preview stays active */}
      {isPreviewReady && inlineError && (
        <Alert variant="destructive" className="w-full max-w-xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="uppercase tracking-wider text-xs">
            {inlineError.code === "NO_COMPATIBLE_FORMAT" || inlineError.code === "RECORDER_UNSUPPORTED"
              ? "This Browser Can't Record This Format"
              : inlineError.code === "STREAM_NOT_READY"
              ? "Capture Stream Not Ready"
              : "Recording Failed"}
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p className="text-sm">{inlineError.message}</p>
            {inlineError.details && (
              <p className="text-xs text-muted-foreground font-mono bg-muted/30 p-2 rounded">{inlineError.details}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {/* Retry button for recoverable errors */}
              {inlineError.recoverable && onRetryRecording && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onRetryRecording}
                  className="text-xs"
                >
                  <RotateCcw className="mr-1.5 h-3 w-3" />
                  Retry
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyDiagnostics}
                className="text-xs"
              >
                {copied ? <Check className="mr-1.5 h-3 w-3" /> : <Copy className="mr-1.5 h-3 w-3" />}
                {copied ? "Copied" : "Copy Diagnostics"}
              </Button>
              {/* Show Chrome link only for browser capability errors */}
              {(inlineError.code === "NO_COMPATIBLE_FORMAT" || inlineError.code === "RECORDER_UNSUPPORTED") && (
                <a
                  href="https://www.google.com/chrome/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="text-xs">
                    <Chrome className="mr-1.5 h-3 w-3" />
                    Get Chrome
                    <ExternalLink className="ml-1.5 h-3 w-3" />
                  </Button>
                </a>
              )}
              {onDismissError && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismissError}
                  className="text-xs"
                >
                  Dismiss
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Preview Mode Banner - shown when recording is disabled */}
      {isPreviewReady && previewOnly && (
        <div className="w-full max-w-xl p-4 bg-warning/10 border border-warning/30 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-warning" />
            <span className="text-sm font-medium text-warning uppercase tracking-wider">
              Preview Mode
            </span>
            <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">
              Recording Disabled
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {recordingDisabledReason || "Recording is not supported in this browser."}
          </p>
          <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
            <Chrome className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Open in <strong>Chrome</strong> or <strong>Edge</strong> to record
            </span>
            <a
              href="https://www.google.com/chrome/"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Get Chrome
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {/* Preflight checklist - only show in preview_ready state when NOT in preview-only mode */}
      {isPreviewReady && !previewOnly && preflightChecks && preflightChecks.length > 0 && (
        <PreflightChecklist 
          checks={preflightChecks} 
          allPassed={preflightPassed} 
          isRunning={preflightRunning}
        />
      )}
      
      {/* Main controls row */}
      <div className="flex items-center justify-center gap-4">
        {/* Cancel - always available except when finalizing */}
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isFinalizing}
          className="min-w-24 uppercase tracking-wider text-xs"
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>

        {/* Preview Ready: Show "Start Recording" button (or disabled in preview-only mode) */}
        {isPreviewReady && (
          <>
            <Button
              variant="outline"
              onClick={onStopPreview}
              className="min-w-32 uppercase tracking-wider text-xs"
            >
              Stop Preview
            </Button>
            
            {previewOnly ? (
              <Button
                size="lg"
                disabled
                className="min-w-44 bg-muted text-muted-foreground uppercase tracking-wider font-bold cursor-not-allowed"
              >
                <Circle className="mr-2 h-4 w-4" />
                Recording Disabled
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={onStartRecording}
                disabled={!canStartRecording}
                className="min-w-44 bg-destructive hover:bg-destructive/90 text-destructive-foreground uppercase tracking-wider font-bold disabled:opacity-50"
              >
                <Circle className="mr-2 h-4 w-4" fill="currentColor" />
                Start Recording
              </Button>
            )}
          </>
        )}

        {/* Starting: Waiting for first data chunk */}
        {isStarting && (
          <Button
            size="lg"
            variant="secondary"
            disabled
            className="min-w-44 uppercase tracking-wider"
          >
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Starting...
          </Button>
        )}

        {/* Recording/Paused: Show Pause/Resume and End Recording buttons */}
        {isActiveRecording && (
          <>
            {isRecording ? (
              <Button
                size="lg"
                variant="outline"
                onClick={onPauseRecording}
                className="min-w-32 uppercase tracking-wider font-medium"
              >
                <Pause className="mr-2 h-5 w-5" />
                Pause
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                onClick={onResumeRecording}
                className="min-w-32 uppercase tracking-wider font-medium border-primary text-primary hover:bg-primary/10"
              >
                <Play className="mr-2 h-5 w-5" />
                Resume
              </Button>
            )}
            
            <Button
              size="lg"
              variant="destructive"
              onClick={onStopRecording}
              className="min-w-44 uppercase tracking-wider font-bold"
            >
              <Square className="mr-2 h-5 w-5" fill="currentColor" />
              End Recording
            </Button>
          </>
        )}

        {/* Finalizing: Show saving indicator */}
        {isFinalizing && (
          <Button
            size="lg"
            variant="secondary"
            disabled
            className="min-w-44 uppercase tracking-wider"
          >
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Finalizing...
          </Button>
        )}
      </div>

      {/* Keyboard hint */}
      {isActiveRecording && (
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-foreground font-mono">Space</kbd> to {isRecording ? "pause" : "resume"}
        </p>
      )}
    </div>
  );
}
