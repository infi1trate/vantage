/**
 * Processing Placeholder
 * 
 * Shows a placeholder UI when video is still being processed.
 * Displays progress and status in the video player area.
 */

import { memo } from "react";
import { ProcessingJob } from "@/lib/processingJobs";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  Clock,
  Upload,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessingPlaceholderProps {
  job: ProcessingJob;
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

export const ProcessingPlaceholder = memo(function ProcessingPlaceholder({
  job,
  className,
}: ProcessingPlaceholderProps) {
  const getStatusIcon = () => {
    switch (job.status) {
      case "queued":
        return <Clock className="h-12 w-12" />;
      case "processing":
        return <Loader2 className="h-12 w-12 animate-spin" />;
      case "uploading":
        return <Upload className="h-12 w-12 animate-pulse" />;
      default:
        return <Video className="h-12 w-12" />;
    }
  };

  const getStatusMessage = () => {
    if (job.step) return job.step;
    switch (job.status) {
      case "queued":
        return "Waiting in queue...";
      case "processing":
        return "Processing video...";
      case "uploading":
        return "Uploading to cloud...";
      default:
        return "Processing...";
    }
  };

  return (
    <div 
      className={cn(
        "relative aspect-video w-full rounded-lg overflow-hidden flex flex-col items-center justify-center",
        className
      )}
      style={{ backgroundColor: getPlaceholderColor(job.sessionId) }}
    >
      {/* Center content */}
      <div className="flex flex-col items-center gap-4 text-white/70">
        {getStatusIcon()}
        <div className="text-center">
          <h3 className="font-semibold text-lg text-white/90">
            {getStatusMessage()}
          </h3>
          <p className="text-sm text-white/50 mt-1">
            Video will be available once processing completes
          </p>
        </div>
      </div>

      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-white/80 mb-2">
            <span>{getStatusMessage()}</span>
            <span className="font-mono-data">{Math.round(job.progress)}%</span>
          </div>
          <Progress value={job.progress} className="h-1.5" />
        </div>
      </div>
    </div>
  );
});

export default ProcessingPlaceholder;
