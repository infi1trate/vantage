/**
 * Processing Session Card
 * 
 * Displays a session that is currently being processed in the background.
 * Shows progress indicator and skeleton thumbnail until complete.
 */

import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ProcessingJob } from "@/lib/processingJobs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Loader2, 
  MoreVertical, 
  X,
  Clock,
  Gamepad2,
  Video,
  Mic,
  Camera,
  Volume2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { formatBytes } from "@/lib/localSessionStorage";

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
  return `hsl(${hue}, 40%, 25%)`;
}

interface ProcessingSessionCardProps {
  job: ProcessingJob;
  viewMode: "grid" | "list";
  onCancel?: (jobId: string) => void;
  onRetry?: (jobId: string) => void;
}

export const ProcessingSessionCard = memo(function ProcessingSessionCard({ 
  job, 
  viewMode,
  onCancel,
  onRetry,
}: ProcessingSessionCardProps) {
  const navigate = useNavigate();
  const [showProcessingDialog, setShowProcessingDialog] = useState(false);
  
  const isActive = job.status === "queued" || job.status === "processing" || job.status === "uploading";
  const isFailed = job.status === "failed";
  
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const statusLabel = useMemo(() => {
    if (job.step) return job.step;
    switch (job.status) {
      case "queued": return "Queued";
      case "processing": return "Processing";
      case "uploading": return "Uploading";
      case "failed": return "Failed";
      case "cancelled": return "Cancelled";
      default: return "Processing";
    }
  }, [job.status, job.step]);

  const handleCardClick = () => {
    if (job.outputReady) {
      // Video is ready, navigate to detail
      navigate(`/session/${job.sessionId}`);
    } else {
      // Still processing, show interstitial dialog
      setShowProcessingDialog(true);
    }
  };

  const handleComeBackLater = () => {
    setShowProcessingDialog(false);
  };

  const handleViewAnyway = () => {
    setShowProcessingDialog(false);
    navigate(`/session/${job.sessionId}`);
  };

  // LIST VIEW
  if (viewMode === "list") {
    return (
      <>
        <Card 
          className={cn(
            "group flex items-center gap-4 p-4 bg-card border-border/50 transition-all",
            isActive && "border-primary/30",
            isFailed && "border-destructive/30",
            job.outputReady && "cursor-pointer hover:border-primary/50"
          )}
          onClick={handleCardClick}
        >
          {/* Thumbnail placeholder */}
          <div className="shrink-0">
            <div className="w-40 aspect-video relative bg-muted/50 rounded-lg overflow-hidden">
              {/* Animated skeleton or placeholder */}
              <div 
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: getPlaceholderColor(job.sessionId) }}
              >
                {isActive ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 text-white/50 animate-spin" />
                  </div>
                ) : isFailed ? (
                  <AlertCircle className="h-8 w-8 text-destructive/70" />
                ) : (
                  <Gamepad2 className="h-8 w-8 text-white/30" />
                )}
              </div>
              {/* Duration badge */}
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm">
                <span className="text-xs font-mono-data font-medium">{formatDuration(job.duration)}</span>
              </div>
              {/* Processing badge */}
              <div className="absolute top-1 right-1">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    isActive && "bg-primary/20 text-primary border-primary/30",
                    isFailed && "bg-destructive/20 text-destructive border-destructive/30"
                  )}
                >
                  {isActive && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  {statusLabel}
                </Badge>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {job.sessionTitle}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
              </span>
              <span>{formatBytes(job.blobSize)}</span>
            </div>
            
            {/* Progress bar for active jobs */}
            {isActive && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{statusLabel}</span>
                  <span>{Math.round(job.progress)}%</span>
                </div>
                <Progress value={job.progress} className="h-1.5" />
              </div>
            )}
            
            {/* Error message for failed jobs */}
            {isFailed && job.errorMessage && (
              <p className="mt-2 text-xs text-destructive line-clamp-2">
                {job.errorMessage}
              </p>
            )}
            
            {/* Capture types */}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs gap-1">
                <Video className="h-3 w-3" /> Video
              </Badge>
              {job.hasMic && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Mic className="h-3 w-3" /> Mic
                </Badge>
              )}
              {job.hasCam && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Camera className="h-3 w-3" /> Cam
                </Badge>
              )}
              {job.hasSystemAudio && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Volume2 className="h-3 w-3" /> Audio
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {isFailed && onRetry && job.retryCount < job.maxRetries && (
              <Button size="sm" variant="outline" onClick={() => onRetry(job.id)}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
            {isActive && onCancel && (
              <Button size="sm" variant="ghost" onClick={() => onCancel(job.id)}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {isFailed && onRetry && job.retryCount < job.maxRetries && (
                  <DropdownMenuItem onClick={() => onRetry(job.id)}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Retry
                  </DropdownMenuItem>
                )}
                {isActive && onCancel && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={() => onCancel(job.id)}
                    >
                      <X className="h-4 w-4 mr-2" /> Cancel
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>

        {/* Processing interstitial dialog */}
        <Dialog open={showProcessingDialog} onOpenChange={setShowProcessingDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Still Processing
              </DialogTitle>
              <DialogDescription className="space-y-3">
                <p>
                  <strong>{job.sessionTitle}</strong> is still being processed.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{statusLabel}</span>
                    <span className="font-mono-data">{Math.round(job.progress)}%</span>
                  </div>
                  <Progress value={job.progress} className="h-2" />
                </div>
                <p className="text-sm">
                  You can come back later when processing is complete, or view the session now (playback may be limited).
                </p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleComeBackLater}>
                Come Back Later
              </Button>
              <Button onClick={handleViewAnyway}>
                View Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // GRID VIEW
  return (
    <>
      <Card 
        className={cn(
          "group relative overflow-hidden bg-card border-border/50 transition-all duration-300",
          isActive && "border-primary/30",
          isFailed && "border-destructive/30",
          job.outputReady && "cursor-pointer hover:border-primary/50 card-hover"
        )}
        onClick={handleCardClick}
      >
        {/* Thumbnail */}
        <div className="aspect-video relative bg-muted/50 overflow-hidden">
          {/* Animated placeholder */}
          <div 
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: getPlaceholderColor(job.sessionId) }}
          >
            {isActive ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-10 w-10 text-white/50 animate-spin" />
                <span className="text-xs text-white/50 font-medium">{statusLabel}</span>
              </div>
            ) : isFailed ? (
              <div className="flex flex-col items-center gap-2">
                <AlertCircle className="h-10 w-10 text-destructive/70" />
                <span className="text-xs text-destructive/70 font-medium">Failed</span>
              </div>
            ) : (
              <Gamepad2 className="h-12 w-12 text-white/30" />
            )}
          </div>
          
          {/* Progress bar overlay for active jobs */}
          {isActive && (
            <div className="absolute bottom-0 left-0 right-0 px-2 pb-2">
              <div className="bg-background/80 backdrop-blur-sm rounded p-2">
                <div className="flex items-center justify-between text-xs text-foreground mb-1">
                  <span>{statusLabel}</span>
                  <span className="font-mono-data">{Math.round(job.progress)}%</span>
                </div>
                <Progress value={job.progress} className="h-1.5" />
              </div>
            </div>
          )}

          {/* Duration badge */}
          {!isActive && (
            <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-background/80 backdrop-blur-sm">
              <span className="text-xs font-mono-data font-medium">{formatDuration(job.duration)}</span>
            </div>
          )}

          {/* Processing badge */}
          <div className="absolute top-2 left-2">
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                isActive && "bg-primary/20 text-primary border-primary/30",
                isFailed && "bg-destructive/20 text-destructive border-destructive/30"
              )}
            >
              {isActive && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {isActive ? "Processing..." : isFailed ? "Failed" : "Processing"}
            </Badge>
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {job.sessionTitle}
              </h3>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isFailed && onRetry && job.retryCount < job.maxRetries && (
                    <DropdownMenuItem onClick={() => onRetry(job.id)}>
                      <RotateCcw className="h-4 w-4 mr-2" /> Retry
                    </DropdownMenuItem>
                  )}
                  {isActive && onCancel && (
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={() => onCancel(job.id)}
                    >
                      <X className="h-4 w-4 mr-2" /> Cancel
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
            <span>{formatBytes(job.blobSize)}</span>
          </div>

          {/* Error message for failed jobs */}
          {isFailed && job.errorMessage && (
            <p className="mt-2 text-xs text-destructive line-clamp-2">
              {job.errorMessage}
            </p>
          )}

          <div className="flex items-center justify-between mt-3">
            {/* Capture type icons */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-muted/50" title="Video">
                <Video className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              {job.hasMic && (
                <div className="p-1.5 rounded bg-muted/50" title="Microphone">
                  <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {job.hasCam && (
                <div className="p-1.5 rounded bg-muted/50" title="Camera">
                  <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {job.hasSystemAudio && (
                <div className="p-1.5 rounded bg-muted/50" title="System Audio">
                  <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Retry button for failed jobs */}
            {isFailed && onRetry && job.retryCount < job.maxRetries && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry(job.id);
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Processing interstitial dialog */}
      <Dialog open={showProcessingDialog} onOpenChange={setShowProcessingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Still Processing
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p>
                <strong>{job.sessionTitle}</strong> is still being processed.
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{statusLabel}</span>
                  <span className="font-mono-data">{Math.round(job.progress)}%</span>
                </div>
                <Progress value={job.progress} className="h-2" />
              </div>
              <p className="text-sm">
                You can come back later when processing is complete, or view the session now (playback may be limited).
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleComeBackLater}>
              Come Back Later
            </Button>
            <Button onClick={handleViewAnyway}>
              View Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default ProcessingSessionCard;
