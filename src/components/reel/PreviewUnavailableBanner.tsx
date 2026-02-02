/**
 * Preview Unavailable Banner
 * 
 * Shown when reel is ready but preview rendering failed or is pending.
 * Uses manifest playback mode - export will still work.
 */

import { memo } from "react";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PreviewStatus } from "@/lib/reels";

interface PreviewUnavailableBannerProps {
  className?: string;
  previewStatus?: PreviewStatus;
  onGeneratePreview?: () => void;
  isGenerating?: boolean;
}

export const PreviewUnavailableBanner = memo(function PreviewUnavailableBanner({
  className,
  previewStatus = "pending",
  onGeneratePreview,
  isGenerating = false,
}: PreviewUnavailableBannerProps) {
  // Don't show if preview is ready
  if (previewStatus === "ready") return null;
  
  const isRendering = previewStatus === "rendering" || isGenerating;
  const isFailed = previewStatus === "failed";
  
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        isFailed 
          ? "bg-vantage-warning/10 border border-vantage-warning/30"
          : "bg-muted/30 border border-border/40",
        className
      )}
    >
      {isRendering ? (
        <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
      ) : (
        <AlertTriangle className="h-5 w-5 text-vantage-warning shrink-0" />
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {isRendering ? "Generating preview..." : "Preview unavailable"}
        </p>
        <p className="text-xs text-muted-foreground">
          {isRendering 
            ? "You can start editing — preview will appear when ready."
            : "Export will still work — we'll render on export."}
        </p>
      </div>
      
      {isFailed && onGeneratePreview && (
        <Button
          variant="outline"
          size="sm"
          onClick={onGeneratePreview}
          disabled={isGenerating}
          className="gap-1.5 shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
});

export default PreviewUnavailableBanner;
