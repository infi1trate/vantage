import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { FilmRoomPlayer } from "@/components/player/FilmRoomPlayer";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Share2, Download, Gamepad2, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function SessionReview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<CaptureSession | null>(null);
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
  const playerRef = useRef<{ enterDrawingMode: () => void } | null>(null);

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
    try {
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

  if (!session) {
    return null;
  }

  const duration = session.duration_seconds || (videoAssets[0]?.duration_ms ? videoAssets[0].duration_ms / 1000 : 300);
  const videoUrl = videoAssets.find(v => v.asset_type === "gameplay")?.storage_url || session.video_url;
  const microphoneTrack = audioTracks.find(t => t.track_type === "microphone");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Session header */}
      <div className="border-b border-border/50 bg-card/30">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold">{session.title}</h1>
                  <PrivacyBadge visibility={session.visibility as "private" | "unlisted" | "public"} />
                  <Badge
                    variant="outline"
                    className={
                      session.status === "ready"
                        ? "border-vantage-success/30 text-vantage-success"
                        : session.status === "processing"
                        ? "border-vantage-warning/30 text-vantage-warning"
                        : "border-destructive/30 text-destructive"
                    }
                  >
                    {session.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  {session.game_name && (
                    <span className="flex items-center gap-1">
                      <Gamepad2 className="h-3 w-3" />
                      {session.game_name}
                    </span>
                  )}
                  <span>{formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
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

      {/* Share dialog */}
      <ShareSessionDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        sessionId={session.id}
        sessionTitle={session.title}
      />

      {/* Delete dialog */}
      <DeleteSessionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        sessionTitle={session.title}
        onConfirmDelete={handlePermanentDelete}
        isDeleting={isDeleting}
      />

      {/* Main content */}
      <div className="flex-1 container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Video player - 2 columns */}
          <div className="lg:col-span-2 flex flex-col">
            <FilmRoomPlayer
              sessionId={session.id}
              videoUrl={videoUrl}
              audioUrl={microphoneTrack?.storage_url}
              duration={duration}
              currentTime={currentTime}
              onTimeUpdate={handleTimeUpdate}
              onSeek={handleSeek}
              annotations={annotations}
              voiceNotes={voiceNotes}
              drawAnnotations={drawAnnotations}
              events={events}
              onAnnotationClick={handleAnnotationClick}
              onDrawingCreated={handleDrawingCreated}
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
                  sessionId={session.id}
                  currentTime={currentTime}
                  annotations={annotations}
                  onAnnotationCreated={handleAnnotationCreated}
                  onAnnotationClick={handleAnnotationClick}
                  onAnnotationDelete={handleAnnotationDelete}
                />
              </TabsContent>

              <TabsContent value="voice" className="flex-1 mt-0 min-h-0">
                <VoiceNotePanel
                  sessionId={session.id}
                  currentTime={currentTime}
                  voiceNotes={voiceNotes}
                  onVoiceNoteCreated={handleVoiceNoteCreated}
                  onVoiceNoteClick={handleVoiceNoteClick}
                />
              </TabsContent>

              <TabsContent value="social" className="flex-1 mt-0 min-h-0">
                <SocialCommentsPanel
                  sessionId={session.id}
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
