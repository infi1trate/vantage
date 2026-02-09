import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProcessing } from "@/contexts/ProcessingContext";
import { useChallengeSessionOptional } from "@/contexts/ChallengeSessionContext";
import { Header } from "@/components/layout/Header";
import { CinematicPlayer, VideoMetaInfo, VideoDecodeError, SelectionState } from "@/components/player/CinematicPlayer";
import { NotStoredLocallyCard } from "@/components/player/NotStoredLocallyCard";
import { ProcessingBanner } from "@/components/player/ProcessingBanner";
import { ProcessingPlaceholder } from "@/components/player/ProcessingPlaceholder";
import { CloudProcessingPlaceholder } from "@/components/player/CloudProcessingPlaceholder";
import { AnnotationsPanel, PanelMode } from "@/components/player/AnnotationsPanel";
import { AnnotationDrawer, DrawerAnnotation } from "@/components/player/AnnotationDrawer";
import { FramePin } from "@/components/player/FramePins";
import { AnnotationSuggestion } from "@/components/player/SuggestionMarkers";
import { ShareSessionDialog } from "@/components/sharing/ShareSessionDialog";
import { DeleteSessionDialog } from "@/components/privacy/DeleteSessionDialog";
import { KeyboardShortcutsOverlay, useKeyboardShortcuts } from "@/components/player/KeyboardShortcutsOverlay";
import { SessionMediaPanel } from "@/components/player/SessionMediaPanel";
import { TimelineEmptyState } from "@/components/player/OnboardingHint";
import { ExportCTAs } from "@/components/export/ExportCTAs";
import { ExportOptions } from "@/components/export/ExportDrawer";
import { ChallengeSubmitBanner } from "@/components/challenges/ChallengeSubmitBanner";
import { SubmissionModal } from "@/components/challenges/SubmissionModal";
import { SuggestedChallenges } from "@/components/challenges/SuggestedChallenges";
import { useQuery } from "@tanstack/react-query";
import { fetchChallenge } from "@/lib/challenges";
import {
  getCaptureSession,
  getAnnotations,
  getVoiceNotes,
  getVideoAssetsWithFreshUrls,
  getAudioTracks,
  getFacecamTracks,
  deleteAnnotation,
  createAnnotation,
  permanentlyDeleteSession,
  getTimelineEvents,
  CaptureSession,
  Annotation,
  VoiceNote,
  VideoAsset,
  AudioTrack,
  FacecamTrack,
} from "@/lib/captures";
import {
  getLocalSession,
  getLocalSessionBlob,
  LocalSession,
} from "@/lib/localSessionStorage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSafeBack } from "@/hooks/useSafeBack";
import { 
  Loader2, 
  ArrowLeft, 
  Gamepad2, 
  Trash2,
  Maximize2,
  Minimize2,
  Keyboard,
  Eye,
  Mic,
  MicOff,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  canCreateReel as checkReelEligibility, 
  extractEligibilityInput,
  type ReelEligibilityResult,
} from "@/lib/reelEligibility";
import { useSessionMediaStatus, useInvalidateSessions } from "@/hooks/useSessionQueries";

// Cloud session processing states that indicate ongoing work
const CLOUD_PROCESSING_STATUSES = ["recording", "processing", "uploading"];
// Fast polling for upload status (2 seconds for quick feedback)
const UPLOAD_POLL_INTERVAL = 2000;
// Standard polling for other processing states
const STANDARD_POLL_INTERVAL = 5000;
// Max polling duration before giving up (30 seconds for uploads)
const MAX_UPLOAD_POLL_DURATION = 30000;

export default function SessionReview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { goBack } = useSafeBack("/library");
  
  // Check if we should auto-open the media panel (from reel editor "check session video" CTA)
  const shouldOpenMediaPanel = searchParams.get("panel") === "media";
  
  // Ref for scrolling to media panel
  const mediaPanelRef = useRef<HTMLDivElement>(null);
  
  // Processing context for detecting active jobs
  const { jobs, retryJob } = useProcessing();

  // Session data
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [localSession, setLocalSession] = useState<LocalSession | null>(null);
  const [isLocalSession, setIsLocalSession] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [localBlob, setLocalBlob] = useState<Blob | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoMetaInfo | null>(null);

  const [videoAssets, setVideoAssets] = useState<VideoAsset[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [facecamTracks, setFacecamTracks] = useState<FacecamTrack[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  
  // Timeline selection state
  const [selection, setSelection] = useState<SelectionState>({ type: null });
  
  // Annotations panel mode
  const [panelMode, setPanelMode] = useState<PanelMode>("list");
  const [pendingTime, setPendingTime] = useState<number | undefined>();
  const [pendingEndTime, setPendingEndTime] = useState<number | undefined>();
  
  // Drawer state for editing/creating annotations
  const [drawerAnnotation, setDrawerAnnotation] = useState<DrawerAnnotation | null>(null);
  
  // Frame pins (with position data)
  const [framePins, setFramePins] = useState<FramePin[]>([]);
  const [pendingPinPosition, setPendingPinPosition] = useState<{ x: number; y: number } | null>(null);
  
  // AI Suggestions state
  const [suggestions, setSuggestions] = useState<AnnotationSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  
  // Dropbox sync status for backup indicator
  const [dropboxSyncStatus, setDropboxSyncStatus] = useState<"pending" | "synced" | "failed" | null>(null);
  
  // Keyboard shortcuts overlay
  const { showShortcuts, setShowShortcuts } = useKeyboardShortcuts();
  
  // React Query hook for session media status - ensures consistency with CreateReelModal
  // Must be called unconditionally (before any early returns)
  const { data: sessionMediaStatus } = useSessionMediaStatus(sessionId);
  
  // Challenge submission context - check if this session was recorded from a challenge
  const challengeSession = useChallengeSessionOptional();
  const [challengeBannerDismissed, setChallengeBannerDismissed] = useState(false);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  
  // Fetch challenge data if we have context
  const { data: linkedChallenge } = useQuery({
    queryKey: ["challenge", challengeSession?.challengeContext?.id],
    queryFn: () => fetchChallenge(challengeSession!.challengeContext!.id),
    enabled: !!challengeSession?.challengeContext?.id && !challengeBannerDismissed,
    staleTime: 5 * 60 * 1000,
  });
  
  // Check if we should show the challenge banner
  const showChallengeBanner = !!challengeSession?.challengeContext && 
    !challengeBannerDismissed && 
    !loading &&
    !!linkedChallenge;
  
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

  // Keyboard shortcut for focus mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Escape" && focusMode) {
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode]);

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

  // Poll for cloud session status when processing (faster for uploads)
  useEffect(() => {
    if (!session || !sessionId) return;
    
    // Cast to string to handle statuses not in the type definition (e.g., "uploading" from desktop)
    const currentStatus = String(session.status || "");
    const isCloudProcessing = CLOUD_PROCESSING_STATUSES.includes(currentStatus);
    if (!isCloudProcessing) return;

    const isUploading = currentStatus === "uploading";
    const pollInterval = isUploading ? UPLOAD_POLL_INTERVAL : STANDARD_POLL_INTERVAL;
    const startTime = Date.now();

    console.log(`[SessionReview] Cloud session is ${currentStatus}, starting poll every ${pollInterval}ms...`);
    
    const intervalId = setInterval(async () => {
      // Check if we've exceeded max poll duration for uploads
      if (isUploading && (Date.now() - startTime) > MAX_UPLOAD_POLL_DURATION) {
        console.log("[SessionReview] Upload poll timeout reached, stopping poll");
        clearInterval(intervalId);
        return;
      }

      try {
        const { data: updatedSession } = await supabase
          .from("capture_sessions")
          .select("status")
          .eq("id", sessionId)
          .single();
        
        const newStatus = String(updatedSession?.status || "");
        if (updatedSession && !CLOUD_PROCESSING_STATUSES.includes(newStatus)) {
          console.log("[SessionReview] Cloud session ready, reloading data...");
          clearInterval(intervalId);
          loadSessionData();
        }
      } catch (error) {
        console.warn("[SessionReview] Poll error:", error);
      }
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [session?.status, sessionId]);

  // Scroll to media panel when opened from URL param
  useEffect(() => {
    if (shouldOpenMediaPanel && mediaPanelRef.current && !loading) {
      // Small delay to ensure panel is rendered
      const timeout = setTimeout(() => {
        mediaPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [shouldOpenMediaPanel, loading]);

  // Callback to navigate to Session Media panel (for Create Reel error CTA)
  const handleViewSessionMedia = useCallback(() => {
    mediaPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const loadSessionData = async () => {
    if (!sessionId) return;

    try {
      const localData = await getLocalSession(sessionId);
      
      if (localData) {
        setIsLocalSession(true);
        setLocalSession(localData);
        
        // Check if blob was actually stored
        if (localData.status === "not_stored_locally") {
          // Session exists but blob wasn't stored - set metadata but no video URL
          if (import.meta.env.DEV) {
            console.log("[SessionReview] Session not stored locally, no blob available");
          }
          setVideoMeta({
            blobType: null,
            blobSize: localData.blobSize || 0,
            storedMimeType: localData.mimeType || null,
            videoDuration: localData.duration || null,
            videoWidth: null,
            videoHeight: null,
          });
          setLoading(false);
          return;
        }
        
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
        } else {
          // Blob was supposed to be stored but couldn't be retrieved
          console.warn("[SessionReview] Blob not found for stored session");
          setVideoMeta({
            blobType: null,
            blobSize: localData.blobSize || 0,
            storedMimeType: localData.mimeType || null,
            videoDuration: localData.duration || null,
            videoWidth: null,
            videoHeight: null,
          });
        }
        
        setLoading(false);
        return;
      }

      const [sessionData, videoAssetsData, audioTracksData, facecamTracksData, annotationsData, voiceNotesData, dropboxSyncData] = await Promise.all([
        getCaptureSession(sessionId!),
        getVideoAssetsWithFreshUrls(sessionId!).catch(() => []),
        getAudioTracks(sessionId!).catch(() => []),
        getFacecamTracks(sessionId!).catch(() => []),
        getAnnotations(sessionId!),
        getVoiceNotes(sessionId!),
        // Fetch Dropbox sync status with file verification
        supabase
          .from("dropbox_sync_status")
          .select("sync_status, dropbox_file_id, dropbox_path")
          .eq("session_id", sessionId!)
          .maybeSingle()
          .then(({ data }) => data),
      ]);

      setSession(sessionData);
      setVideoAssets(videoAssetsData);
      setAudioTracks(audioTracksData);
      setFacecamTracks(facecamTracksData);
      setAnnotations(annotationsData);
      setVoiceNotes(voiceNotesData);
      
      // Map Dropbox sync status - only "synced" if file was actually uploaded
      if (dropboxSyncData) {
        const hasVerifiedUpload = !!(dropboxSyncData.dropbox_file_id || dropboxSyncData.dropbox_path);
        
        if (dropboxSyncData.sync_status === "completed" && hasVerifiedUpload) {
          setDropboxSyncStatus("synced");
        } else if (dropboxSyncData.sync_status === "failed" || 
                   (dropboxSyncData.sync_status === "completed" && !hasVerifiedUpload)) {
          setDropboxSyncStatus("failed");
        } else {
          setDropboxSyncStatus("pending");
        }
      } else {
        setDropboxSyncStatus(null);
      }
    } catch (error) {
      console.error("Error loading session:", error);
      toast.error("Session not found");
      navigate("/library");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeUpdate = useCallback((time: number) => setCurrentTime(time), []);
  const handleSeek = useCallback((time: number) => setCurrentTime(time), []);

  const handleAnnotationCreated = useCallback((annotation: Annotation) => {
    setAnnotations((prev) => [...prev, annotation].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
  }, []);

  const handleAnnotationUpdated = useCallback((annotation: Annotation) => {
    setAnnotations((prev) => 
      prev.map(a => a.id === annotation.id ? annotation : a)
        .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
    );
  }, []);

  const handleMarkerClick = useCallback((time: number) => setCurrentTime(time), []);

  // Open annotation in drawer for editing
  const handleAnnotationClick = useCallback((annotation: Annotation) => {
    setDrawerAnnotation({
      annotation,
      type: annotation.annotation_type,
      timestamp: annotation.timestamp_seconds,
      endTimestamp: annotation.end_timestamp_seconds || undefined,
    });
    setPanelMode("drawer");
  }, []);

  const handleAnnotationDelete = useCallback(async (annotationId: string) => {
    try {
      await deleteAnnotation(annotationId);
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
      // Also remove any associated pins
      setFramePins(prev => prev.filter(p => p.annotationId !== annotationId));
      toast.success("Marker removed");
    } catch (error) {
      toast.error("Failed to delete");
    }
  }, []);

  // Handle instant marker creation from floating bar
  const handleCreateMarker = useCallback(async (
    type: "kill" | "death" | "highlight" | "marker", 
    time: number, 
    endTime?: number
  ) => {
    if (!user) return;
    
    const sessionIdToUse = isLocalSession ? localSession?.id : session?.id;
    if (!sessionIdToUse) return;
    
    try {
      const annotation = await createAnnotation(sessionIdToUse, user.id, time, type);
      setAnnotations((prev) => [...prev, annotation].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
      setSelection({ type: null }); // Clear selection after creating
      toast.success("Marker added", {
        action: {
          label: "Undo",
          onClick: () => handleAnnotationDelete(annotation.id),
        },
      });
    } catch (error) {
      toast.error("Failed to add marker");
    }
  }, [user, isLocalSession, localSession?.id, session?.id, handleAnnotationDelete]);

  // Handle opening note mode from floating bar
  const handleOpenNote = useCallback((time: number, endTime?: number) => {
    setDrawerAnnotation({
      type: "note",
      timestamp: time,
      endTimestamp: endTime,
      framePosition: pendingPinPosition || undefined,
    });
    setPanelMode("drawer");
  }, [pendingPinPosition]);

  // Handle opening voice mode from floating bar
  const handleOpenVoice = useCallback((time: number) => {
    setDrawerAnnotation({
      type: "note",
      timestamp: time,
      framePosition: pendingPinPosition || undefined,
    });
    setPanelMode("drawer");
  }, [pendingPinPosition]);

  // Handle panel mode change
  const handlePanelModeChange = useCallback((mode: PanelMode) => {
    setPanelMode(mode);
    if (mode === "list") {
      setPendingTime(undefined);
      setPendingEndTime(undefined);
      setSelection({ type: null });
      setPendingPinPosition(null);
      setDrawerAnnotation(null);
    }
  }, []);

  // Close drawer and return to list
  const handleDrawerClose = useCallback(() => {
    setDrawerAnnotation(null);
    setPanelMode("list");
    setPendingTime(undefined);
    setPendingEndTime(undefined);
    setPendingPinPosition(null);
    setSelection({ type: null });
  }, []);

  // Generate AI suggestions
  const handleGenerateSuggestions = useCallback(async () => {
    const sessionIdToUse = isLocalSession ? localSession?.id : session?.id;
    if (!sessionIdToUse) return;
    
    setIsLoadingSuggestions(true);
    setCoachError(null);
    try {
      // Fetch timeline events for context
      const events = await getTimelineEvents(sessionIdToUse).catch(() => []);
      
      const { data, error } = await supabase.functions.invoke('suggest-annotations', {
        body: {
          session: {
            session_id: sessionIdToUse,
            title: isLocalSession ? localSession?.title : session?.title || "Untitled",
            game_name: isLocalSession ? localSession?.gameName : session?.game_name,
            duration_seconds: isLocalSession 
              ? localSession?.duration 
              : (session?.duration_seconds || 300),
            existing_annotations: annotations.map(a => ({
              id: a.id,
              timestamp_seconds: a.timestamp_seconds,
              annotation_type: a.annotation_type,
              title: a.title,
            })),
            timeline_events: events.map(e => ({
              id: e.id,
              timestamp_ms: e.timestamp_ms,
              event_type: e.event_type,
              title: e.title,
            })),
          }
        }
      });

      if (error) throw error;
      
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
        toast.success(`Found ${data.suggestions.length} suggestions`);
      }
    } catch (error) {
      console.error("Failed to generate suggestions:", error);
      setCoachError(error instanceof Error ? error.message : "Failed to analyze session");
      toast.error("Failed to generate suggestions");
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [isLocalSession, localSession, session, annotations]);

  // Accept a suggestion - convert to annotation
  const handleSuggestionAccept = useCallback(async (suggestion: AnnotationSuggestion) => {
    if (!user) return;
    
    const sessionIdToUse = isLocalSession ? localSession?.id : session?.id;
    if (!sessionIdToUse) return;
    
    try {
      // Map suggestion type to annotation type
      const typeMap: Record<AnnotationSuggestion["suggestion_type"], Annotation["annotation_type"]> = {
        kill: "kill",
        death: "death",
        fight_cluster: "highlight",
        highlight: "highlight",
      };
      
      const annotation = await createAnnotation(
        sessionIdToUse,
        user.id,
        suggestion.timestamp_seconds,
        typeMap[suggestion.suggestion_type],
        suggestion.title
      );
      
      setAnnotations((prev) => [...prev, annotation].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
      // Remove suggestion after accepting
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      toast.success("Moment added from suggestion");
    } catch (error) {
      toast.error("Failed to create moment");
    }
  }, [user, isLocalSession, localSession?.id, session?.id]);

  // Dismiss a suggestion
  const handleSuggestionDismiss = useCallback((suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    toast.success("Suggestion dismissed");
  }, []);

  // Handle frame click - drop a pin and open annotation drawer
  const handleFrameClick = useCallback((x: number, y: number, time: number, endTime?: number) => {
    // Store position for when annotation is created
    setPendingPinPosition({ x, y });
    setDrawerAnnotation({
      type: "marker",
      timestamp: time,
      endTimestamp: endTime,
      framePosition: { x, y },
    });
    setPanelMode("drawer");
  }, []);

  // Handle pin click - seek to time and open annotation in drawer
  const handlePinClick = useCallback((pin: FramePin) => {
    setCurrentTime(pin.timestamp);
    if (pin.annotationId) {
      // Find the annotation and open it for editing
      const annotation = annotations.find(a => a.id === pin.annotationId);
      if (annotation) {
        setDrawerAnnotation({
          annotation,
          type: annotation.annotation_type,
          timestamp: annotation.timestamp_seconds,
          endTimestamp: annotation.end_timestamp_seconds || undefined,
          framePosition: { x: pin.x, y: pin.y },
        });
        setPanelMode("drawer");
      }
    }
  }, [annotations]);

  // When an annotation is created with a pending pin position, add it to frame pins
  const handleAnnotationCreatedWithPin = useCallback((annotation: Annotation) => {
    handleAnnotationCreated(annotation);
    
    if (pendingPinPosition && ["kill", "death", "highlight", "marker"].includes(annotation.annotation_type)) {
      const newPin: FramePin = {
        id: `pin-${annotation.id}`,
        annotationId: annotation.id,
        type: annotation.annotation_type as FramePin["type"],
        timestamp: annotation.timestamp_seconds,
        endTimestamp: annotation.end_timestamp_seconds || undefined,
        x: pendingPinPosition.x,
        y: pendingPinPosition.y,
      };
      setFramePins(prev => [...prev, newPin]);
      setPendingPinPosition(null);
    }
  }, [handleAnnotationCreated, pendingPinPosition]);

  const handleVideoLoaded = useCallback((duration: number) => {
    setVideoMeta((prev) => prev ? { ...prev, videoDuration: duration } : null);
  }, []);

  const handleVideoError = useCallback((error: VideoDecodeError) => {
    console.error("Video error:", error);
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
      toast.error("Failed to delete");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [session, user, navigate]);

  // Check if this session is currently being processed (must be before early returns)
  const processingJob = useMemo(() => {
    if (!sessionId) return null;
    return jobs.find(j => 
      j.sessionId === sessionId && 
      (j.status === "queued" || j.status === "processing" || j.status === "uploading" || j.status === "failed")
    ) || null;
  }, [jobs, sessionId]);
  
  const isProcessing = processingJob && 
    (processingJob.status === "queued" || processingJob.status === "processing" || processingJob.status === "uploading");
  const isProcessingFailed = processingJob?.status === "failed";
  
  // Handler for retry (must be before early returns)
  const handleRetryProcessing = useCallback(() => {
    if (processingJob) {
      retryJob(processingJob.id);
    }
  }, [processingJob, retryJob]);
  
  // ============ CHALLENGE SUBMISSION HANDLERS ============
  const handleChallengeSubmitNow = useCallback(() => {
    setSubmissionModalOpen(true);
  }, []);
  
  const handleChallengeDismiss = useCallback(() => {
    setChallengeBannerDismissed(true);
    // Clear context so it doesn't show again elsewhere
    challengeSession?.clearChallengeContext();
  }, [challengeSession]);
  
  const handleSubmissionSuccess = useCallback(() => {
    setSubmissionModalOpen(false);
    setChallengeBannerDismissed(true);
    challengeSession?.clearChallengeContext();
  }, [challengeSession]);
  
  // ============ REEL ELIGIBILITY (SINGLE SOURCE OF TRUTH) ============
  // Compute before early returns to satisfy React hooks rules
  // sessionMediaStatus is fetched at the top of the component via React Query
  const reelEligibility: ReelEligibilityResult = useMemo(() => {
    // Loading or no data yet = not eligible
    if (authLoading || loading) {
      return { ok: false, reasonCode: "unknown" as const };
    }
    
    // Find gameplay asset from videoAssets
    const gameplayAsset = videoAssets.find(v => v.asset_type === "gameplay");
    
    // Local sessions with video are always eligible
    const isLocal = isLocalSession && localSession;
    if (isLocal && localVideoUrl) {
      return { ok: true };
    }
    
    // No session data yet = not eligible
    if (!session) {
      return { ok: false, reasonCode: "unknown" as const };
    }
    
    // PREFER React Query data if available (most fresh)
    // This ensures SessionMediaPanel and CreateReelModal see the same state
    if (sessionMediaStatus && !isLocal) {
      const eligibilityInput = {
        screenVideo: {
          present: sessionMediaStatus.hasGameplayReady || !!sessionMediaStatus.gameplayUrl,
          status: sessionMediaStatus.gameplayStatus || "missing",
          url: sessionMediaStatus.gameplayUrl,
        },
        videoUrl: sessionMediaStatus.legacyVideoUrl,
        sessionStatus: sessionMediaStatus.sessionStatus,
        reelSourceStatus: sessionMediaStatus.reelSourceStatus,
      };
      return checkReelEligibility(eligibilityInput);
    }
    
    // Fallback to local state (initial render before query returns)
    const hasGameplayAsset = !!gameplayAsset;
    const gameplayStatus = gameplayAsset?.status as "ready" | "processing" | "uploading" | "failed" | "missing" | null;
    
    const eligibilityInput = {
      screenVideo: {
        present: hasGameplayAsset,
        status: hasGameplayAsset ? (gameplayStatus || "ready") : "missing",
        url: gameplayAsset?.storage_url || null,
      },
      videoUrl: session.video_url,
      sessionStatus: session.status,
      // ReelSource status from metadata (if present)
      reelSourceStatus: extractEligibilityInput({
        video_url: session.video_url,
        status: session.status,
        metadata: session.metadata as Record<string, unknown> | null,
      }).reelSourceStatus,
    };
    
    return checkReelEligibility(eligibilityInput);
  }, [authLoading, loading, videoAssets, isLocalSession, localSession, localVideoUrl, session, sessionMediaStatus]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If we have no session/localSession data but have a processing job, show processing state
  if (!session && !localSession && !processingJob) return null;
  
  // Use processing job data as fallback when session data isn't loaded yet
  const isLocal = isLocalSession && localSession;
  const displayTitle = isLocal 
    ? localSession.title 
    : (session?.title || processingJob?.sessionTitle || "Untitled");
  const displayGame = isLocal ? localSession.gameName : session?.game_name;
  const displayDuration = isLocal 
    ? localSession.duration 
    : (session?.duration_seconds || processingJob?.duration || (videoAssets[0]?.duration_ms ? videoAssets[0].duration_ms / 1000 : 300));
  const displayCreatedAt = isLocal ? localSession.createdAt : session?.created_at;
  const displaySessionId = isLocal ? localSession.id : (session?.id || processingJob?.sessionId);
  
  const gameplayAsset = videoAssets.find(v => v.asset_type === "gameplay");
  // Use fresh URL from video assets only - don't use session.video_url as it may be expired
  const videoUrl = isLocal ? localVideoUrl : gameplayAsset?.storage_url;
  
  // Check if this is a not_stored_locally session
  const isNotStoredLocally = isLocal && localSession?.status === "not_stored_locally";
  
  // Check if cloud session is still processing (from DB status, not local processing job)
  const isCloudProcessing = !isLocal && session && CLOUD_PROCESSING_STATUSES.includes(session.status || "");
  const isCloudFailed = !isLocal && session?.status === "failed";
  
  // Determine if we can show the player
  const canShowPlayer = !isProcessing && !isProcessingFailed && !isNotStoredLocally && !isCloudProcessing && !isCloudFailed && videoUrl;

  // reelEligibility is computed before early returns (see above)

  const cloudVideoMeta: VideoMetaInfo | null = !isLocal && gameplayAsset ? {
    blobType: gameplayAsset.mime_type || null,
    blobSize: gameplayAsset.file_size_bytes || null,
    storedMimeType: gameplayAsset.mime_type || null,
    videoDuration: gameplayAsset.duration_ms ? gameplayAsset.duration_ms / 1000 : null,
    videoWidth: gameplayAsset.width || null,
    videoHeight: gameplayAsset.height || null,
  } : null;

  return (
    <div className={cn(
      "min-h-screen bg-background flex flex-col",
      focusMode && "fixed inset-0 z-50"
    )}>
      {/* Header - hidden in focus mode */}
      {!focusMode && <Header />}

      {/* Session bar */}
      <div className={cn(
        "shrink-0 border-b",
        focusMode 
          ? "border-border/20 bg-background/95 backdrop-blur-sm" 
          : "border-border/30 bg-card/30"
      )}>
        <div className={cn(
          "py-2.5 flex items-center justify-between",
          focusMode ? "px-4" : "container"
        )}>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => focusMode ? setFocusMode(false) : goBack()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold">{displayTitle}</h1>
                {/* Review Mode Badge - subtle indicator this is read-only */}
                {!focusMode && !isProcessing && !isProcessingFailed && (
                  <Badge 
                    variant="outline" 
                    className="text-[10px] h-4 gap-1 text-muted-foreground border-muted-foreground/30 bg-muted/20"
                  >
                    <Eye className="h-2.5 w-2.5" />
                    Review
                  </Badge>
                )}
              </div>
              {!focusMode && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
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
                  {/* Mic track indicator — non-invasive, desktop sessions */}
                  {!isLocal && !isProcessing && !isProcessingFailed && (
                    audioTracks.some(t => t.track_type === "microphone") ? (
                      <span className="flex items-center gap-0.5 text-vantage-success">
                        <Mic className="h-3 w-3" />
                        <span className="text-[10px]">Mic: On</span>
                      </span>
                    ) : session && (session.metadata as any)?.created_from === "desktop" ? (
                      <span className="flex items-center gap-0.5 text-muted-foreground/60">
                        <MicOff className="h-3 w-3" />
                        <span className="text-[10px]">Mic: Not detected</span>
                      </span>
                    ) : null
                  )}
                  {isProcessing && (
                    <Badge variant="outline" className="text-[10px] h-4 bg-primary/10 text-primary border-primary/30">
                      <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                      Processing
                    </Badge>
                  )}
                  {isProcessingFailed && (
                    <Badge variant="outline" className="text-[10px] h-4 bg-destructive/10 text-destructive border-destructive/30">
                      Failed
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Export/Share CTAs - Desktop only in header, disabled when processing */}
            {!isMobile && !focusMode && !isProcessing && !isProcessingFailed && (
              <ExportCTAs
                sessionId={displaySessionId || sessionId || ""}
                sessionTitle={displayTitle}
                sessionDuration={displayDuration}
                videoUrl={videoUrl || undefined}
                videoBlob={isLocal ? localBlob || undefined : undefined}
                hasMicTrack={audioTracks.some(t => t.track_type === "microphone")}
                hasWebcamTrack={facecamTracks.length > 0}
                variant="header"
                dropboxSyncStatus={dropboxSyncStatus}
              />
            )}
            <div className="w-px h-4 bg-border/50 mx-1 hidden lg:block" />
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => setFocusMode(!focusMode)}
            >
              {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowShortcuts(true)}
              aria-label="Show keyboard shortcuts"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
            {!focusMode && (
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
                aria-label="Delete session"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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
      
      {/* Challenge Submission Modal */}
      {linkedChallenge && (
        <SubmissionModal
          open={submissionModalOpen}
          onOpenChange={setSubmissionModalOpen}
          challenge={linkedChallenge}
          selectedSession={session ? {
            id: session.id,
            title: session.title,
            thumbnail_url: session.thumbnail_url,
            video_url: videoUrl || session.video_url,
            duration_seconds: displayDuration,
            annotations: annotations.map(a => ({
              id: a.id,
              annotation_type: a.annotation_type,
              title: a.title,
              content: a.content,
              timestamp_seconds: a.timestamp_seconds,
            })),
          } : null}
          onSuccess={handleSubmissionSuccess}
        />
      )}

      {/* Challenge Submit Banner - shown when recording was started from a challenge */}
      {showChallengeBanner && challengeSession?.challengeContext && (
        <div className="container pt-4">
          <ChallengeSubmitBanner
            challengeId={challengeSession.challengeContext.id}
            challengeTitle={challengeSession.challengeContext.title}
            onSubmitNow={handleChallengeSubmitNow}
            onDismiss={handleChallengeDismiss}
          />
        </div>
      )}

      {/* Suggested Challenges — game-matched discovery module */}
      {!loading && !isLocal && displayGame && (
        <div className="container pt-3">
          <SuggestedChallenges
            gameName={displayGame}
            sessionId={displaySessionId || sessionId || ""}
            sessionTitle={displayTitle}
            sessionVideoUrl={videoUrl}
            sessionThumbnailUrl={session?.thumbnail_url}
            sessionDuration={displayDuration}
            annotations={annotations.map(a => ({
              id: a.id,
              annotation_type: a.annotation_type,
              title: a.title,
              content: a.content,
              timestamp_seconds: a.timestamp_seconds,
            }))}
          />
        </div>
      )}

      {/* Main content - CapCut-style layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Video + Timeline (~70%) */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Processing banner when video is still processing */}
          {processingJob && (isProcessing || isProcessingFailed) && (
            <div className="px-4 pt-4">
              <ProcessingBanner
                job={processingJob}
                onRetry={handleRetryProcessing}
                onBack={goBack}
              />
            </div>
          )}
          
          {/* Session Media Panel - shows when video is missing, from URL param, or in dev mode */}
          {(shouldOpenMediaPanel || !videoUrl || import.meta.env.DEV) && !isProcessing && !isCloudProcessing && (
            <div className="px-4 pt-4">
              <SessionMediaPanel
                ref={mediaPanelRef}
                session={session}
                videoAssets={videoAssets}
                audioTracks={audioTracks}
                facecamTracks={facecamTracks}
                localSession={localSession ? {
                  id: localSession.id,
                  status: localSession.status,
                  mimeType: localSession.mimeType,
                  blobSize: localSession.blobSize,
                  duration: localSession.duration,
                  createdAt: localSession.createdAt,
                  hasBlob: !!localBlob,
                } : null}
                isLocalSession={isLocalSession}
                dropboxSyncStatus={dropboxSyncStatus}
                defaultOpen={shouldOpenMediaPanel || !videoUrl}
                onRetryProcessing={isProcessingFailed ? handleRetryProcessing : undefined}
              />
            </div>
          )}
          
          {/* Video player area */}
          {isProcessing && processingJob ? (
            // Show local processing placeholder
            <div className="flex-1 p-4">
              <ProcessingPlaceholder job={processingJob} />
            </div>
          ) : isProcessingFailed && processingJob ? (
            // Show local failed state placeholder
            <div className="flex-1 p-4">
              <ProcessingPlaceholder job={processingJob} />
            </div>
          ) : isCloudProcessing ? (
            // Show cloud processing placeholder (extension uploads)
            <div className="flex-1 p-4">
              <CloudProcessingPlaceholder
                sessionId={displaySessionId || sessionId || ""}
                sessionTitle={displayTitle}
                status={(session?.status as "processing" | "uploading" | "recording") || "processing"}
              />
            </div>
          ) : isCloudFailed ? (
            // Show cloud failed state
            <div className="flex-1 p-4">
              <CloudProcessingPlaceholder
                sessionId={displaySessionId || sessionId || ""}
                sessionTitle={displayTitle}
                status="failed"
                onRetry={() => toast.info("Please try uploading again from the extension")}
              />
            </div>
          ) : isNotStoredLocally ? (
            <NotStoredLocallyCard
              title={displayTitle}
              duration={displayDuration}
              blobSize={localSession?.blobSize || 0}
              mimeType={localSession?.mimeType || "video/webm"}
              createdAt={displayCreatedAt || new Date().toISOString()}
            />
          ) : (
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
              selection={selection}
              onSelectionChange={setSelection}
              onCreateMarker={handleCreateMarker}
              onOpenNote={handleOpenNote}
              onOpenVoice={handleOpenVoice}
              onFrameClick={handleFrameClick}
              framePins={framePins}
              onPinClick={handlePinClick}
              suggestions={suggestions}
              onSuggestionAccept={handleSuggestionAccept}
              onSuggestionDismiss={handleSuggestionDismiss}
            />
          )}
        </div>

        {/* Right: Annotations / Drawer (~30%) */}
        <div className={cn(
          "shrink-0 border-l border-border/30 bg-card/50",
          focusMode ? "w-80" : "w-[340px]"
        )}>
          {panelMode === "drawer" && drawerAnnotation ? (
            <AnnotationDrawer
              sessionId={displaySessionId || sessionId || ""}
              currentTime={currentTime}
              drawerAnnotation={drawerAnnotation}
              existingVoiceNotes={voiceNotes}
              onClose={handleDrawerClose}
              onAnnotationCreated={pendingPinPosition ? handleAnnotationCreatedWithPin : handleAnnotationCreated}
              onAnnotationUpdated={handleAnnotationUpdated}
              onAnnotationDeleted={(id) => {
                handleAnnotationDelete(id);
                handleDrawerClose();
              }}
              onSeek={handleSeek}
            />
          ) : (
            <AnnotationsPanel
              sessionId={displaySessionId || sessionId || ""}
              currentTime={currentTime}
              annotations={annotations}
              voiceNotes={voiceNotes}
              onAnnotationCreated={pendingPinPosition ? handleAnnotationCreatedWithPin : handleAnnotationCreated}
              onAnnotationClick={handleAnnotationClick}
              onMarkerClick={handleMarkerClick}
              onAnnotationDelete={handleAnnotationDelete}
              mode={panelMode}
              onModeChange={handlePanelModeChange}
              pendingTime={pendingTime}
              pendingEndTime={pendingEndTime}
              suggestions={suggestions}
              onSuggestionAccept={handleSuggestionAccept}
              onSuggestionDismiss={handleSuggestionDismiss}
              onGenerateSuggestions={handleGenerateSuggestions}
              isLoadingSuggestions={isLoadingSuggestions}
              coachError={coachError}
              commentsEnabled={false}
              sessionTitle={displayTitle}
              sessionVideoUrl={videoUrl}
              sessionThumbnailUrl={session?.thumbnail_url}
              sessionDuration={displayDuration}
              sessionGameName={displayGame}
              reelEligibility={reelEligibility}
              onViewSessionMedia={handleViewSessionMedia}
            />
          )}
        </div>
      </div>

      {/* Keyboard shortcuts overlay */}
      <KeyboardShortcutsOverlay 
        open={showShortcuts} 
        onOpenChange={setShowShortcuts} 
      />

      {/* Mobile floating Export/Share CTAs - hidden when processing */}
      {isMobile && !focusMode && !isProcessing && !isProcessingFailed && (
        <ExportCTAs
          sessionId={displaySessionId || sessionId || ""}
          sessionTitle={displayTitle}
          variant="floating"
        />
      )}
    </div>
  );
}
