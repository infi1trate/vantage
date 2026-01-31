import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { usePrefetchSession } from "@/hooks/useSessionQueries";
import { useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Play, 
  MoreVertical, 
  Trash2, 
  Eye,
  Download,
  Share2,
  Gamepad2,
  Mic,
  Video,
  Cloud,
  Camera,
  Volume2,
  Lock,
  Globe,
  Link as LinkIcon,
  Loader2,
  HardDrive,
  MessageSquare
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// Types
import type { LocalSession } from "@/lib/localSessionStorage";
import type { SessionWithAssets } from "@/lib/sessionLibrary";

// Utils
import { getLocalSessionBlob, getLocalSessionThumbnail, deleteLocalSession, formatBytes } from "@/lib/localSessionStorage";
import { deleteSessionPermanently } from "@/lib/sessionLibrary";

/**
 * Generate a deterministic placeholder color based on session id
 */
function getPlaceholderColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 40%, 25%)`;
}

// Unified session type for the component
export type UnifiedSession = 
  | { type: "local"; data: LocalSession }
  | { type: "cloud"; data: SessionWithAssets };

export interface SessionCardProps {
  session: UnifiedSession;
  onDeleted: () => void;
  viewMode: "grid" | "list";
}

export const SessionCard = memo(function SessionCard({ session, onDeleted, viewMode }: SessionCardProps) {
  const navigate = useNavigate();
  const prefetchSession = usePrefetchSession();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  
  const thumbnailUrlRef = useRef<string | null>(null);
  const hasPrefetched = useRef(false);

  // Extract common properties based on session type
  const isLocal = session.type === "local";
  const sessionId = isLocal ? session.data.id : session.data.id;
  const title = isLocal ? session.data.title : session.data.title;
  const gameName = isLocal ? session.data.gameName : session.data.game_name;
  const duration = isLocal ? session.data.duration : session.data.duration_seconds;
  const createdAt = isLocal ? session.data.createdAt : session.data.created_at;
  const blobSize = isLocal ? session.data.blobSize : undefined;
  
  // Session-specific properties
  const localSession = isLocal ? session.data : null;
  const cloudSession = !isLocal ? session.data : null;

  // Prefetch session data on hover (only once per card)
  const handlePrefetch = useCallback(() => {
    if (hasPrefetched.current) return;
    hasPrefetched.current = true;
    prefetchSession(sessionId, isLocal);
  }, [prefetchSession, sessionId, isLocal]);

  // Load thumbnail for local sessions
  useEffect(() => {
    if (!isLocal) return;
    
    let cancelled = false;
    
    async function loadThumbnail() {
      try {
        const thumbBlob = await getLocalSessionThumbnail(sessionId);
        if (thumbBlob && !cancelled) {
          const url = URL.createObjectURL(thumbBlob);
          thumbnailUrlRef.current = url;
          setThumbnailUrl(url);
        }
      } catch (err) {
        console.warn("[SessionCard] Failed to load thumbnail blob:", err);
      }
    }
    
    loadThumbnail();
    
    return () => {
      cancelled = true;
      if (thumbnailUrlRef.current) {
        URL.revokeObjectURL(thumbnailUrlRef.current);
        thumbnailUrlRef.current = null;
      }
    };
  }, [sessionId, isLocal]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Navigate to session detail
  const handleOpenDetail = () => {
    navigate(`/session/${sessionId}`);
  };

  // Open preview modal (with stopPropagation)
  const handleOpenPreview = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (isLocal && localSession) {
      try {
        let blob = await getLocalSessionBlob(sessionId);
        if (blob) {
          if (!blob.type || blob.type === "") {
            const storedMimeType = localSession.mimeType || "video/webm";
            blob = new Blob([blob], { type: storedMimeType });
          }
          const url = URL.createObjectURL(blob);
          setVideoUrl(url);
          setShowPreviewDialog(true);
        } else {
          toast.error("Video not found");
        }
      } catch (error) {
        console.error("Failed to load video:", error);
        toast.error("Failed to load video");
      }
    } else if (cloudSession) {
      // For cloud sessions, navigate to detail page for full playback experience
      toast.info("Open the session to preview cloud recordings");
      navigate(`/session/${sessionId}`);
    }
  };

  const handleClosePreview = () => {
    setShowPreviewDialog(false);
    if (videoUrl && isLocal) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);
  };

  const handleDownload = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    
    if (!isLocal || !localSession) return;
    
    setIsDownloading(true);
    try {
      let blob = await getLocalSessionBlob(sessionId);
      if (blob) {
        if (!blob.type || blob.type === "") {
          const storedMimeType = localSession.mimeType || "video/webm";
          blob = new Blob([blob], { type: storedMimeType });
        }
        
        const extension = localSession.fileExt || (blob.type?.includes("mp4") || localSession.mimeType?.includes("mp4") ? "mp4" : "webm");
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.replace(/[^a-z0-9]/gi, "_")}_${format(new Date(createdAt), "yyyy-MM-dd")}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Download started");
      } else {
        toast.error("Video not found");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download video");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (isLocal) {
        await deleteLocalSession(sessionId);
        toast.success("Session deleted");
      } else {
        await deleteSessionPermanently(sessionId);
        toast.success("Session deleted permanently");
      }
      onDeleted();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete session");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Get thumbnail to display
  const getThumbnailDisplay = () => {
    if (isLocal && localSession) {
      if (thumbnailUrl) return thumbnailUrl;
      if (localSession.thumbnailDataUrl) return localSession.thumbnailDataUrl;
      return null;
    }
    return cloudSession?.thumbnail_url || null;
  };

  const thumbnailSrc = getThumbnailDisplay();

  // Status config for cloud sessions
  const statusConfig = {
    recording: { color: "bg-destructive/20 text-destructive border-destructive/30", label: "Recording" },
    processing: { color: "bg-vantage-warning/20 text-vantage-warning border-vantage-warning/30", label: "Processing" },
    ready: { color: "bg-vantage-success/20 text-vantage-success border-vantage-success/30", label: "Ready" },
    failed: { color: "bg-destructive/20 text-destructive border-destructive/30", label: "Failed" },
  };

  const visibilityConfig = {
    private: { icon: Lock, label: "Private" },
    unlisted: { icon: LinkIcon, label: "Unlisted" },
    public: { icon: Globe, label: "Public" },
  };

  const VisibilityIcon = cloudSession 
    ? visibilityConfig[cloudSession.visibility as keyof typeof visibilityConfig]?.icon || Lock
    : Lock;

  // LIST VIEW
  if (viewMode === "list") {
    return (
      <>
        <Card 
          className="group flex items-center gap-4 p-4 bg-card border-border/50 hover:border-primary/50 transition-all cursor-pointer"
          onClick={handleOpenDetail}
          onPointerEnter={handlePrefetch}
        >
          {/* Thumbnail */}
          <div className="shrink-0 group/thumb">
            <div className="w-40 aspect-video relative bg-muted/50 rounded-lg overflow-hidden">
              {thumbnailSrc ? (
                <img src={thumbnailSrc} alt={title} className="w-full h-full object-cover" />
              ) : (
                <div 
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: getPlaceholderColor(sessionId) }}
                >
                  <Gamepad2 className="h-8 w-8 text-white/30" />
                </div>
              )}
              {/* Duration badge - bottom left */}
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm">
                <span className="text-xs font-mono-data font-medium">{formatDuration(duration)}</span>
              </div>
              {/* Preview pill - bottom right */}
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-1 right-1 h-6 px-2 text-xs gap-1 bg-background/90 backdrop-blur-sm hover:bg-background opacity-0 group-hover/thumb:opacity-100 transition-opacity touch-device-visible"
                onClick={handleOpenPreview}
              >
                <Play className="h-3 w-3" fill="currentColor" />
                Preview
              </Button>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {title}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {gameName && (
                <span className="flex items-center gap-1">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  {gameName}
                </span>
              )}
              <span>{format(new Date(createdAt), "MMM d, yyyy")}</span>
              {isLocal && blobSize && (
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3.5 w-3.5" />
                  {formatBytes(blobSize)}
                </span>
              )}
            </div>
            
            {/* Capture types */}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs gap-1">
                <Video className="h-3 w-3" /> Video
              </Badge>
              {isLocal && localSession?.hasMic && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Mic className="h-3 w-3" /> Mic
                </Badge>
              )}
              {isLocal && localSession?.hasCam && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Camera className="h-3 w-3" /> Cam
                </Badge>
              )}
              {isLocal && localSession?.hasSystemAudio && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Volume2 className="h-3 w-3" /> Audio
                </Badge>
              )}
              {cloudSession?.has_microphone && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Mic className="h-3 w-3" /> Mic
                </Badge>
              )}
              {cloudSession?.has_facecam && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Camera className="h-3 w-3" /> Facecam
                </Badge>
              )}
              {cloudSession && cloudSession.annotation_count > 0 && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <MessageSquare className="h-3 w-3" /> {cloudSession.annotation_count}
                </Badge>
              )}
              {/* Dropbox sync indicator for list view */}
              {cloudSession?.dropbox_sync_status === "synced" && (
                <Badge 
                  variant="secondary" 
                  className="text-xs gap-1 bg-[#0061ff]/10 text-[#0061ff] border-[#0061ff]/20"
                  title={`Synced to Dropbox${cloudSession.dropbox_synced_at ? ` on ${format(new Date(cloudSession.dropbox_synced_at), "MMM d")}` : ""}`}
                >
                  <Cloud className="h-3 w-3" />
                </Badge>
              )}
            </div>
          </div>

          {/* Status & Privacy */}
          <div className="flex items-center gap-3">
            {isLocal ? (
              <Badge variant="outline" className="bg-vantage-success/20 text-vantage-success border-vantage-success/30">
                Local
              </Badge>
            ) : cloudSession && (
              <Badge variant="outline" className={statusConfig[cloudSession.status as keyof typeof statusConfig]?.color}>
                {cloudSession.status === "recording" && <span className="w-2 h-2 rounded-full bg-destructive mr-1.5 recording-pulse" />}
                {statusConfig[cloudSession.status as keyof typeof statusConfig]?.label}
              </Badge>
            )}
            <div className="flex items-center gap-1 text-muted-foreground" title={isLocal ? "Private" : visibilityConfig[cloudSession?.visibility as keyof typeof visibilityConfig]?.label}>
              <VisibilityIcon className="h-4 w-4" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" onClick={handleOpenPreview} title="Preview">
              <Play className="h-4 w-4 mr-1" />
              Preview
            </Button>
            <Button asChild size="sm">
              <Link to={`/session/${sessionId}`} onClick={(e) => e.stopPropagation()}>
                <Eye className="h-4 w-4 mr-1" />
                Open
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenDetail(); }}>
                  <Eye className="h-4 w-4 mr-2" /> View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenPreview}>
                  <Play className="h-4 w-4 mr-2" /> Preview
                </DropdownMenuItem>
                {isLocal && (
                  <DropdownMenuItem onClick={handleDownload} disabled={isDownloading}>
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download
                  </DropdownMenuItem>
                )}
                {!isLocal && (
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                    <Share2 className="h-4 w-4 mr-2" /> Share
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>

        {/* Delete Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {isLocal ? "Recording" : "Session Permanently"}?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>This will permanently delete <strong>"{title}"</strong>{isLocal ? " from your local storage." : " and all associated data:"}</p>
                {!isLocal && (
                  <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                    <li>Video recordings and thumbnails</li>
                    <li>Audio tracks (microphone, game audio)</li>
                    <li>Facecam recordings</li>
                    <li>All annotations and voice notes</li>
                    <li>AI analysis results</li>
                    <li>Comments and shares</li>
                  </ul>
                )}
                <p className="font-medium text-destructive">This action cannot be undone.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete{!isLocal && " Permanently"}
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Preview Dialog */}
        <Dialog open={showPreviewDialog} onOpenChange={handleClosePreview}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden">
            <DialogHeader className="p-4 pb-2">
              <DialogTitle className="text-lg">{title}</DialogTitle>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {gameName && (
                  <span className="flex items-center gap-1">
                    <Gamepad2 className="h-3.5 w-3.5" />
                    {gameName}
                  </span>
                )}
                <span className="font-mono-data">{formatDuration(duration)}</span>
                {isLocal && (
                  <Badge variant="outline" className="text-xs bg-vantage-success/20 text-vantage-success border-vantage-success/30">
                    Local
                  </Badge>
                )}
              </div>
            </DialogHeader>
            <div className="aspect-video bg-black">
              {videoUrl && (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 pt-3 border-t border-border/50">
              <Button variant="outline" onClick={handleClosePreview}>
                Close
              </Button>
              <Button onClick={() => { handleClosePreview(); navigate(`/session/${sessionId}`); }}>
                <Eye className="h-4 w-4 mr-2" />
                Open Details
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // GRID VIEW
  return (
    <>
      <Card 
        className="group relative overflow-hidden bg-card border-border/50 hover:border-primary/50 transition-all duration-300 card-hover cursor-pointer"
        onClick={handleOpenDetail}
        onPointerEnter={handlePrefetch}
      >
        {/* Thumbnail */}
        <div className="aspect-video relative bg-muted/50 overflow-hidden">
          {thumbnailSrc ? (
            <img src={thumbnailSrc} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: getPlaceholderColor(sessionId) }}
            >
              <Gamepad2 className="h-12 w-12 text-white/30" />
            </div>
          )}
          
          {/* Hover overlay (subtle) */}
          <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          {/* Duration badge - bottom left */}
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-background/80 backdrop-blur-sm">
            <span className="text-xs font-mono-data font-medium">{formatDuration(duration)}</span>
          </div>

          {/* Preview pill button - bottom right, visible on hover + always on touch */}
          <Button
            size="sm"
            variant="secondary"
            className="absolute bottom-2 right-2 h-7 px-2.5 text-xs gap-1 bg-background/90 backdrop-blur-sm hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity touch-device-visible"
            onClick={handleOpenPreview}
          >
            <Play className="h-3.5 w-3.5" fill="currentColor" />
            Preview
          </Button>

          {/* Status/Local badge */}
          <div className="absolute top-2 left-2">
            {isLocal ? (
              <Badge variant="outline" className="bg-vantage-success/20 text-vantage-success border-vantage-success/30">
                Local
              </Badge>
            ) : cloudSession && (
              <Badge variant="outline" className={statusConfig[cloudSession.status as keyof typeof statusConfig]?.color}>
                {cloudSession.status === "recording" && <span className="w-2 h-2 rounded-full bg-destructive mr-1.5 recording-pulse" />}
                {statusConfig[cloudSession.status as keyof typeof statusConfig]?.label}
              </Badge>
            )}
          </div>

          {/* Privacy indicator */}
          <div className="absolute top-2 right-2 p-1.5 rounded bg-background/80 backdrop-blur-sm">
            <VisibilityIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {title}
              </h3>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenDetail(); }}>
                  <Eye className="h-4 w-4 mr-2" /> View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenPreview}>
                  <Play className="h-4 w-4 mr-2" /> Preview
                </DropdownMenuItem>
                {isLocal && (
                  <DropdownMenuItem onClick={handleDownload} disabled={isDownloading}>
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download
                  </DropdownMenuItem>
                )}
                {!isLocal && (
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                    <Share2 className="h-4 w-4 mr-2" /> Share
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {gameName && (
              <span className="flex items-center gap-1">
                <Gamepad2 className="h-3 w-3" />
                {gameName}
              </span>
            )}
            <span>{formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
          </div>

          <div className="flex items-center justify-between mt-3">
            {/* Capture type icons */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-muted/50" title="Video">
                <Video className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              {isLocal && localSession?.hasMic && (
                <div className="p-1.5 rounded bg-muted/50" title="Microphone">
                  <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {isLocal && localSession?.hasCam && (
                <div className="p-1.5 rounded bg-muted/50" title="Camera">
                  <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {isLocal && localSession?.hasSystemAudio && (
                <div className="p-1.5 rounded bg-muted/50" title="System Audio">
                  <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {cloudSession?.has_microphone && (
                <div className="p-1.5 rounded bg-muted/50" title="Microphone">
                  <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {cloudSession?.has_facecam && (
                <div className="p-1.5 rounded bg-muted/50" title="Facecam">
                  <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {cloudSession && cloudSession.annotation_count > 0 && (
                <div className="flex items-center gap-1 px-1.5 py-1 rounded bg-muted/50" title="Moments">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{cloudSession.annotation_count}</span>
                </div>
              )}
              {/* Dropbox sync indicator - only for synced cloud sessions */}
              {cloudSession?.dropbox_sync_status === "synced" && (
                <div 
                  className="p-1.5 rounded bg-[#0061ff]/10" 
                  title={`Synced to Dropbox${cloudSession.dropbox_synced_at ? ` on ${format(new Date(cloudSession.dropbox_synced_at), "MMM d")}` : ""}`}
                >
                  <Cloud className="h-3.5 w-3.5 text-[#0061ff]/70" />
                </div>
              )}
            </div>

            {/* File size for local */}
            {isLocal && blobSize && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {formatBytes(blobSize)}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {isLocal ? "Recording" : "Session Permanently"}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will permanently delete <strong>"{title}"</strong>{isLocal ? " from your local storage." : " and all associated data:"}</p>
              {!isLocal && (
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>Video recordings and thumbnails</li>
                  <li>Audio tracks (microphone, game audio)</li>
                  <li>Facecam recordings</li>
                  <li>All annotations and voice notes</li>
                  <li>AI analysis results</li>
                  <li>Comments and shares</li>
                </ul>
              )}
              <p className="font-medium text-destructive">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete{!isLocal && " Permanently"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={handleClosePreview}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-lg">{title}</DialogTitle>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {gameName && (
                <span className="flex items-center gap-1">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  {gameName}
                </span>
              )}
              <span className="font-mono-data">{formatDuration(duration)}</span>
              {isLocal && (
                <Badge variant="outline" className="text-xs bg-vantage-success/20 text-vantage-success border-vantage-success/30">
                  Local
                </Badge>
              )}
            </div>
          </DialogHeader>
          <div className="aspect-video bg-black">
            {videoUrl && (
              <video
                src={videoUrl}
                controls
                autoPlay
                className="w-full h-full"
              />
            )}
          </div>
          <div className="flex items-center justify-end gap-3 p-4 pt-3 border-t border-border/50">
            <Button variant="outline" onClick={handleClosePreview}>
              Close
            </Button>
            <Button onClick={() => { handleClosePreview(); navigate(`/session/${sessionId}`); }}>
              <Eye className="h-4 w-4 mr-2" />
              Open Details
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
