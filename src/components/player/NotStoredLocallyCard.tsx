import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Copy, 
  Check,
  HardDrive,
  Clock,
  FileVideo,
  Info,
} from "lucide-react";
import { formatBytes } from "@/lib/localSessionStorage";

export interface NotStoredLocallyCardProps {
  /** Session title */
  title: string;
  /** Recording duration in seconds */
  duration: number;
  /** File size in bytes */
  blobSize: number;
  /** MIME type */
  mimeType: string;
  /** When the session was created */
  createdAt: string;
}

export function NotStoredLocallyCard({
  title,
  duration,
  blobSize,
  mimeType,
  createdAt,
}: NotStoredLocallyCardProps) {
  const [copied, setCopied] = useState(false);

  // Format duration in mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // Build diagnostics text
  const getDiagnosticsText = () => {
    const lines = [
      "=== Session Not Stored Locally ===",
      `Title: ${title}`,
      `Created: ${createdAt}`,
      `Duration: ${formatDuration(duration)}`,
      `Size: ${formatBytes(blobSize)}`,
      `MIME Type: ${mimeType}`,
      "",
      "=== Browser Info ===",
      `User Agent: ${navigator.userAgent}`,
      `Platform: ${navigator.platform}`,
      `Date: ${new Date().toISOString()}`,
    ];

    return lines.join("\n");
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
    <div className="w-full h-full flex items-center justify-center p-6 bg-gradient-to-br from-muted/30 via-background to-muted/30">
      <Card className="max-w-md w-full border-warning/30 bg-card/95 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-full bg-warning/10">
              <HardDrive className="h-6 w-6 text-warning" />
            </div>
            <div>
              <CardTitle className="text-lg">Recording Not Stored</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                This recording wasn't saved in browser storage
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Recording details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
              <FileVideo className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Size</p>
                <p className="text-sm font-medium truncate">{formatBytes(blobSize)}</p>
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
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-warning mb-1">Storage was full when recording</p>
                <p className="text-muted-foreground text-xs">
                  The video file couldn't be saved due to browser storage limits. 
                  If you downloaded the recording, you can play it with a video player.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
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

          {/* Info badge */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">What can I do?</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Delete old recordings to free up space</li>
                <li>Re-record the session in Chrome</li>
                <li>If you downloaded the file, use VLC to play it</li>
              </ul>
            </div>
          </div>

          {/* Timestamp */}
          <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
              Not Stored
            </Badge>
            <span>{formatDate(createdAt)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}