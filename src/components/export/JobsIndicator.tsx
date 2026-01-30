import { useJobs } from "@/contexts/JobsContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Download, 
  Share2, 
  Users, 
  Check, 
  X, 
  AlertCircle, 
  Loader2,
  ExternalLink,
  Copy,
  FolderOpen,
  RefreshCw,
  Trash2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ExportJob } from "@/lib/exportJobs";

const typeIcons = {
  desktop_export: Download,
  platform_publish: Share2,
  community_post: Users,
};

const typeLabels = {
  desktop_export: "Desktop Export",
  platform_publish: "Platform Publish",
  community_post: "Community Post",
};

function JobItem({ job }: { job: ExportJob }) {
  const { retryJob, deleteJob, setCurrentJobId } = useJobs();
  
  const Icon = typeIcons[job.type];
  const isActive = job.status === "pending" || job.status === "processing";
  const currentStage = job.stages[job.currentStageIndex];
  
  const handleCopyLink = async () => {
    if (job.shareLink) {
      await navigator.clipboard.writeText(job.shareLink);
      toast.success("Link copied");
    }
  };
  
  const handleOpenPlatform = () => {
    if (job.platformUrl) {
      window.open(job.platformUrl, "_blank", "noopener,noreferrer");
    }
  };
  
  const handleRevealFile = () => {
    // This would integrate with system APIs in Electron/Tauri
    // For web, we show the path
    if (job.outputPath) {
      toast.info(`File saved to: ${job.outputPath}`);
    }
  };

  return (
    <div className="p-3 rounded-lg bg-muted/20 border border-border/30 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            "p-1.5 rounded",
            isActive && "bg-primary/10 text-primary",
            job.status === "completed" && "bg-primary/10 text-primary",
            job.status === "failed" && "bg-destructive/10 text-destructive",
            job.status === "cancelled" && "bg-muted text-muted-foreground"
          )}>
            {isActive ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : job.status === "completed" ? (
              <Check className="h-3.5 w-3.5" />
            ) : job.status === "failed" ? (
              <AlertCircle className="h-3.5 w-3.5" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{job.sessionTitle}</p>
            <p className="text-xs text-muted-foreground">
              {isActive ? currentStage?.label || "Preparing..." : typeLabels[job.type]}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {job.status === "failed" && job.retryCount < job.maxRetries && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => retryJob(job.id)}
              title="Retry"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          {!isActive && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => deleteJob(job.id)}
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Progress for active jobs */}
      {isActive && (
        <div className="flex gap-0.5">
          {job.stages.map((stage) => (
            <div
              key={stage.id}
              className={cn(
                "flex-1 h-1 rounded-full transition-colors",
                stage.status === "completed" && "bg-primary",
                stage.status === "active" && "bg-primary/50 animate-pulse",
                stage.status === "pending" && "bg-muted",
                stage.status === "failed" && "bg-destructive"
              )}
            />
          ))}
        </div>
      )}
      
      {/* Completed job actions */}
      {job.status === "completed" && (
        <div className="flex gap-1.5">
          {job.outputPath && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 flex-1"
              onClick={handleRevealFile}
            >
              <FolderOpen className="h-3 w-3" />
              Show in Folder
            </Button>
          )}
          {job.shareLink && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 flex-1"
              onClick={handleCopyLink}
            >
              <Copy className="h-3 w-3" />
              Copy Link
            </Button>
          )}
          {job.platformUrl && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 flex-1"
              onClick={handleOpenPlatform}
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </Button>
          )}
        </div>
      )}
      
      {/* Error message */}
      {job.status === "failed" && job.errorMessage && (
        <p className="text-xs text-destructive">{job.errorMessage}</p>
      )}
      
      {/* Timestamp */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock className="h-2.5 w-2.5" />
        {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
      </div>
    </div>
  );
}

export function JobsIndicator() {
  const { jobs, activeCount, showJobsPanel, setShowJobsPanel } = useJobs();
  
  const activeJobs = jobs.filter(j => j.status === "pending" || j.status === "processing");
  const completedJobs = jobs.filter(j => j.status === "completed");
  const failedJobs = jobs.filter(j => j.status === "failed");
  
  const hasJobs = jobs.length > 0;
  
  return (
    <Popover open={showJobsPanel} onOpenChange={setShowJobsPanel}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className={cn(
            "relative h-8 w-8",
            activeCount > 0 && "text-primary"
          )}
        >
          {activeCount > 0 ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {activeCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary"
            >
              {activeCount}
            </Badge>
          )}
          {activeCount === 0 && failedJobs.length > 0 && (
            <Badge 
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
            >
              !
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b border-border/50">
          <h4 className="font-display text-sm tracking-wide">EXPORTS</h4>
          <p className="text-xs text-muted-foreground">
            {activeCount > 0 ? `${activeCount} in progress` : "No active exports"}
          </p>
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {!hasJobs ? (
            <div className="p-6 text-center">
              <Download className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No export jobs yet</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {/* Active jobs first */}
              {activeJobs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-1">
                    In Progress
                  </p>
                  {activeJobs.map(job => (
                    <JobItem key={job.id} job={job} />
                  ))}
                </div>
              )}
              
              {/* Failed jobs */}
              {failedJobs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-destructive px-1">
                    Failed
                  </p>
                  {failedJobs.map(job => (
                    <JobItem key={job.id} job={job} />
                  ))}
                </div>
              )}
              
              {/* Completed jobs */}
              {completedJobs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-1">
                    Completed
                  </p>
                  {completedJobs.slice(0, 5).map(job => (
                    <JobItem key={job.id} job={job} />
                  ))}
                  {completedJobs.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      +{completedJobs.length - 5} more
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
