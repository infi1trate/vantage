import { Button } from "@/components/ui/button";
import { Loader2, Square, Play, X, Circle } from "lucide-react";
import type { CaptureState } from "@/hooks/useCaptureManager";

interface CaptureControlsProps {
  captureState: CaptureState;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onStopPreview: () => void;
  onCancel: () => void;
}

export function CaptureControls({
  captureState,
  onStartRecording,
  onStopRecording,
  onStopPreview,
  onCancel,
}: CaptureControlsProps) {
  const isPreviewReady = captureState === "preview_ready";
  const isRecording = captureState === "recording";
  const isFinalizing = captureState === "finalizing";

  return (
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
            className="min-w-40 bg-destructive hover:bg-destructive/90 text-destructive-foreground uppercase tracking-wider font-bold"
          >
            <Circle className="mr-2 h-4 w-4" fill="currentColor" />
            Start Recording
          </Button>
        </>
      )}

      {/* Recording: Show "End Capture" button */}
      {isRecording && (
        <Button
          size="lg"
          variant="destructive"
          onClick={onStopRecording}
          className="min-w-40 uppercase tracking-wider font-bold"
        >
          <Square className="mr-2 h-5 w-5" fill="currentColor" />
          End Capture
        </Button>
      )}

      {/* Finalizing: Show saving indicator */}
      {isFinalizing && (
        <Button
          size="lg"
          variant="secondary"
          disabled
          className="min-w-40 uppercase tracking-wider"
        >
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Saving...
        </Button>
      )}
    </div>
  );
}
