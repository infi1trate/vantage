import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Download, 
  Copy, 
  Check,
  HardDrive,
  RefreshCw,
  ArrowRight,
  Clock,
  FileVideo,
} from "lucide-react";
import { formatBytes } from "@/lib/localSessionStorage";

export interface StorageRecoveryScreenProps {
  /** Recording blob to download */
  blob: Blob;
  /** Recording duration in seconds */
  duration: number;
  /** Session title */
  title: string;
  /** MIME type of the recording */
  mimeType: string;
  /** File extension */
  fileExt: "mp4" | "webm";
  /** Error details */
  error: {
    type: "quota_exceeded" | "storage_error" | "unknown";
    message: string;
    details?: string;
  };
  /** Callback to retry saving */
  onRetry: () => Promise<boolean>;
  /** Callback after download */
  onContinue: () => void;
}

export function StorageRecoveryScreen({
  blob,
  duration,
  title,
  mimeType,
  fileExt,
  error,
  onRetry,
  onContinue,
}: StorageRecoveryScreenProps) {
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // Format duration in mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Generate sanitized filename
  const getFilename = () => {
    const sanitized = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const timestamp = new Date().toISOString().split("T")[0];
    return `${sanitized}_${timestamp}.${fileExt}`;
  };

  // Download the recording
  const handleDownload = () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  // Retry saving to storage
  const handleRetry = async () => {
    setRetrying(true);
    try {
      const success = await onRetry();
      if (success) {
        onContinue();
      }
    } finally {
      setRetrying(false);
    }
  };

  // Build diagnostics text
  const getDiagnosticsText = () => {
    const lines = [
      "=== Storage Recovery Diagnostics ===",
      `Error Type: ${error.type}`,
      `Error Message: ${error.message}`,
      error.details ? `Details: ${error.details}` : null,
      "",
      "=== Recording Info ===",
      `Title: ${title}`,
      `Duration: ${formatDuration(duration)}`,
      `Size: ${formatBytes(blob.size)}`,
      `MIME Type: ${mimeType}`,
      `File Extension: ${fileExt}`,
      "",
      "=== Browser Info ===",
      `User Agent: ${navigator.userAgent}`,
      `Platform: ${navigator.platform}`,
      `Date: ${new Date().toISOString()}`,
      "",
      "=== Storage Estimate ===",
    ];

    // Add storage estimate if available
    if ("storage" in navigator && "estimate" in navigator.storage) {
      navigator.storage.estimate().then((estimate) => {
        console.log("Storage estimate:", estimate);
      });
    }
    lines.push("(Check browser console for storage estimate)");

    return lines.filter(Boolean).join("\n");
  };

  const handleCopyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(getDiagnosticsText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy diagnostics:", err);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-6 bg-gradient-to-br from-warning/5 via-background to-warning/5">
      <Card className="max-w-lg w-full border-warning/30 bg-card/95 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-full bg-warning/10">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <div>
              <CardTitle className="text-lg">Storage Full</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                Your recording wasn't saved locally
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Recording details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
              <FileVideo className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Size</p>
                <p className="text-sm font-medium truncate">{formatBytes(blob.size)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration</p>
                <p className="text-sm font-medium">{formatDuration(duration)}</p>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <div className="flex items-start gap-2">
              <HardDrive className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-warning mb-1">Your browser storage is full</p>
                <p className="text-muted-foreground text-xs">
                  {error.type === "quota_exceeded" 
                    ? "Download the recording to keep it safe. You can delete old recordings to free up space."
                    : error.message}
                </p>
              </div>
            </div>
          </div>

          {/* Primary action: Download */}
          <Button
            size="lg"
            onClick={handleDownload}
            className="w-full gap-2 bg-primary hover:bg-primary/90"
          >
            <Download className="h-5 w-5" />
            {downloaded ? "Download Again" : "Download Recording"}
            {downloaded && <Check className="h-4 w-4 ml-1" />}
          </Button>

          {/* Secondary actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={retrying}
              className="gap-2"
            >
              {retrying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Retry Save
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyDiagnostics}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Diagnostics
                </>
              )}
            </Button>
          </div>

          {/* Continue button */}
          {downloaded && (
            <Button
              variant="secondary"
              onClick={onContinue}
              className="w-full gap-2"
            >
              Continue to Library
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}

          {/* Status badge */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
              {downloaded ? "Downloaded" : "Not Saved"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Recording is in memory until you leave this page
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}