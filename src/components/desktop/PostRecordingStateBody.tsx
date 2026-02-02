/**
 * PostRecordingStateBody
 * 
 * Displays post-recording states: processing, uploading, success, and error.
 */

import { cn } from "@/lib/utils";
import { Loader2, Check, AlertCircle, Upload, Folder, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export type PostRecordingState = "processing" | "uploading" | "success" | "error";

interface PostRecordingStateBodyProps {
  state: PostRecordingState;
  uploadProgress: number; // 0-100
  onOpenEditor: () => void;
  onCopyLink: () => void;
  onRetryUpload: () => void;
  onOpenRecordingsFolder: () => void;
}

export function PostRecordingStateBody({
  state,
  uploadProgress,
  onOpenEditor,
  onCopyLink,
  onRetryUpload,
  onOpenRecordingsFolder,
}: PostRecordingStateBodyProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center py-8 px-6 text-center"
      role="status"
      aria-live="polite"
    >
      {/* Processing State */}
      {state === "processing" && (
        <>
          <div className="relative mb-5" aria-hidden="true">
            <div className="w-14 h-14 rounded-full bg-vantage-green/10 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-vantage-green animate-spin" />
            </div>
            {/* Subtle pulse ring */}
            <div className="absolute inset-0 rounded-full bg-vantage-green/15 animate-ping" style={{ animationDuration: "1.5s" }} />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Processing recording
          </h3>
          <p className="text-sm text-muted-foreground max-w-[240px]">
            Optimizing for smooth playback.
          </p>
        </>
      )}

      {/* Uploading State */}
      {state === "uploading" && (
        <>
          <div className="w-14 h-14 rounded-full bg-vantage-green/10 flex items-center justify-center mb-5" aria-hidden="true">
            <Upload className="w-7 h-7 text-vantage-green" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Uploading recording
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {uploadProgress}% complete
          </p>
          <div className="w-full max-w-[180px]">
            <Progress 
              value={uploadProgress} 
              className="h-1.5" 
              aria-label={`Upload progress: ${uploadProgress}%`}
            />
          </div>
        </>
      )}

      {/* Success State */}
      {state === "success" && (
        <>
          <div className="w-14 h-14 rounded-full bg-vantage-green/15 flex items-center justify-center mb-5" aria-hidden="true">
            <Check className="w-7 h-7 text-vantage-green" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Ready to edit
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-[240px]">
            Your recording has been uploaded successfully.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-[200px]">
            <Button
              onClick={onOpenEditor}
              className={cn(
                "w-full bg-vantage-green hover:bg-vantage-green/90 text-background font-medium",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in Vantage
            </Button>
            <Button
              variant="ghost"
              onClick={onCopyLink}
              className={cn(
                "w-full text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy link
            </Button>
          </div>
        </>
      )}

      {/* Error State */}
      {state === "error" && (
        <>
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-5" aria-hidden="true">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Upload failed
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-[260px]">
            Your recording is saved locally. Try again or open the recordings folder.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-[200px]">
            <Button
              onClick={onRetryUpload}
              className={cn(
                "w-full bg-vantage-green hover:bg-vantage-green/90 text-background font-medium",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              Retry upload
            </Button>
            <Button
              variant="ghost"
              onClick={onOpenRecordingsFolder}
              className={cn(
                "w-full text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <Folder className="w-4 h-4 mr-2" />
              Open recordings folder
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
