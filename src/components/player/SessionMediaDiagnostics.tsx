/**
 * Session Media Diagnostics Panel
 * 
 * Dev-friendly panel showing detailed media asset status:
 * - Screen/gameplay video: present/missing, duration, size, status
 * - Facecam video: present/missing
 * - Audio tracks: mic/game present/missing
 * - Processing status and errors
 * 
 * Only renders in development or when explicitly enabled.
 */

import { useState, useCallback, useMemo } from "react";
import { CaptureSession, VideoAsset, AudioTrack, FacecamTrack } from "@/lib/captures";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Camera, 
  CameraOff,
  Music,
  AlertCircle,
  CheckCircle2,
  Clock,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Copy,
  Bug,
  FileQuestion,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

interface SessionMediaDiagnosticsProps {
  session: CaptureSession | null;
  videoAssets: VideoAsset[];
  audioTracks: AudioTrack[];
  facecamTracks: FacecamTrack[];
  localSession?: {
    id: string;
    status?: string;
    mimeType?: string;
    blobSize?: number;
    duration?: number;
    createdAt?: string;
    hasBlob?: boolean;
  } | null;
  isLocalSession?: boolean;
  className?: string;
}

interface MediaStatus {
  status: "present" | "missing" | "processing" | "failed";
  label: string;
  icon: React.ReactNode;
  colorClass: string;
}

function getMediaStatus(
  type: "video" | "facecam" | "mic" | "game_audio",
  assets: { present: boolean; status?: string; error?: string | null }
): MediaStatus {
  if (!assets.present) {
    return {
      status: "missing",
      label: "Missing",
      icon: type === "video" ? <VideoOff className="h-4 w-4" /> :
            type === "facecam" ? <CameraOff className="h-4 w-4" /> :
            <MicOff className="h-4 w-4" />,
      colorClass: "text-destructive",
    };
  }

  if (assets.status === "failed") {
    return {
      status: "failed",
      label: "Failed",
      icon: <AlertCircle className="h-4 w-4" />,
      colorClass: "text-destructive",
    };
  }

  if (assets.status === "processing" || assets.status === "uploading") {
    return {
      status: "processing",
      label: assets.status === "uploading" ? "Uploading" : "Processing",
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      colorClass: "text-vantage-warning",
    };
  }

  return {
    status: "present",
    label: "Ready",
    icon: <CheckCircle2 className="h-4 w-4" />,
    colorClass: "text-green-500",
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function SessionMediaDiagnostics({
  session,
  videoAssets,
  audioTracks,
  facecamTracks,
  localSession,
  isLocalSession = false,
  className,
}: SessionMediaDiagnosticsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showRawDebug, setShowRawDebug] = useState(false);

  // Analyze media status
  const screenVideo = useMemo(() => {
    const gameplay = videoAssets.find(v => v.asset_type === "gameplay" || v.asset_type === "combined");
    const hasCloudVideo = !!session?.video_url;
    const hasLocalVideo = isLocalSession && localSession?.hasBlob !== false;
    
    return {
      present: !!(gameplay || hasCloudVideo || hasLocalVideo),
      asset: gameplay,
      cloudUrl: session?.video_url,
      status: gameplay?.status || (hasCloudVideo ? "ready" : hasLocalVideo ? "local" : undefined),
      error: gameplay?.error_message,
      durationMs: gameplay?.duration_ms || (localSession?.duration ? localSession.duration * 1000 : undefined),
      sizeBytes: gameplay?.file_size_bytes || localSession?.blobSize,
      createdAt: gameplay?.created_at || session?.created_at || localSession?.createdAt,
      storagePath: gameplay?.storage_path,
      mimeType: gameplay?.mime_type || localSession?.mimeType,
    };
  }, [session, videoAssets, localSession, isLocalSession]);

  const facecam = useMemo(() => {
    const track = facecamTracks[0];
    return {
      present: facecamTracks.length > 0,
      track,
      status: track?.status,
      durationMs: track?.duration_ms,
      sizeBytes: track?.file_size_bytes,
    };
  }, [facecamTracks]);

  const micAudio = useMemo(() => {
    const track = audioTracks.find(t => t.track_type === "microphone");
    return {
      present: !!track,
      track,
      status: track?.status,
      durationMs: track?.duration_ms,
    };
  }, [audioTracks]);

  const gameAudio = useMemo(() => {
    const track = audioTracks.find(t => t.track_type === "game" || t.track_type === "desktop" || t.track_type === "mixed");
    return {
      present: !!track,
      track,
      status: track?.status,
      durationMs: track?.duration_ms,
    };
  }, [audioTracks]);

  // Determine overall status
  const processingStatus = useMemo((): "ready" | "processing" | "uploading" | "failed" | "recording" | "unknown" => {
    if (isLocalSession) {
      if (localSession?.status === "not_stored_locally") return "failed";
      return localSession?.hasBlob !== false ? "ready" : "failed";
    }
    const status = session?.status;
    if (status === "ready" || status === "processing" || status === "failed" || status === "recording") {
      return status;
    }
    // Map any other status (like "uploading" from metadata)
    return "unknown";
  }, [session, localSession, isLocalSession]);

  // Determine why video is missing
  const videoMissingReason = useMemo(() => {
    if (screenVideo.present) return null;

    if (isLocalSession) {
      if (localSession?.status === "not_stored_locally") {
        return "Recording too large for browser storage. Data was not saved locally.";
      }
      if (!localSession?.hasBlob) {
        return "Local blob not found. Recording may have been cleared from browser storage.";
      }
      return "Unknown local storage issue.";
    }

    // Cloud session analysis
    if (!session) return "Session data not loaded.";
    
    if (session.status === "recording") {
      return "Session is still being recorded.";
    }
    if (session.status === "processing") {
      return "Video is still being processed/uploaded.";
    }
    if (session.status === "failed") {
      return "Session processing failed. Check error details below.";
    }
    if (videoAssets.length === 0 && !session.video_url) {
      return "No video file was uploaded for this session.";
    }
    
    const failedAsset = videoAssets.find(v => v.status === "failed");
    if (failedAsset) {
      return `Video asset failed: ${failedAsset.error_message || "Unknown error"}`;
    }

    return "Video URL not available. Upload may have failed or been interrupted.";
  }, [screenVideo.present, session, videoAssets, localSession, isLocalSession]);

  // Build debug data
  const debugData = useMemo(() => ({
    sessionId: session?.id || localSession?.id,
    isLocal: isLocalSession,
    sessionStatus: processingStatus,
    sessionCreatedAt: session?.created_at || localSession?.createdAt,
    
    screenVideo: {
      present: screenVideo.present,
      status: screenVideo.status,
      durationMs: screenVideo.durationMs,
      sizeBytes: screenVideo.sizeBytes,
      mimeType: screenVideo.mimeType,
      storagePath: screenVideo.storagePath,
      cloudUrl: screenVideo.cloudUrl ? "[PRESENT]" : null,
      error: screenVideo.error,
    },
    
    facecam: {
      present: facecam.present,
      status: facecam.status,
      durationMs: facecam.durationMs,
    },
    
    audioTracks: audioTracks.map(t => ({
      id: t.id,
      type: t.track_type,
      status: t.status,
      durationMs: t.duration_ms,
    })),
    
    videoAssets: videoAssets.map(v => ({
      id: v.id,
      type: v.asset_type,
      status: v.status,
      error: v.error_message,
      sizeBytes: v.file_size_bytes,
    })),
    
    videoMissingReason,
    timestamp: new Date().toISOString(),
  }), [session, localSession, isLocalSession, processingStatus, screenVideo, facecam, audioTracks, videoAssets, videoMissingReason]);

  const handleCopyDebug = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
    toast.success("Debug details copied to clipboard");
  }, [debugData]);

  // Only show in dev or when video is missing
  const shouldShow = import.meta.env.DEV || !screenVideo.present;
  if (!shouldShow) return null;

  const screenStatus = getMediaStatus("video", { 
    present: screenVideo.present, 
    status: screenVideo.status,
    error: screenVideo.error,
  });
  const facecamStatus = getMediaStatus("facecam", { present: facecam.present, status: facecam.status });
  const micStatus = getMediaStatus("mic", { present: micAudio.present, status: micAudio.status });
  const gameAudioStatus = getMediaStatus("game_audio", { present: gameAudio.present, status: gameAudio.status });

  return (
    <Card className={cn(
      "border-border/50 bg-card/50",
      !screenVideo.present && "border-destructive/30 bg-destructive/5",
      className
    )}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 px-4 cursor-pointer hover:bg-accent/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!screenVideo.present ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <Bug className="h-4 w-4 text-muted-foreground" />
                )}
                <CardTitle className="text-sm font-medium">
                  {!screenVideo.present ? "Session Media Issue" : "Session Media"}
                </CardTitle>
                {import.meta.env.DEV && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">DEV</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Quick status badges */}
                <div className="flex items-center gap-1">
                  <Badge 
                    variant="outline" 
                    className={cn("text-[10px] h-5 gap-1", screenStatus.colorClass)}
                  >
                    <Video className="h-3 w-3" />
                    {screenStatus.label}
                  </Badge>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            {/* Video Missing Message */}
            {!screenVideo.present && videoMissingReason && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <FileQuestion className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <p className="text-sm font-medium text-destructive">
                    Gameplay recording missing
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {videoMissingReason}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This session can't be used for reels.
                  </p>
                </div>
              </div>
            )}

            {/* Media Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Screen Video */}
              <div className="space-y-1.5 p-2.5 rounded-lg bg-accent/5 border border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5" />
                    Gameplay
                  </span>
                  <span className={cn("text-xs flex items-center gap-1", screenStatus.colorClass)}>
                    {screenStatus.icon}
                    {screenStatus.label}
                  </span>
                </div>
                {screenVideo.present && (
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    {screenVideo.durationMs && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(screenVideo.durationMs)}
                      </div>
                    )}
                    {screenVideo.sizeBytes && (
                      <div className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {formatBytes(screenVideo.sizeBytes)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Facecam */}
              <div className="space-y-1.5 p-2.5 rounded-lg bg-accent/5 border border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5" />
                    Facecam
                  </span>
                  <span className={cn("text-xs flex items-center gap-1", facecamStatus.colorClass)}>
                    {facecamStatus.icon}
                    {facecamStatus.label}
                  </span>
                </div>
                {facecam.present && facecam.durationMs && (
                  <div className="text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(facecam.durationMs)}
                    </div>
                  </div>
                )}
              </div>

              {/* Microphone */}
              <div className="space-y-1.5 p-2.5 rounded-lg bg-accent/5 border border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5" />
                    Microphone
                  </span>
                  <span className={cn("text-xs flex items-center gap-1", micStatus.colorClass)}>
                    {micStatus.icon}
                    {micStatus.label}
                  </span>
                </div>
              </div>

              {/* Game Audio */}
              <div className="space-y-1.5 p-2.5 rounded-lg bg-accent/5 border border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Music className="h-3.5 w-3.5" />
                    Game Audio
                  </span>
                  <span className={cn("text-xs flex items-center gap-1", gameAudioStatus.colorClass)}>
                    {gameAudioStatus.icon}
                    {gameAudioStatus.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Processing Status */}
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-accent/5 border border-border/30">
              <span className="text-xs font-medium">Processing Status</span>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px]",
                  processingStatus === "ready" && "text-vantage-green border-vantage-green/30",
                  processingStatus === "processing" && "text-vantage-warning border-vantage-warning/30",
                  processingStatus === "uploading" && "text-primary border-primary/30",
                  processingStatus === "failed" && "text-destructive border-destructive/30",
                  processingStatus === "recording" && "text-destructive border-destructive/30",
                )}
              >
                {processingStatus}
              </Badge>
            </div>

            {/* Created At */}
            {screenVideo.createdAt && (
              <div className="text-[10px] text-muted-foreground">
                Created {formatDistanceToNow(new Date(screenVideo.createdAt), { addSuffix: true })}
                <span className="mx-1">•</span>
                {format(new Date(screenVideo.createdAt), "MMM d, yyyy h:mm a")}
              </div>
            )}

            {/* Debug Section */}
            {import.meta.env.DEV && (
              <Collapsible open={showRawDebug} onOpenChange={setShowRawDebug}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full h-7 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {showRawDebug ? "Hide" : "Show"} Raw Debug Data
                    {showRawDebug ? (
                      <ChevronUp className="h-3 w-3 ml-1" />
                    ) : (
                      <ChevronDown className="h-3 w-3 ml-1" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-2 rounded bg-black/50 border border-border/30 overflow-x-auto">
                    <pre className="text-[9px] text-muted-foreground font-mono whitespace-pre-wrap">
                      {JSON.stringify(debugData, null, 2)}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-xs gap-1.5"
                onClick={handleCopyDebug}
              >
                <Copy className="h-3 w-3" />
                Copy debug details
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
