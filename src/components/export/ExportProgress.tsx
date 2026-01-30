import { ExportJob } from "@/lib/exportJobs";
import { useJobs, useCurrentJob } from "@/contexts/JobsContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  X, 
  Check, 
  AlertCircle,
  Download,
  Share2,
  Users,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportProgressProps {
  onMinimize?: () => void;
  onClose?: () => void;
}

const typeIcons = {
  desktop_export: Download,
  platform_publish: Share2,
  community_post: Users,
};

const typeLabels = {
  desktop_export: "Exporting",
  platform_publish: "Publishing",
  community_post: "Posting",
};

export function ExportProgress({ onMinimize, onClose }: ExportProgressProps) {
  const { cancelJob } = useJobs();
  const job = useCurrentJob();
  
  if (!job) return null;
  
  const Icon = typeIcons[job.type];
  const label = typeLabels[job.type];
  const isActive = job.status === "pending" || job.status === "processing";
  const currentStage = job.stages[job.currentStageIndex];
  
  // Calculate progress percentage based on stages
  const completedStages = job.stages.filter(s => s.status === "completed").length;
  const progressPercent = job.status === "completed" 
    ? 100 
    : Math.round((completedStages / job.stages.length) * 100);
  
  const handleCancel = () => {
    cancelJob(job.id);
    onClose?.();
  };
  
  const handleMinimize = () => {
    onMinimize?.();
  };

  return (
    <div className="p-4 space-y-4 bg-muted/20 border border-border/30 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isActive ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : job.status === "completed" ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          <span className="font-medium text-sm">
            {job.status === "completed" ? "Export Complete" : 
             job.status === "failed" ? "Export Failed" :
             job.status === "cancelled" ? "Cancelled" :
             `${label}...`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isActive && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={handleMinimize}
              title="Run in background"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Session info */}
      <div className="text-xs text-muted-foreground truncate">
        {job.sessionTitle}
      </div>
      
      {/* Progress bar */}
      {isActive && (
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-1.5" />
          <div className="text-xs text-muted-foreground">
            {currentStage?.label || "Preparing..."}
          </div>
        </div>
      )}
      
      {/* Stages visualization */}
      <div className="flex gap-1">
        {job.stages.map((stage, i) => (
          <div
            key={stage.id}
            className={cn(
              "flex-1 h-1 rounded-full transition-colors",
              stage.status === "completed" && "bg-primary",
              stage.status === "active" && "bg-primary/50 animate-pulse",
              stage.status === "pending" && "bg-muted",
              stage.status === "failed" && "bg-destructive"
            )}
            title={stage.label}
          />
        ))}
      </div>
      
      {/* Error message */}
      {job.status === "failed" && job.errorMessage && (
        <p className="text-xs text-destructive">{job.errorMessage}</p>
      )}
      
      {/* Actions */}
      <div className="flex gap-2">
        {isActive && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleMinimize}
            >
              Run in background
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </>
        )}
        
        {job.status === "completed" && (
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={onClose}
          >
            <Check className="h-4 w-4 mr-1" />
            Done
          </Button>
        )}
        
        {job.status === "failed" && (
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={() => {
              const { retryJob } = useJobs();
              retryJob(job.id);
            }}
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
