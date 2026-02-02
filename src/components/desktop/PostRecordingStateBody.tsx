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
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      {/* Processing State */}
      {state === "processing" && (
        <>
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full bg-vantage-green/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-vantage-green animate-spin" />
            </div>
            {/* Subtle pulse ring */}
            <div className="absolute inset-0 rounded-full bg-vantage-green/20 animate-ping" style={{ animationDuration: "1.5s" }} />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Processing recording
          </h3>
          <p className="text-sm text-muted-foreground">
            Optimizing for smooth playback.
          </p>
        </>
      )}

      {/* Uploading State */}
      {state === "uploading" && (
        <>
          <div className="w-16 h-16 rounded-full bg-vantage-green/10 flex items-center justify-center mb-6">
            <Upload className="w-8 h-8 text-vantage-green" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Uploading to Vantage
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {uploadProgress}% complete
          </p>
          <div className="w-full max-w-[200px]">
            <Progress value={uploadProgress} className="h-1.5" />
          </div>
        </>
      )}

      {/* Success State */}
      {state === "success" && (
        <>
          <div className="w-16 h-16 rounded-full bg-vantage-green/20 flex items-center justify-center mb-6">
            <Check className="w-8 h-8 text-vantage-green" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Ready to edit
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Your recording has been uploaded successfully.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-[200px]">
            <Button
              onClick={onOpenEditor}
              className="w-full bg-vantage-green hover:bg-vantage-green/90 text-background font-medium"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in Vantage
            </Button>
            <Button
              variant="ghost"
              onClick={onCopyLink}
              className="w-full text-muted-foreground hover:text-foreground"
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
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Upload failed
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Your recording is saved locally. Try again or open the recordings folder.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-[220px]">
            <Button
              onClick={onRetryUpload}
              className="w-full bg-vantage-green hover:bg-vantage-green/90 text-background font-medium"
            >
              Retry upload
            </Button>
            <Button
              variant="ghost"
              onClick={onOpenRecordingsFolder}
              className="w-full text-muted-foreground hover:text-foreground"
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
