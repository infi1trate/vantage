import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { FilmRoomPlayer } from "@/components/player/FilmRoomPlayer";
import { AnnotationPanel } from "@/components/player/AnnotationPanel";
import { VoiceNotePanel } from "@/components/player/VoiceNotePanel";
import { AIAnalysisPanel } from "@/components/player/AIAnalysisPanel";
import { FeedbackCardData } from "@/components/player/FeedbackCard";
import { supabase } from "@/integrations/supabase/client";
import {
  getCaptureSession,
  getAnnotations,
  getVoiceNotes,
  getAIAnalysis,
  getTimelineEvents,
  getDrawAnnotations,
  createAIAnalysis,
  deleteAnnotation,
  CaptureSession,
  Annotation,
  VoiceNote,
  AIAnalysis,
  TimelineEvent,
  DrawAnnotation,
} from "@/lib/captures";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Share2, Download, Gamepad2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function SessionReview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<CaptureSession | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [analyses, setAnalyses] = useState<AIAnalysis[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [drawAnnotations, setDrawAnnotations] = useState<DrawAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [activePanel, setActivePanel] = useState<"annotations" | "voice" | "ai">("annotations");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [feedbackCards, setFeedbackCards] = useState<FeedbackCardData[]>([]);
  const [patterns, setPatterns] = useState<{ name: string; description: string; frequency: string; impact: "positive" | "negative" | "neutral" }[]>([]);
  const [recommendations, setRecommendations] = useState<{ text: string; priority: "high" | "medium" | "low"; category: string }[]>([]);

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
      const [sessionData, annotationsData, voiceNotesData, analysesData, eventsData, drawingsData] = await Promise.all([
        getCaptureSession(sessionId!),
        getAnnotations(sessionId!),
        getVoiceNotes(sessionId!),
        getAIAnalysis(sessionId!),
        getTimelineEvents(sessionId!).catch(() => []),
        getDrawAnnotations(sessionId!).catch(() => []),
      ]);

      setSession(sessionData);
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

  const duration = session.duration_seconds || 300; // Default 5 min for demo

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
                  <Badge
                    variant="outline"
                    className={
                      session.status === "ready"
                        ? "border-vantage-success/30 text-vantage-success"
                        : session.status === "processing"
                        ? "border-yellow-500/30 text-yellow-500"
                        : "border-red-500/30 text-red-500"
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
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Video player - 2 columns */}
          <div className="lg:col-span-2 flex flex-col">
            <FilmRoomPlayer
              sessionId={session.id}
              videoUrl={session.video_url}
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
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="annotations">Annotations</TabsTrigger>
                <TabsTrigger value="voice">Voice</TabsTrigger>
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
