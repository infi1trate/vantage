import { Button } from "@/components/ui/button";
import { Loader2, Square, Pause, Play, X } from "lucide-react";

interface CaptureControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  isSaving: boolean;
  onPauseResume: () => void;
  onStop: () => void;
  onCancel: () => void;
}

export function CaptureControls({
  isRecording,
  isPaused,
  isSaving,
  onPauseResume,
  onStop,
  onCancel,
}: CaptureControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <Button
        variant="outline"
        onClick={onCancel}
        disabled={isSaving}
        className="min-w-24"
      >
        <X className="mr-2 h-4 w-4" />
        Cancel
      </Button>

      <Button
        size="lg"
        variant="outline"
        onClick={onPauseResume}
        disabled={isSaving || !isRecording}
        className="min-w-32"
      >
        {isPaused ? (
          <>
            <Play className="mr-2 h-5 w-5" />
            Resume
          </>
        ) : (
          <>
            <Pause className="mr-2 h-5 w-5" />
            Pause
          </>
        )}
      </Button>

      <Button
        size="lg"
        variant="destructive"
        onClick={onStop}
        disabled={isSaving}
        className="min-w-32"
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Square className="mr-2 h-5 w-5" fill="currentColor" />
            End Capture
          </>
        )}
      </Button>
    </div>
  );
}
