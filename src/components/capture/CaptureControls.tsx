import { Button } from "@/components/ui/button";
import { Loader2, Square, X, Circle, Pause, Play } from "lucide-react";
import type { CaptureState } from "@/hooks/useCaptureManager";
import { type PreflightCheck } from "@/hooks/usePreflightChecks";
import { PreflightChecklist } from "./PreflightChecklist";

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
}: CaptureControlsProps) {
  const isPreviewReady = captureState === "preview_ready";
  const isStarting = captureState === "starting";
  const isRecording = captureState === "recording";
  const isPaused = captureState === "paused";
  const isFinalizing = captureState === "finalizing";
  const isActiveRecording = isRecording || isPaused;
  
  const canStartRecording = preflightPassed && !preflightRunning && !isStarting;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Preflight checklist - only show in preview_ready state */}
      {isPreviewReady && preflightChecks && preflightChecks.length > 0 && (
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

        {/* Preview Ready: Show "Start Recording" button */}
        {isPreviewReady && (
          <>
            <Button
              variant="outline"
              onClick={onStopPreview}
              className="min-w-32 uppercase tracking-wider text-xs"
            >
              Stop Preview
            </Button>
            
            <Button
              size="lg"
              onClick={onStartRecording}
              disabled={!canStartRecording}
              className="min-w-44 bg-destructive hover:bg-destructive/90 text-destructive-foreground uppercase tracking-wider font-bold disabled:opacity-50"
            >
              <Circle className="mr-2 h-4 w-4" fill="currentColor" />
              Start Recording
            </Button>
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
