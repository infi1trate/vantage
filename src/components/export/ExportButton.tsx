/**
 * Export Button Component
 * 
 * Unified export button with clear state indicators:
 * - Idle: "Export" button
 * - Exporting: Progress + Cancel
 * - Success: "Open" / "Show in folder"  
 * - Failed: Error + Retry
 */

import { memo, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Download,
  Loader2,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { useExportState } from "@/hooks/useRenderQueue";
import { ExportState } from "@/lib/renderQueue";

interface ExportButtonProps {
  sessionId: string;
  onExport: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onOpen?: () => void;
  onShowInFolder?: () => void;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export const ExportButton = memo(function ExportButton({
  sessionId,
  onExport,
  onCancel,
  onRetry,
  onOpen,
  onShowInFolder,
  disabled = false,
  size = "default",
  className,
}: ExportButtonProps) {
  const exportState = useExportState(sessionId);
  
  // Idle state
  if (exportState.state === "idle") {
    return (
      <Button
        onClick={onExport}
        disabled={disabled}
        size={size}
        className={cn("gap-2", className)}
      >
        <Download className="h-4 w-4" />
        Export
      </Button>
    );
  }
  
  // Exporting state
  if (exportState.state === "exporting") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex-1 min-w-[120px]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              {exportState.stage}
            </span>
            <span className="font-mono">{exportState.progress}%</span>
          </div>
          <Progress value={exportState.progress} className="h-1.5" />
        </div>
        
        {exportState.canCancel && onCancel && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={onCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cancel export</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }
  
  // Success state
  if (exportState.state === "success") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1.5 text-sm text-vantage-success">
          <Check className="h-4 w-4" />
          <span>Exported</span>
        </div>
        
        {onOpen && (
          <Button
            variant="default"
            size={size}
            className="gap-2"
            onClick={onOpen}
          >
            <ExternalLink className="h-4 w-4" />
            Open
          </Button>
        )}
        
        {onShowInFolder && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={onShowInFolder}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Show in folder</TooltipContent>
          </Tooltip>
        )}
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={onExport}
            >
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export again</TooltipContent>
        </Tooltip>
      </div>
    );
  }
  
  // Failed state
  if (exportState.state === "failed") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="truncate max-w-[150px]">
            {exportState.errorMessage || "Export failed"}
          </span>
        </div>
        
        {onRetry && (
          <Button
            variant="outline"
            size={size}
            className="gap-2"
            onClick={onRetry}
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        )}
      </div>
    );
  }
  
  // Fallback
  return (
    <Button
      onClick={onExport}
      disabled={disabled}
      size={size}
      className={cn("gap-2", className)}
    >
      <Download className="h-4 w-4" />
      Export
    </Button>
  );
});

/**
 * Compact export status indicator (for header/toolbar)
 */
export const ExportStatusIndicator = memo(function ExportStatusIndicator({
  sessionId,
  onClick,
  className,
}: {
  sessionId: string;
  onClick?: () => void;
  className?: string;
}) {
  const exportState = useExportState(sessionId);
  
  if (exportState.state === "idle") {
    return null;
  }
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
        exportState.state === "exporting" && "bg-primary/10 text-primary",
        exportState.state === "success" && "bg-vantage-success/10 text-vantage-success",
        exportState.state === "failed" && "bg-destructive/10 text-destructive",
        onClick && "hover:bg-muted cursor-pointer",
        className
      )}
    >
      {exportState.state === "exporting" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{exportState.progress}%</span>
        </>
      )}
      {exportState.state === "success" && (
        <>
          <Check className="h-3 w-3" />
          <span>Exported</span>
        </>
      )}
      {exportState.state === "failed" && (
        <>
          <AlertCircle className="h-3 w-3" />
          <span>Failed</span>
        </>
      )}
    </button>
  );
});
