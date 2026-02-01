/**
 * Cloud Processing Placeholder
 * 
 * Shows a placeholder UI when a cloud session is still being processed.
 * Used for sessions created by the extension that are awaiting transcoding.
 * Includes auto-refresh polling.
 */

import { memo, useEffect, useState, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  Clock,
  Upload,
  Video,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CloudProcessingStatus = "recording" | "processing" | "uploading" | "ready" | "failed";

interface CloudProcessingPlaceholderProps {
  sessionId: string;
  sessionTitle: string;
  status: CloudProcessingStatus;
  onStatusChange?: (newStatus: CloudProcessingStatus) => void;
  onRetry?: () => void;
  className?: string;
}

/**
 * Generate a deterministic placeholder color based on session id
 */
function getPlaceholderColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 40%, 15%)`;
}

export const CloudProcessingPlaceholder = memo(function CloudProcessingPlaceholder({
  sessionId,
  sessionTitle,
  status,
  onStatusChange,
  onRetry,
  className,
}: CloudProcessingPlaceholderProps) {
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Simulate progress for visual feedback
  useEffect(() => {
    if (status === "ready" || status === "failed") {
      setProgress(status === "ready" ? 100 : 0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
      setProgress(prev => {
        // Slow asymptotic approach to 95%
        const target = status === "uploading" ? 90 : 95;
        const rate = status === "uploading" ? 0.5 : 0.3;
        return prev + (target - prev) * rate * 0.1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const getStatusIcon = () => {
    switch (status) {
      case "recording":
        return <Clock className="h-12 w-12" />;
      case "processing":
        return <Loader2 className="h-12 w-12 animate-spin" />;
      case "uploading":
        return <Upload className="h-12 w-12 animate-pulse" />;
      case "ready":
        return <CheckCircle2 className="h-12 w-12 text-green-400" />;
      case "failed":
        return <AlertCircle className="h-12 w-12 text-destructive" />;
      default:
        return <Video className="h-12 w-12" />;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case "recording":
        return "Recording in progress...";
      case "processing":
        return "Processing your recording...";
      case "uploading":
        return "Uploading to cloud...";
      case "ready":
        return "Ready to play!";
      case "failed":
        return "Processing failed";
      default:
        return "Processing...";
    }
  };

  const getSubMessage = () => {
    switch (status) {
      case "recording":
        return "Your video is being captured";
      case "processing":
        return "This usually takes a few moments";
      case "uploading":
        return "Almost there...";
      case "ready":
        return "Refreshing page...";
      case "failed":
        return "Something went wrong. You can try again.";
      default:
        return "Please wait while we prepare your video";
    }
  };

  const formatElapsed = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }, []);

  const isProcessing = status === "recording" || status === "processing" || status === "uploading";

  return (
    <div 
      className={cn(
        "relative aspect-video w-full rounded-lg overflow-hidden flex flex-col items-center justify-center",
        className
      )}
      style={{ backgroundColor: getPlaceholderColor(sessionId) }}
    >
      {/* Center content */}
      <div className="flex flex-col items-center gap-4 text-white/70">
        {getStatusIcon()}
        <div className="text-center max-w-sm">
          <h3 className="font-semibold text-lg text-white/90">
            {getStatusMessage()}
          </h3>
          <p className="text-sm text-white/50 mt-1">
            {getSubMessage()}
          </p>
          {isProcessing && elapsedSeconds > 5 && (
            <p className="text-xs text-white/40 mt-2 font-mono-data">
              Elapsed: {formatElapsed(elapsedSeconds)}
            </p>
          )}
        </div>

        {/* Retry button for failed state */}
        {status === "failed" && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2 gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}
      </div>

      {/* Progress bar at bottom for processing states */}
      {isProcessing && (
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center justify-between text-xs text-white/80 mb-2">
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {getStatusMessage()}
              </span>
              <span className="font-mono-data">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>
      )}

      {/* Auto-refresh indicator */}
      {isProcessing && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-1.5 text-xs text-white/50 bg-black/30 px-2 py-1 rounded">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Auto-refreshing
          </div>
        </div>
      )}
    </div>
  );
});

export default CloudProcessingPlaceholder;
