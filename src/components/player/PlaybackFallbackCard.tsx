import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Download, 
  Copy, 
  Check,
  Monitor,
  FileVideo,
  Clock,
  HardDrive,
} from "lucide-react";
import { formatBytes } from "@/lib/localSessionStorage";
import { VideoDecodeError, VideoMetaInfo } from "./FilmRoomPlayer";

export interface PlaybackFallbackCardProps {
  error: VideoDecodeError;
  videoMeta?: VideoMetaInfo | null;
  sessionDuration?: number;
  onDownload?: () => void;
}

export function PlaybackFallbackCard({
  error,
  videoMeta,
  sessionDuration,
  onDownload,
}: PlaybackFallbackCardProps) {
  const [copied, setCopied] = useState(false);

  // Build diagnostics text for clipboard
  const getDiagnosticsText = () => {
    const lines = [
      "=== Playback Diagnostics ===",
      `Error Type: ${error.type}`,
      `Error Message: ${error.message}`,
    ];

    if (error.mediaError) {
      lines.push(`Media Error Code: ${error.mediaError.code}`);
      lines.push(`Media Error Message: ${error.mediaError.message || "N/A"}`);
    }

    if (videoMeta) {
      lines.push("");
      lines.push("=== Recording Info ===");
      lines.push(`MIME Type: ${videoMeta.storedMimeType || "unknown"}`);
      lines.push(`Blob Type: ${videoMeta.blobType || "unknown"}`);
      lines.push(`File Size: ${videoMeta.blobSize ? formatBytes(videoMeta.blobSize) : "unknown"}`);
      if (videoMeta.videoWidth && videoMeta.videoHeight) {
        lines.push(`Resolution: ${videoMeta.videoWidth}x${videoMeta.videoHeight}`);
      }
    }

    if (sessionDuration) {
      lines.push(`Duration: ${formatDuration(sessionDuration)}`);
    }

    lines.push("");
    lines.push("=== Browser Info ===");
    lines.push(`User Agent: ${navigator.userAgent}`);
    lines.push(`Platform: ${navigator.platform}`);
    lines.push(`Date: ${new Date().toISOString()}`);

    // Check mime type support
    lines.push("");
    lines.push("=== MIME Support ===");
    const mimeTypes = [
      "video/mp4;codecs=h264,aac",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    
    const video = document.createElement("video");
    mimeTypes.forEach((type) => {
      const canPlay = video.canPlayType(type);
      lines.push(`${type}: ${canPlay || "no"}`);
    });

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

  // Format duration in mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Determine file extension from mime type
  const getFileExt = () => {
    const mime = videoMeta?.storedMimeType || videoMeta?.blobType || "";
    if (mime.includes("mp4")) return "MP4";
    if (mime.includes("webm")) return "WebM";
    return "Unknown";
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-6 bg-gradient-to-br from-muted/30 via-background to-muted/30">
      <Card className="max-w-md w-full border-destructive/30 bg-card/95 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg">Playback not supported</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                This browser can't play this recording format
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Recording details grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* MIME Type */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
              <FileVideo className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Format</p>
                <p className="text-sm font-medium truncate">
                  {videoMeta?.storedMimeType?.replace("video/", "") || "Unknown"}
                </p>
              </div>
            </div>

            {/* File Extension */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
              <Badge variant="outline" className="text-xs px-1.5">
                {getFileExt()}
              </Badge>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</p>
                <p className="text-sm font-medium">Container</p>
              </div>
            </div>

            {/* Size */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
              <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Size</p>
                <p className="text-sm font-medium">
                  {videoMeta?.blobSize ? formatBytes(videoMeta.blobSize) : "Unknown"}
                </p>
              </div>
            </div>

            {/* Duration */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration</p>
                <p className="text-sm font-medium">
                  {sessionDuration ? formatDuration(sessionDuration) : "Unknown"}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2">
            {onDownload && (
              <Button onClick={onDownload} className="w-full gap-2">
                <Download className="h-4 w-4" />
                Download Recording
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={handleCopyDiagnostics} 
              className="w-full gap-2"
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

          {/* Chrome helper text */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <Monitor className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Try opening in Chrome</p>
              <p>
                Google Chrome has the best support for WebM and VP9 video formats. 
                Download the recording and open it in Chrome for playback.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
