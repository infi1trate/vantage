import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { FilmRoomPlayer, VideoMetaInfo, VideoDecodeError } from "@/components/player/FilmRoomPlayer";
import { AnnotationPanel } from "@/components/player/AnnotationPanel";
import { VoiceNotePanel } from "@/components/player/VoiceNotePanel";
import { AIAnalysisPanel } from "@/components/player/AIAnalysisPanel";
import { FeedbackCardData } from "@/components/player/FeedbackCard";
import { ShareSessionDialog } from "@/components/sharing/ShareSessionDialog";
import { SocialCommentsPanel } from "@/components/social/SocialCommentsPanel";
import { DeleteSessionDialog } from "@/components/privacy/DeleteSessionDialog";
import { PrivacyBadge } from "@/components/privacy/PrivacyBadge";
import { supabase } from "@/integrations/supabase/client";
import {
  getCaptureSession,
  getAnnotations,
  getVoiceNotes,
  getAIAnalysis,
  getTimelineEvents,
  getDrawAnnotations,
  getVideoAssets,
  getAudioTracks,
  createAIAnalysis,
  deleteAnnotation,
  permanentlyDeleteSession,
  CaptureSession,
  Annotation,
  VoiceNote,
  AIAnalysis,
  TimelineEvent,
  DrawAnnotation,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, ArrowLeft, Share2, Download, Gamepad2, MessageSquare, Trash2, AlertTriangle, Bug, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function SessionReview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Session data states
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [localSession, setLocalSession] = useState<LocalSession | null>(null);
  const [isLocalSession, setIsLocalSession] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [blobLoading, setBlobLoading] = useState(false);
  const [blobMissing, setBlobMissing] = useState(false);
  const [blobDebugInfo, setBlobDebugInfo] = useState<{
    sessionFound: boolean;
    blobSize: number | null;
    blobType: string | null;
    error: string | null;
  } | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoMetaInfo | null>(null);
  const [localBlob, setLocalBlob] = useState<Blob | null>(null);

  const [videoAssets, setVideoAssets] = useState<VideoAsset[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [analyses, setAnalyses] = useState<AIAnalysis[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [drawAnnotations, setDrawAnnotations] = useState<DrawAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [activePanel, setActivePanel] = useState<"annotations" | "voice" | "ai" | "social">("annotations");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [feedbackCards, setFeedbackCards] = useState<FeedbackCardData[]>([]);
  const [patterns, setPatterns] = useState<{ name: string; description: string; frequency: string; impact: "positive" | "negative" | "neutral" }[]>([]);
  const [recommendations, setRecommendations] = useState<{ text: string; priority: "high" | "medium" | "low"; category: string }[]>([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const playerRef = useRef<{ enterDrawingMode: () => void } | null>(null);
  
  // Track current object URL in ref for stable cleanup
  const videoUrlRef = useRef<string | null>(null);

  // Cleanup object URL on unmount only (not on every localVideoUrl change)
  useEffect(() => {
    return () => {
      if (videoUrlRef.current) {
        console.log("[SessionReview] Revoking object URL on unmount");
        URL.revokeObjectURL(videoUrlRef.current);
        videoUrlRef.current = null;
      }
    };
  }, []); // Empty deps - cleanup only on unmount

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
      // First, try to load from IndexedDB (local session)
      const localData = await getLocalSession(sessionId);
      
      if (localData) {
        console.log("[SessionReview] Found local session:", sessionId);
        setIsLocalSession(true);
        setLocalSession(localData);
        setBlobLoading(true);
        
        try {
          // Load the blob
          let blob = await getLocalSessionBlob(sessionId);
          
          if (blob) {
            console.log("[SessionReview] Blob loaded, size:", blob.size, "type:", blob.type);
            
            // If blob.type is empty, reconstruct with stored mimeType
            if (!blob.type || blob.type === "") {
              const storedMimeType = localData.mimeType || "video/webm";
              console.log("[SessionReview] Reconstructing blob with mimeType:", storedMimeType);
              blob = new Blob([blob], { type: storedMimeType });
            }
            
            // Revoke previous URL if exists (for session changes)
            if (videoUrlRef.current) {
              URL.revokeObjectURL(videoUrlRef.current);
            }
            
            // Create stable object URL once
            const url = URL.createObjectURL(blob);
            videoUrlRef.current = url;
            setLocalVideoUrl(url);
            setLocalBlob(blob);
            
            // Set video metadata for diagnostics
            setVideoMeta({
              blobType: blob.type || null,
              blobSize: blob.size,
              videoDuration: null, // Will be set by onLoadedMetadata
              videoWidth: null,
              videoHeight: null,
            });
            
            setBlobDebugInfo({
              sessionFound: true,
              blobSize: blob.size,
              blobType: blob.type || null,
              error: null,
            });
          } else {
            console.warn("[SessionReview] Blob missing for session:", sessionId);
            setBlobMissing(true);
            setBlobDebugInfo({
              sessionFound: true,
              blobSize: null,
              blobType: null,
              error: "Blob not found in IndexedDB blobs store",
            });
          }
        } finally {
          setBlobLoading(false);
        }
        
        setLoading(false);
        return;
      }

      // Not a local session, try Supabase
      console.log("[SessionReview] Not a local session, trying Supabase:", sessionId);
      setBlobDebugInfo({
        sessionFound: false,
        blobSize: null,
        blobType: null,
        error: "Session not found in IndexedDB, loaded from cloud",
      });
      
      const [sessionData, videoAssetsData, audioTracksData, annotationsData, voiceNotesData, analysesData, eventsData, drawingsData] = await Promise.all([
        getCaptureSession(sessionId!),
        getVideoAssets(sessionId!).catch(() => []),
        getAudioTracks(sessionId!).catch(() => []),
        getAnnotations(sessionId!),
        getVoiceNotes(sessionId!),
        getAIAnalysis(sessionId!),
        getTimelineEvents(sessionId!).catch(() => []),
        getDrawAnnotations(sessionId!).catch(() => []),
      ]);

      setSession(sessionData);
      setVideoAssets(videoAssetsData);
      setAudioTracks(audioTracksData);
      setAnnotations(annotationsData);
      setVoiceNotes(voiceNotesData);
      setAnalyses(analysesData);
      setEvents(eventsData);
      setDrawAnnotations(drawingsData);

      // If session is still processing, poll for updates
      if (sessionData.status === "processing") {
        setTimeout(loadSessionData, 3000);
      }
    } catch (error) {
      console.error("Error loading session:", error);
      toast.error("Session not found");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleAnnotationCreated = useCallback((annotation: Annotation) => {
    setAnnotations((prev) => [...prev, annotation].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
  }, []);

  const handleAnnotationClick = useCallback((annotation: Annotation) => {
    setCurrentTime(annotation.timestamp_seconds);
  }, []);

  const handleAnnotationDelete = useCallback(async (annotationId: string) => {
    try {
      await deleteAnnotation(annotationId);
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
      toast.success("Annotation deleted");
    } catch (error) {
      console.error("Error deleting annotation:", error);
      toast.error("Failed to delete annotation");
    }
  }, []);

  const handleVoiceNoteCreated = useCallback((voiceNote: VoiceNote) => {
    setVoiceNotes((prev) => [...prev, voiceNote].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
  }, []);

  const handleVoiceNoteClick = useCallback((voiceNote: VoiceNote) => {
    setCurrentTime(voiceNote.timestamp_seconds);
  }, []);

  const handleDrawingCreated = useCallback((drawing: DrawAnnotation) => {
    setDrawAnnotations((prev) => [...prev, drawing].sort((a, b) => a.timestamp_ms - b.timestamp_ms));
  }, []);

  // Video loaded successfully - update metadata
  const handleVideoLoaded = useCallback((videoDuration: number) => {
    console.log("[SessionReview] Video loaded, duration:", videoDuration);
    setVideoMeta((prev) => prev ? { ...prev, videoDuration } : null);
  }, []);

  // Video decode error
  const handleVideoError = useCallback((error: VideoDecodeError) => {
    console.error("[SessionReview] Video decode error:", error);
    toast.error(error.message);
  }, []);

  // Download the local recording
  const handleDownloadRecording = useCallback(async () => {
    if (!localBlob || !localSession) {
      toast.error("No recording available to download");
      return;
    }
    
    try {
      // Determine file extension from mimeType
      const mimeType = localBlob.type || localSession.mimeType || "video/webm";
      const extension = mimeType.includes("mp4") ? "mp4" : "webm";
      
      const url = URL.createObjectURL(localBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${localSession.title.replace(/[^a-z0-9]/gi, "_")}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download recording");
    }
  }, [localBlob, localSession]);

  const handleRequestAnalysis = useCallback(async () => {
    if (!session || !user) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      // Prepare session data for analysis
      const sessionData = {
        title: session.title,
        game_name: session.game_name,
        duration_seconds: session.duration_seconds,
        annotations: annotations.map(a => ({
          id: a.id,
          timestamp_seconds: a.timestamp_seconds,
          annotation_type: a.annotation_type,
          title: a.title,
          content: a.content,
          tags: a.tags,
        })),
        voice_notes: voiceNotes.map(v => ({
          id: v.id,
          timestamp_seconds: v.timestamp_seconds,
          duration_seconds: v.duration_seconds,
          transcription: v.transcription,
        })),
        events: events.map(e => ({
          id: e.id,
          timestamp_ms: e.timestamp_ms,
          event_type: e.event_type,
          title: e.title,
          description: e.description,
        })),
      };

      // Call edge function
      const { data, error } = await supabase.functions.invoke('analyze-gameplay', {
        body: { session: sessionData },
      });

      if (error) {
        throw new Error(error.message || 'Analysis failed');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Update state with results
      setFeedbackCards(data.feedback_cards || []);
      setPatterns(data.patterns || []);
      setRecommendations(data.recommendations || []);

      // Save to database
      const newAnalysis = await createAIAnalysis(
        session.id,
        "general",
        data.summary,
        data.feedback_cards?.map((card: FeedbackCardData) => ({
          type: card.type === "strength" ? "positive" : card.type === "improvement" ? "warning" : "neutral",
          title: card.title,
          description: card.description,
          timestamp_ms: card.timestamp_seconds * 1000,
        })) || [],
        data.recommendations || [],
        data.overall_score
      );

      setAnalyses((prev) => [newAnalysis, ...prev]);
      toast.success("Analysis complete!");
    } catch (error) {
      console.error("Error running analysis:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze gameplay";
      setAnalysisError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, [session, user, annotations, voiceNotes, events]);

  const handleSeekFromAnalysis = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handlePermanentDelete = useCallback(async () => {
    if (!session || !user) return;

    setIsDeleting(true);
    try {
      await permanentlyDeleteSession(session.id, user.id);
      toast.success("Session permanently deleted");
      navigate("/library");
    } catch (error) {
      console.error("Error deleting session:", error);
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

  // Show loading state while blob is being fetched from IndexedDB
  if (isLocalSession && blobLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading recording...</p>
      </div>
    );
  }

  // Handle missing blob for local sessions
  if (isLocalSession && blobMissing) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 container py-12">
          <Button variant="ghost" onClick={() => navigate("/library")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
          
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Recording Data Missing</AlertTitle>
            <AlertDescription>
              The video blob for this session could not be found in local storage. 
              The recording may have been corrupted or cleared by the browser.
            </AlertDescription>
          </Alert>

          {/* Debug panel */}
          <Collapsible open={showDebugPanel} onOpenChange={setShowDebugPanel}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Bug className="h-4 w-4" />
                Debug Info
                <ChevronDown className={`h-4 w-4 transition-transform ${showDebugPanel ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-2">
                <div><span className="text-muted-foreground">Session ID:</span> {sessionId}</div>
                <div><span className="text-muted-foreground">Local Session Found:</span> {blobDebugInfo?.sessionFound ? "Yes" : "No"}</div>
                <div><span className="text-muted-foreground">Blob Size:</span> {blobDebugInfo?.blobSize ?? "N/A"}</div>
                <div><span className="text-muted-foreground">Error:</span> {blobDebugInfo?.error ?? "None"}</div>
                {localSession && (
                  <>
                    <div><span className="text-muted-foreground">Title:</span> {localSession.title}</div>
                    <div><span className="text-muted-foreground">Created:</span> {localSession.createdAt}</div>
                    <div><span className="text-muted-foreground">Duration:</span> {localSession.duration}s</div>
                    <div><span className="text-muted-foreground">Expected Size:</span> {localSession.blobSize} bytes</div>
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    );
  }

  // Handle no session found at all
  if (!session && !localSession) {
    return null;
  }

  // Determine video source and duration
  const isLocal = isLocalSession && localSession;
  const displayTitle = isLocal ? localSession.title : session?.title || "Untitled Session";
  const displayGame = isLocal ? localSession.gameName : session?.game_name;
  const displayDuration = isLocal 
    ? localSession.duration 
    : (session?.duration_seconds || (videoAssets[0]?.duration_ms ? videoAssets[0].duration_ms / 1000 : 300));
  const displayVisibility = isLocal ? localSession.visibility : (session?.visibility as "private" | "unlisted" | "public");
  const displayStatus = isLocal ? "ready" : session?.status;
  const displayCreatedAt = isLocal ? localSession.createdAt : session?.created_at;
  const displaySessionId = isLocal ? localSession.id : session?.id;
  
  const videoUrl = isLocal 
    ? localVideoUrl 
    : (videoAssets.find(v => v.asset_type === "gameplay")?.storage_url || session?.video_url);
  const microphoneTrack = audioTracks.find(t => t.track_type === "microphone");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Session header */}
      <div className="border-b border-border/50 bg-card/30">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(isLocal ? "/library" : "/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold">{displayTitle}</h1>
                  <PrivacyBadge visibility={displayVisibility || "private"} />
                  {isLocal && (
                    <Badge variant="outline" className="border-accent/30 text-accent">
                      Local
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={
                      displayStatus === "ready"
                        ? "border-vantage-success/30 text-vantage-success"
                        : displayStatus === "processing"
                        ? "border-vantage-warning/30 text-vantage-warning"
                        : "border-destructive/30 text-destructive"
                    }
                  >
                    {displayStatus}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  {displayGame && (
                    <span className="flex items-center gap-1">
                      <Gamepad2 className="h-3 w-3" />
                      {displayGame}
                    </span>
                  )}
                  {displayCreatedAt && (
                    <span>{formatDistanceToNow(new Date(displayCreatedAt), { addSuffix: true })}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isLocal && (
                <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              )}
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Share dialog - only for cloud sessions */}
      {!isLocal && displaySessionId && (
        <ShareSessionDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          sessionId={displaySessionId}
          sessionTitle={displayTitle}
        />
      )}

      {/* Delete dialog */}
      <DeleteSessionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        sessionTitle={displayTitle}
        onConfirmDelete={handlePermanentDelete}
        isDeleting={isDeleting}
      />

      {/* Main content */}
      <div className="flex-1 container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Video player - 2 columns */}
          <div className="lg:col-span-2 flex flex-col">
            <FilmRoomPlayer
              sessionId={displaySessionId || sessionId || ""}
              videoUrl={videoUrl}
              audioUrl={isLocal ? undefined : microphoneTrack?.storage_url}
              duration={displayDuration}
              currentTime={currentTime}
              onTimeUpdate={handleTimeUpdate}
              onSeek={handleSeek}
              annotations={annotations}
              voiceNotes={voiceNotes}
              drawAnnotations={drawAnnotations}
              events={events}
              onAnnotationClick={handleAnnotationClick}
              onDrawingCreated={handleDrawingCreated}
              videoMeta={isLocal ? videoMeta : null}
              onVideoLoaded={handleVideoLoaded}
              onVideoError={handleVideoError}
              onDownloadRequest={isLocal ? handleDownloadRecording : undefined}
            />
          </div>

          {/* Side panel - 1 column */}
          <div className="flex flex-col h-full">
            <Tabs value={activePanel} onValueChange={(v) => setActivePanel(v as any)} className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="annotations">Notes</TabsTrigger>
                <TabsTrigger value="voice">Voice</TabsTrigger>
                <TabsTrigger value="social" className="gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Social
                </TabsTrigger>
                <TabsTrigger value="ai">AI</TabsTrigger>
              </TabsList>

              <TabsContent value="annotations" className="flex-1 mt-0 min-h-0">
                <AnnotationPanel
                  sessionId={displaySessionId || sessionId || ""}
                  currentTime={currentTime}
                  annotations={annotations}
                  onAnnotationCreated={handleAnnotationCreated}
                  onAnnotationClick={handleAnnotationClick}
                  onAnnotationDelete={handleAnnotationDelete}
                />
              </TabsContent>

              <TabsContent value="voice" className="flex-1 mt-0 min-h-0">
                <VoiceNotePanel
                  sessionId={displaySessionId || sessionId || ""}
                  currentTime={currentTime}
                  voiceNotes={voiceNotes}
                  onVoiceNoteCreated={handleVoiceNoteCreated}
                  onVoiceNoteClick={handleVoiceNoteClick}
                />
              </TabsContent>

              <TabsContent value="social" className="flex-1 mt-0 min-h-0">
                <SocialCommentsPanel
                  sessionId={displaySessionId || sessionId || ""}
                  currentTime={currentTime}
                  onSeekTo={handleSeek}
                  onStartDrawing={() => playerRef.current?.enterDrawingMode?.()}
                  onStartVoiceNote={() => setActivePanel("voice")}
                />
              </TabsContent>

              <TabsContent value="ai" className="flex-1 mt-0 min-h-0">
                <AIAnalysisPanel
                  analyses={analyses}
                  feedbackCards={feedbackCards}
                  patterns={patterns}
                  recommendations={recommendations}
                  onRequestAnalysis={handleRequestAnalysis}
                  onSeekTo={handleSeekFromAnalysis}
                  isAnalyzing={isAnalyzing}
                  analysisError={analysisError}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
