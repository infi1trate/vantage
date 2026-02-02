/**
 * Preview Unavailable Banner
 * 
 * Shown when reel assembly completed but preview rendering failed.
 * Uses manifest playback mode - export will still work.
 */

import { memo } from "react";
import { AlertTriangle, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PreviewUnavailableBannerProps {
  className?: string;
  onGeneratePreview?: () => void;
  isGenerating?: boolean;
}

export const PreviewUnavailableBanner = memo(function PreviewUnavailableBanner({
  className,
  onGeneratePreview,
  isGenerating = false,
}: PreviewUnavailableBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        "bg-vantage-warning/10 border border-vantage-warning/30",
        className
      )}
    >
      <AlertTriangle className="h-5 w-5 text-vantage-warning shrink-0" />
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Preview unavailable
        </p>
        <p className="text-xs text-muted-foreground">
          Export will still work — we'll render on export.
        </p>
      </div>
      
      {onGeneratePreview && (
        <Button
          variant="outline"
          size="sm"
          onClick={onGeneratePreview}
          disabled={isGenerating}
          className="gap-1.5 shrink-0"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Generate preview
            </>
          )}
        </Button>
      )}
    </div>
  );
});

export default PreviewUnavailableBanner;
