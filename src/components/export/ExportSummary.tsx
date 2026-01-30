/**
 * Export Summary Screen
 * Shows what happened after export/publish/post completion
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  Copy,
  ExternalLink,
  Download,
  Share2,
  Users,
  RefreshCw,
  FolderOpen,
  Link as LinkIcon,
  Twitter,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportJob } from "@/lib/exportJobs";
import { toast } from "sonner";

// Discord icon as SVG
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
    </svg>
  );
}

interface ExportSummaryProps {
  job: ExportJob;
  onClose: () => void;
  onExportAgain: () => void;
}

const typeConfig = {
  desktop_export: {
    icon: Download,
    title: "Download Complete",
    description: "Your file has been downloaded",
    color: "text-primary",
  },
  platform_publish: {
    icon: Share2,
    title: "Published",
    description: "Your clip is now live",
    color: "text-green-500",
  },
  community_post: {
    icon: Users,
    title: "Posted to Community",
    description: "Your clip is now shared with the community",
    color: "text-primary",
  },
};

export function ExportSummary({ job, onClose, onExportAgain }: ExportSummaryProps) {
  const [copied, setCopied] = useState(false);
  
  const config = typeConfig[job.type];
  const Icon = config.icon;
  
  const shareUrl = job.shareLink || job.platformUrl || "";
  const hasShareUrl = Boolean(shareUrl);
  
  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleShareToX = () => {
    const text = `Check out my gameplay clip: ${job.sessionTitle}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "width=550,height=420");
  };
  
  const handleShareToDiscord = () => {
    // Copy to clipboard with message for Discord
    const message = `🎮 ${job.sessionTitle}\n${shareUrl}`;
    navigator.clipboard.writeText(message);
    toast.success("Copied! Paste in Discord to share");
  };
  
  const handleOpen = () => {
    if (job.platformUrl) {
      window.open(job.platformUrl, "_blank");
    } else if (job.shareLink) {
      window.open(job.shareLink, "_blank");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-6 space-y-6">
        {/* Success header */}
        <div className="text-center space-y-3">
          <div className={cn(
            "w-16 h-16 rounded-full mx-auto flex items-center justify-center",
            "bg-primary/10 border-2 border-primary"
          )}>
            <Check className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xl tracking-wide">{config.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
          </div>
        </div>
        
        {/* Summary card */}
        <div className="p-4 rounded-xl bg-muted/20 border border-border/30 space-y-3">
          <div className="flex items-start gap-3">
            <Icon className={cn("h-5 w-5 mt-0.5", config.color)} />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{job.sessionTitle}</p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {job.config.preset && (
                  <Badge variant="secondary" className="text-xs">
                    {job.config.preset}
                  </Badge>
                )}
                {job.config.format && (
                  <Badge variant="secondary" className="text-xs">
                    {job.config.format.toUpperCase()}
                  </Badge>
                )}
                {job.config.visibility && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {job.config.visibility}
                  </Badge>
                )}
                {job.config.platform && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {job.config.platform}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Location info */}
          {job.outputPath && (
            <div className="pt-2 border-t border-border/30">
              <p className="text-xs text-muted-foreground">Saved to:</p>
              <p className="text-sm font-mono truncate mt-0.5">{job.outputPath}</p>
            </div>
          )}
          
          {shareUrl && (
            <div className="pt-2 border-t border-border/30">
              <p className="text-xs text-muted-foreground">Share link:</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm font-mono truncate flex-1">{shareUrl}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Quick actions */}
        <div className="space-y-2">
          {hasShareUrl && (
            <>
              <Button
                variant="outline"
                className="w-full gap-2 justify-start"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full gap-2 justify-start"
                  >
                    <Share2 className="h-4 w-4" />
                    Share to...
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={handleShareToX}>
                    <Twitter className="h-4 w-4 mr-2" />
                    Share on X
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShareToDiscord}>
                    <DiscordIcon className="h-4 w-4 mr-2" />
                    Copy for Discord
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          
          {(job.platformUrl || job.shareLink) && (
            <Button
              variant="outline"
              className="w-full gap-2 justify-start"
              onClick={handleOpen}
            >
              <ExternalLink className="h-4 w-4" />
              Open in {job.type === "community_post" ? "Community" : "Platform"}
            </Button>
          )}
          
          <Button
            variant="ghost"
            className="w-full gap-2 justify-start text-muted-foreground"
            onClick={onExportAgain}
          >
            <RefreshCw className="h-4 w-4" />
            Export Again
          </Button>
        </div>
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-border/30 bg-background/95">
        <Button onClick={onClose} className="w-full gap-2">
          <Check className="h-4 w-4" />
          Done
        </Button>
      </div>
    </div>
  );
}
