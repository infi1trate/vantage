import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { CinematicPlayer, VideoMetaInfo, VideoDecodeError } from "@/components/player/CinematicPlayer";
import { MarkerList } from "@/components/player/MarkerList";
import { ShareSessionDialog } from "@/components/sharing/ShareSessionDialog";
import { DeleteSessionDialog } from "@/components/privacy/DeleteSessionDialog";
import {
  getCaptureSession,
  getAnnotations,
  getVoiceNotes,
  getVideoAssets,
  getAudioTracks,
  deleteAnnotation,
  permanentlyDeleteSession,
  CaptureSession,
  Annotation,
  VoiceNote,
  VideoAsset,
  AudioTrack,
} from "@/lib/captures";
import {
  getLocalSession,
  getLocalSessionBlob,
  LocalSession,
} from "@/lib/localSessionStorage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Share2, Download, Gamepad2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function SessionReview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Session data
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [localSession, setLocalSession] = useState<LocalSession | null>(null);
  const [isLocalSession, setIsLocalSession] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [localBlob, setLocalBlob] = useState<Blob | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoMetaInfo | null>(null);

  const [videoAssets, setVideoAssets] = useState<VideoAsset[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const videoUrlRef = useRef<string | null>(null);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
        videoUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (sessionId && user) {
      loadSessionData();
    }
  }, [sessionId, user]);

  const loadSessionData = async () => {
    if (!sessionId) return;

    try {
      // Try local first
      const localData = await getLocalSession(sessionId);
      
      if (localData) {
        setIsLocalSession(true);
        setLocalSession(localData);
        
        let blob = await getLocalSessionBlob(sessionId);
        if (blob) {
          if (!blob.type || blob.type === "") {
            blob = new Blob([blob], { type: localData.mimeType || "video/webm" });
          }
          
          if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
          const url = URL.createObjectURL(blob);
          videoUrlRef.current = url;
          setLocalVideoUrl(url);
          setLocalBlob(blob);
          
          setVideoMeta({
            blobType: blob.type || null,
            blobSize: blob.size,
            storedMimeType: localData.mimeType || null,
            videoDuration: null,
            videoWidth: null,
            videoHeight: null,
          });
        }
        
        setLoading(false);
        return;
      }

      // Cloud session
      const [sessionData, videoAssetsData, audioTracksData, annotationsData, voiceNotesData] = await Promise.all([
        getCaptureSession(sessionId!),
        getVideoAssets(sessionId!).catch(() => []),
        getAudioTracks(sessionId!).catch(() => []),
        getAnnotations(sessionId!),
        getVoiceNotes(sessionId!),
      ]);

      setSession(sessionData);
      setVideoAssets(videoAssetsData);
      setAudioTracks(audioTracksData);
      setAnnotations(annotationsData);
      setVoiceNotes(voiceNotesData);
    } catch (error) {
      console.error("Error loading session:", error);
      toast.error("Session not found");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeUpdate = useCallback((time: number) => setCurrentTime(time), []);
  const handleSeek = useCallback((time: number) => setCurrentTime(time), []);

  const handleAnnotationCreated = useCallback((annotation: Annotation) => {
    setAnnotations((prev) => [...prev, annotation].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
  }, []);

  const handleMarkerClick = useCallback((time: number) => setCurrentTime(time), []);

  const handleAnnotationDelete = useCallback(async (annotationId: string) => {
    try {
      await deleteAnnotation(annotationId);
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
      toast.success("Marker removed");
    } catch (error) {
      console.error("Error deleting annotation:", error);
      toast.error("Failed to delete marker");
    }
  }, []);

  const handleVideoLoaded = useCallback((duration: number) => {
    setVideoMeta((prev) => prev ? { ...prev, videoDuration: duration } : null);
  }, []);

  const handleVideoError = useCallback((error: VideoDecodeError) => {
    console.error("Video decode error:", error);
    toast.error(error.message);
  }, []);

  const handleDownloadRecording = useCallback(async () => {
    if (!localBlob || !localSession) {
      toast.error("No recording available");
      return;
    }
    
    const extension = localSession.fileExt || (localBlob.type?.includes("mp4") ? "mp4" : "webm");
    const url = URL.createObjectURL(localBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${localSession.title.replace(/[^a-z0-9]/gi, "_")}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Download started");
  }, [localBlob, localSession]);

  const handleDownloadCloudRecording = useCallback(async () => {
    const gameplayAsset = videoAssets.find(v => v.asset_type === "gameplay");
    if (!gameplayAsset?.storage_url) {
      toast.error("No recording available");
      return;
    }
    
    try {
      const response = await fetch(gameplayAsset.storage_url);
      if (!response.ok) throw new Error("Failed to fetch");
      
      const blob = await response.blob();
      const extension = gameplayAsset.mime_type?.includes("mp4") ? "mp4" : "webm";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${session?.title?.replace(/[^a-z0-9]/gi, "_") || "recording"}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (error) {
      toast.error("Failed to download");
    }
  }, [videoAssets, session?.title]);

  const handlePermanentDelete = useCallback(async () => {
    if (!session || !user) return;
    
    setIsDeleting(true);
    try {
      await permanentlyDeleteSession(session.id, user.id);
      toast.success("Session deleted");
      navigate("/library");
    } catch (error) {
      toast.error("Failed to delete session");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [session, user, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session && !localSession) return null;

  const isLocal = isLocalSession && localSession;
  const displayTitle = isLocal ? localSession.title : session?.title || "Untitled";
  const displayGame = isLocal ? localSession.gameName : session?.game_name;
  const displayDuration = isLocal 
    ? localSession.duration 
    : (session?.duration_seconds || (videoAssets[0]?.duration_ms ? videoAssets[0].duration_ms / 1000 : 300));
  const displayCreatedAt = isLocal ? localSession.createdAt : session?.created_at;
  const displaySessionId = isLocal ? localSession.id : session?.id;
  
  const gameplayAsset = videoAssets.find(v => v.asset_type === "gameplay");
  const videoUrl = isLocal ? localVideoUrl : (gameplayAsset?.storage_url || session?.video_url);

  const cloudVideoMeta: VideoMetaInfo | null = !isLocal && gameplayAsset ? {
    blobType: gameplayAsset.mime_type || null,
    blobSize: gameplayAsset.file_size_bytes || null,
    storedMimeType: gameplayAsset.mime_type || null,
    videoDuration: gameplayAsset.duration_ms ? gameplayAsset.duration_ms / 1000 : null,
    videoWidth: gameplayAsset.width || null,
    videoHeight: gameplayAsset.height || null,
  } : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Minimal header */}
      <div className="border-b border-border/30">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(isLocal ? "/library" : "/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">{displayTitle}</h1>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {displayGame && (
                    <span className="flex items-center gap-1">
                      <Gamepad2 className="h-3 w-3" />
                      {displayGame}
                    </span>
                  )}
                  {displayCreatedAt && (
                    <span>{formatDistanceToNow(new Date(displayCreatedAt), { addSuffix: true })}</span>
                  )}
                  {isLocal && (
                    <Badge variant="outline" className="text-[10px] h-4">Local</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {!isLocal && (
                <Button variant="ghost" size="sm" onClick={() => setShareDialogOpen(true)}>
                  <Share2 className="h-4 w-4" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={isLocal ? handleDownloadRecording : handleDownloadCloudRecording}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {!isLocal && displaySessionId && (
        <ShareSessionDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          sessionId={displaySessionId}
          sessionTitle={displayTitle}
        />
      )}
      
      <DeleteSessionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        sessionTitle={displayTitle}
        onConfirmDelete={handlePermanentDelete}
        isDeleting={isDeleting}
      />

      {/* Main content - Clean 2-column */}
      <div className="flex-1 container py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 h-[calc(100vh-160px)]">
          {/* Player */}
          <div className="min-h-[400px] lg:min-h-0">
            <CinematicPlayer
              videoUrl={videoUrl}
              duration={displayDuration}
              currentTime={currentTime}
              onTimeUpdate={handleTimeUpdate}
              onSeek={handleSeek}
              annotations={annotations}
              voiceNotes={voiceNotes}
              onMarkerClick={handleMarkerClick}
              videoMeta={isLocal ? videoMeta : cloudVideoMeta}
              onVideoLoaded={handleVideoLoaded}
              onVideoError={handleVideoError}
              onDownloadRequest={isLocal ? handleDownloadRecording : handleDownloadCloudRecording}
            />
          </div>

          {/* Marker list */}
          <div className="bg-card rounded-xl border border-border/30 overflow-hidden">
            <MarkerList
              sessionId={displaySessionId || sessionId || ""}
              currentTime={currentTime}
              annotations={annotations}
              voiceNotes={voiceNotes}
              onAnnotationCreated={handleAnnotationCreated}
              onMarkerClick={handleMarkerClick}
              onAnnotationDelete={handleAnnotationDelete}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
