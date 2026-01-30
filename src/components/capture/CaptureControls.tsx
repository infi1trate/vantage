import { Button } from "@/components/ui/button";
import { Loader2, Square, X, Circle, Pause, Play } from "lucide-react";
import type { CaptureState } from "@/hooks/useCaptureManager";

interface CaptureControlsProps {
  captureState: CaptureState;
  onStartRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onStopRecording: () => void;
  onStopPreview: () => void;
  onCancel: () => void;
}

export function CaptureControls({
  captureState,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onStopPreview,
  onCancel,
}: CaptureControlsProps) {
  const isPreviewReady = captureState === "preview_ready";
  const isRecording = captureState === "recording";
  const isPaused = captureState === "paused";
  const isFinalizing = captureState === "finalizing";
  const isActiveRecording = isRecording || isPaused;

  return (
    <div className="flex flex-col items-center gap-4">
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
              className="min-w-44 bg-destructive hover:bg-destructive/90 text-destructive-foreground uppercase tracking-wider font-bold"
            >
              <Circle className="mr-2 h-4 w-4" fill="currentColor" />
              Start Recording
            </Button>
          </>
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
