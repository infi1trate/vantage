/**
 * Session Media Panel
 * 
 * User-facing panel showing detailed media asset status with recovery actions:
 * - Screen/gameplay video: ready | processing | missing | failed
 * - Facecam video (optional): status + basic stats
 * - Audio tracks: mic/game present
 * - Cloud sync status (if applicable)
 * 
 * Provides contextual recovery actions based on status.
 */

import { useState, useCallback, useMemo, useEffect, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
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
  FileQuestion,
  Loader2,
  AlertTriangle,
  Cloud,
  CloudOff,
  ListTodo,
  PlusCircle,
  ExternalLink,
  RefreshCw,
  HelpCircle,
  Clapperboard,
  Settings2,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { useProcessing } from "@/contexts/ProcessingContext";
import { getReelSourceFromMetadata, ReelSource, ReelSourceStatus } from "@/lib/reelSource";

export type MediaAssetStatus = "ready" | "processing" | "missing" | "failed";

/**
 * Reel compatibility status
 * - ready: Full reel support (has ReelSource v2)
 * - preparing: ReelSource is being prepared (new recording processing)
 * - legacy: Older recording that needs one-time setup (will be auto-prepared)
 * - not_supported: No video available, cannot create reels
 */
export type ReelCompatibilityStatus = "ready" | "preparing" | "legacy" | "not_supported";

interface ReelCompatibilityInfo {
  status: ReelCompatibilityStatus;
  label: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
}

function getReelCompatibilityInfo(
  reelSource: ReelSource | null,
  hasVideoUrl: boolean,
  overallVideoStatus: MediaAssetStatus
): ReelCompatibilityInfo {
  // No video available at all
  if (overallVideoStatus === "missing" || overallVideoStatus === "failed") {
    return {
      status: "not_supported",
      label: "Not supported",
      description: "No recording available for reel creation.",
      icon: <Ban className="h-4 w-4" />,
      colorClass: "text-muted-foreground",
    };
  }
  
  // Video is still processing
  if (overallVideoStatus === "processing") {
    return {
      status: "preparing",
      label: "Preparing",
      description: "Recording is still processing. Reel creation will be available once complete.",
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      colorClass: "text-vantage-warning",
    };
  }
  
  // Check ReelSource status
  if (reelSource) {
    switch (reelSource.status) {
      case "ready":
        return {
          status: "ready",
          label: "Ready",
          description: "Full reel features available.",
          icon: <CheckCircle2 className="h-4 w-4" />,
          colorClass: "text-vantage-green",
        };
      
      case "preparing":
        return {
          status: "preparing",
          label: "Preparing",
          description: "Recording metadata is being prepared for reels.",
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          colorClass: "text-vantage-warning",
        };
      
      case "failed":
        return {
          status: "not_supported",
          label: "Setup failed",
          description: "Reel preparation failed. Try creating a reel to retry.",
          icon: <AlertCircle className="h-4 w-4" />,
          colorClass: "text-destructive",
        };
      
      case "missing":
        // ReelSource exists but marked missing - check if video actually exists
        if (hasVideoUrl) {
          return {
            status: "legacy",
            label: "Needs setup",
            description: "This recording was created before reels were available. We'll prepare it automatically when you create a reel.",
            icon: <Settings2 className="h-4 w-4" />,
            colorClass: "text-primary",
          };
        }
        return {
          status: "not_supported",
          label: "Not supported",
          description: "No recording available for reel creation.",
          icon: <Ban className="h-4 w-4" />,
          colorClass: "text-muted-foreground",
        };
    }
  }
  
  // No ReelSource but video exists - legacy session
  if (hasVideoUrl) {
    return {
      status: "legacy",
      label: "Needs setup",
      description: "This recording was created before reels were available. We'll prepare it automatically when you create a reel.",
      icon: <Settings2 className="h-4 w-4" />,
      colorClass: "text-primary",
    };
  }
  
  // Fallback
  return {
    status: "not_supported",
    label: "Not supported",
    description: "Reel creation is not available for this session.",
    icon: <Ban className="h-4 w-4" />,
    colorClass: "text-muted-foreground",
  };
}

interface SessionMediaPanelProps {
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
  dropboxSyncStatus?: "pending" | "synced" | "failed" | null;
  className?: string;
  defaultOpen?: boolean;
  onRetryProcessing?: () => void;
}

interface MediaStatus {
  status: MediaAssetStatus;
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
    status: "ready",
    label: "Ready",
    icon: <CheckCircle2 className="h-4 w-4" />,
    colorClass: "text-vantage-green",
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

export const SessionMediaPanel = forwardRef<HTMLDivElement, SessionMediaPanelProps>(
  function SessionMediaPanel({
    session,
    videoAssets,
    audioTracks,
    facecamTracks,
    localSession,
    isLocalSession = false,
    dropboxSyncStatus,
    className,
    defaultOpen = true,
    onRetryProcessing,
  }, ref) {
    const navigate = useNavigate();
    const { jobs } = useProcessing();
    const [isExpanded, setIsExpanded] = useState(defaultOpen);
    const [showDebug, setShowDebug] = useState(false);

    // Auto-expand when defaultOpen changes (e.g., from URL param)
    useEffect(() => {
      if (defaultOpen) {
        setIsExpanded(true);
      }
    }, [defaultOpen]);

    // Analyze media status
    const screenVideo = useMemo(() => {
      const gameplay = videoAssets.find(v => v.asset_type === "gameplay" || v.asset_type === "combined");
      const hasCloudVideo = !!session?.video_url;
      const hasLocalVideo = isLocalSession && localSession?.hasBlob !== false;
      
      // Status can be: uploading | processing | ready | failed
      const rawStatus = gameplay?.status || (hasCloudVideo ? "ready" : hasLocalVideo ? "local" : undefined);
      
      return {
        present: !!(gameplay || hasCloudVideo || hasLocalVideo),
        asset: gameplay,
        cloudUrl: session?.video_url,
        status: rawStatus as string | undefined,
        error: gameplay?.error_message,
        durationMs: gameplay?.duration_ms || (localSession?.duration ? localSession.duration * 1000 : undefined),
        sizeBytes: gameplay?.file_size_bytes || localSession?.blobSize,
        createdAt: gameplay?.created_at || session?.created_at || localSession?.createdAt,
        updatedAt: gameplay?.updated_at || session?.updated_at,
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

    // Check if there's an active processing job for this session
    const processingJob = useMemo(() => {
      const sessionId = session?.id || localSession?.id;
      if (!sessionId) return null;
      return jobs.find(j => 
        j.sessionId === sessionId && 
        (j.status === "queued" || j.status === "processing" || j.status === "uploading")
      ) || null;
    }, [jobs, session?.id, localSession?.id]);

    // Determine overall video status
    const overallVideoStatus = useMemo((): MediaAssetStatus => {
      if (processingJob) return "processing";
      if (isLocalSession) {
        if (localSession?.status === "not_stored_locally") return "failed";
        return localSession?.hasBlob !== false ? "ready" : "missing";
      }
      // Session status can be: recording | processing | uploading | ready | failed
      const sessionStatus = session?.status as string | null | undefined;
      if (sessionStatus === "recording" || sessionStatus === "processing" || sessionStatus === "uploading") return "processing";
      if (sessionStatus === "failed") return "failed";
      if (!screenVideo.present) return "missing";
      const screenAssetStatus = screenVideo.status;
      if (screenAssetStatus === "failed") return "failed";
      if (screenAssetStatus === "processing" || screenAssetStatus === "uploading") return "processing";
      return "ready";
    }, [session, localSession, isLocalSession, screenVideo, processingJob]);

    // Determine why video is missing/failed
    const videoStatusExplanation = useMemo(() => {
      if (overallVideoStatus === "ready") {
        return "Your gameplay recording is ready to use.";
      }
      
      if (overallVideoStatus === "processing") {
        if (processingJob) {
          return `Recording is being processed (${processingJob.status}). This may take a few minutes.`;
        }
        return "Video is still being processed or uploaded. This usually takes a few minutes.";
      }

      if (isLocalSession) {
        if (localSession?.status === "not_stored_locally") {
          return "Recording was too large for browser storage and couldn't be saved locally.";
        }
        if (!localSession?.hasBlob) {
          return "Recording data was cleared from browser storage.";
        }
      }

      if (!session) return "Session data is still loading.";
      
      if (session.status === "failed") {
        return "Session processing failed. You may need to retry or start a new recording.";
      }
      
      const failedAsset = videoAssets.find(v => v.status === "failed");
      if (failedAsset) {
        return `Video upload failed: ${failedAsset.error_message || "Unknown error"}`;
      }

      if (videoAssets.length === 0 && !session.video_url) {
        return "No video file was uploaded for this session. The recording may have been interrupted.";
      }

      return "Video is not available. The upload may have been interrupted.";
    }, [overallVideoStatus, session, videoAssets, localSession, isLocalSession, processingJob]);

    // Reel compatibility status
    const reelCompatibility = useMemo((): ReelCompatibilityInfo => {
      // Extract ReelSource from session metadata
      const reelSource = session?.metadata 
        ? getReelSourceFromMetadata(session.metadata as Record<string, unknown>)
        : null;
      
      const hasVideoUrl = !!session?.video_url;
      
      return getReelCompatibilityInfo(reelSource, hasVideoUrl, overallVideoStatus);
    }, [session, overallVideoStatus]);

    // Build debug data
    const debugData = useMemo(() => ({
      sessionId: session?.id || localSession?.id,
      isLocal: isLocalSession,
      sessionStatus: session?.status || localSession?.status,
      overallVideoStatus,
      sessionCreatedAt: session?.created_at || localSession?.createdAt,
      
      screenVideo: {
        present: screenVideo.present,
        status: screenVideo.status,
        durationMs: screenVideo.durationMs,
        sizeBytes: screenVideo.sizeBytes,
        mimeType: screenVideo.mimeType,
        error: screenVideo.error,
      },
      
      facecam: { present: facecam.present, status: facecam.status },
      micAudio: { present: micAudio.present, status: micAudio.status },
      gameAudio: { present: gameAudio.present, status: gameAudio.status },
      dropboxSyncStatus,
      
      reelCompatibility: {
        status: reelCompatibility.status,
        hasReelSource: !!session?.metadata && !!getReelSourceFromMetadata(session.metadata as Record<string, unknown>),
        reelSourceStatus: session?.metadata 
          ? getReelSourceFromMetadata(session.metadata as Record<string, unknown>)?.status 
          : null,
      },
      
      processingJob: processingJob ? {
        id: processingJob.id,
        status: processingJob.status,
        progress: processingJob.progress,
      } : null,
      
      timestamp: new Date().toISOString(),
    }), [session, localSession, isLocalSession, overallVideoStatus, screenVideo, facecam, micAudio, gameAudio, dropboxSyncStatus, reelCompatibility, processingJob]);

    const handleCopyDebug = useCallback(() => {
      navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
      toast.success("Debug details copied to clipboard");
    }, [debugData]);

    const handleViewQueue = useCallback(() => {
      // Just scroll to the footer processing queue (it's always visible when jobs exist)
      toast.info("Check the processing queue in the footer below.");
    }, []);

    const handleStartNewRecording = useCallback(() => {
      navigate("/capture");
    }, [navigate]);

    const screenStatus = getMediaStatus("video", { 
      present: screenVideo.present, 
      status: screenVideo.status,
      error: screenVideo.error,
    });
    const facecamStatus = getMediaStatus("facecam", { present: facecam.present, status: facecam.status });
    const micStatus = getMediaStatus("mic", { present: micAudio.present, status: micAudio.status });
    const gameAudioStatus = getMediaStatus("game_audio", { present: gameAudio.present, status: gameAudio.status });

    // Determine card style based on status
    const isWarning = overallVideoStatus === "processing";
    const isError = overallVideoStatus === "failed" || overallVideoStatus === "missing";

    return (
      <Card 
        ref={ref}
        className={cn(
          "border-border/50",
          isError && "border-destructive/30 bg-destructive/5",
          isWarning && "border-vantage-warning/30 bg-vantage-warning/5",
          !isError && !isWarning && "bg-card/50",
          className
        )}
      >
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 px-4 cursor-pointer hover:bg-accent/5 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isError ? (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  ) : isWarning ? (
                    <Loader2 className="h-4 w-4 text-vantage-warning animate-spin" />
                  ) : (
                    <Video className="h-4 w-4 text-vantage-green" />
                  )}
                  <CardTitle className="text-sm font-medium">
                    Session Media
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] h-5 gap-1",
                      overallVideoStatus === "ready" && "text-vantage-green border-vantage-green/30",
                      overallVideoStatus === "processing" && "text-vantage-warning border-vantage-warning/30",
                      (overallVideoStatus === "failed" || overallVideoStatus === "missing") && "text-destructive border-destructive/30",
                    )}
                  >
                    {overallVideoStatus === "ready" && <CheckCircle2 className="h-3 w-3" />}
                    {overallVideoStatus === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
                    {(overallVideoStatus === "failed" || overallVideoStatus === "missing") && <AlertCircle className="h-3 w-3" />}
                    {overallVideoStatus === "ready" ? "Ready" : 
                     overallVideoStatus === "processing" ? "Processing" : 
                     overallVideoStatus === "failed" ? "Failed" : "Missing"}
                  </Badge>
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
              {/* Status Explanation */}
              <div className={cn(
                "flex items-start gap-3 p-3 rounded-lg",
                isError && "bg-destructive/10 border border-destructive/20",
                isWarning && "bg-vantage-warning/10 border border-vantage-warning/20",
                !isError && !isWarning && "bg-accent/10 border border-border/30",
              )}>
                {isError ? (
                  <FileQuestion className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                ) : isWarning ? (
                  <Loader2 className="h-5 w-5 text-vantage-warning shrink-0 mt-0.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-vantage-green shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5 flex-1">
                  <p className={cn(
                    "text-sm font-medium",
                    isError && "text-destructive",
                    isWarning && "text-vantage-warning",
                    !isError && !isWarning && "text-vantage-green",
                  )}>
                    {overallVideoStatus === "ready" ? "Gameplay recording available" :
                     overallVideoStatus === "processing" ? "Recording is being processed" :
                     overallVideoStatus === "failed" ? "Recording failed" : "Recording not available"}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {videoStatusExplanation}
                  </p>
                </div>
              </div>

              {/* Recovery Actions */}
              {(isError || isWarning) && (
                <div className="flex flex-wrap gap-2">
                  {overallVideoStatus === "processing" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={handleViewQueue}
                    >
                      <ListTodo className="h-3.5 w-3.5" />
                      View processing queue
                    </Button>
                  )}
                  {(overallVideoStatus === "failed" || overallVideoStatus === "missing") && (
                    <>
                      {onRetryProcessing && overallVideoStatus === "failed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={onRetryProcessing}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Retry processing
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={handleStartNewRecording}
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        Start a new recording
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-muted-foreground"
                        onClick={() => window.open("https://docs.getvantage.app/troubleshooting/missing-recordings", "_blank")}
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        Learn why this happens
                      </Button>
                    </>
                  )}
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
                      {screenVideo.updatedAt && (
                        <div className="text-[9px] text-muted-foreground/70">
                          Updated {formatDistanceToNow(new Date(screenVideo.updatedAt), { addSuffix: true })}
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
                      {facecam.present ? facecamStatus.label : "Not recorded"}
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
                      {micAudio.present ? micStatus.label : "Not recorded"}
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
                      {gameAudio.present ? gameAudioStatus.label : "Not recorded"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cloud Sync Status */}
              {dropboxSyncStatus && (
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-accent/5 border border-border/30">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    {dropboxSyncStatus === "synced" ? (
                      <Cloud className="h-3.5 w-3.5 text-vantage-green" />
                    ) : dropboxSyncStatus === "failed" ? (
                      <CloudOff className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <Cloud className="h-3.5 w-3.5 text-vantage-warning animate-pulse" />
                    )}
                    Cloud Backup
                  </span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px]",
                      dropboxSyncStatus === "synced" && "text-vantage-green border-vantage-green/30",
                      dropboxSyncStatus === "pending" && "text-vantage-warning border-vantage-warning/30",
                      dropboxSyncStatus === "failed" && "text-destructive border-destructive/30",
                    )}
                  >
                    {dropboxSyncStatus === "synced" ? "Backed up" : 
                     dropboxSyncStatus === "pending" ? "Syncing..." : "Failed"}
                  </Badge>
                </div>
              )}

              {/* Reel Compatibility Status */}
              <div className={cn(
                "flex items-start gap-3 py-2.5 px-3 rounded-lg border",
                reelCompatibility.status === "ready" && "bg-vantage-green/5 border-vantage-green/20",
                reelCompatibility.status === "preparing" && "bg-vantage-warning/5 border-vantage-warning/20",
                reelCompatibility.status === "legacy" && "bg-primary/5 border-primary/20",
                reelCompatibility.status === "not_supported" && "bg-muted/30 border-border/30",
              )}>
                <div className={cn("shrink-0 mt-0.5", reelCompatibility.colorClass)}>
                  <Clapperboard className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">Reel compatibility</span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] h-5 gap-1 shrink-0",
                        reelCompatibility.status === "ready" && "text-vantage-green border-vantage-green/30",
                        reelCompatibility.status === "preparing" && "text-vantage-warning border-vantage-warning/30",
                        reelCompatibility.status === "legacy" && "text-primary border-primary/30",
                        reelCompatibility.status === "not_supported" && "text-muted-foreground border-border/50",
                      )}
                    >
                      {reelCompatibility.icon}
                      {reelCompatibility.label}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {reelCompatibility.description}
                  </p>
                </div>
              </div>

              {/* Debug Section */}
              <Collapsible open={showDebug} onOpenChange={setShowDebug}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full h-7 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {showDebug ? "Hide" : "Show"} debug details
                    {showDebug ? (
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 h-7 text-xs gap-1.5 w-full"
                    onClick={handleCopyDebug}
                  >
                    <Copy className="h-3 w-3" />
                    Copy debug details
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }
);

export default SessionMediaPanel;
