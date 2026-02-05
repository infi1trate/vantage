import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useBlocker, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProcessing } from "@/contexts/ProcessingContext";
import { useChallengeSession } from "@/contexts/ChallengeSessionContext";
import { Header } from "@/components/layout/Header";
import { updateCaptureSession, getCaptureSession, CaptureSession, createVideoAsset, createPlaceholderVideoAsset } from "@/lib/captures";
import { supabase } from "@/integrations/supabase/client";
import { useCaptureManager } from "@/hooks/useCaptureManager";
import { usePreflightChecks } from "@/hooks/usePreflightChecks";
import { useCaptureHealth } from "@/hooks/useCaptureHealth";
import { usePictureInPicture } from "@/hooks/usePictureInPicture";
import { CapturePreview } from "@/components/capture/CapturePreview";
import { CaptureControls } from "@/components/capture/CaptureControls";
import { CaptureWizard } from "@/components/capture/CaptureWizard";
import { CaptureErrorDisplay } from "@/components/capture/CaptureError";
import { CaptureDiagnostics } from "@/components/capture/CaptureDiagnostics";
import { StorageRecoveryScreen } from "@/components/capture/StorageRecoveryScreen";
import { PerformanceModeBadge } from "@/components/capture/PerformanceModeBadge";
import { CountdownOverlay } from "@/components/capture/CountdownOverlay";
import { FloatingFacecamBubble } from "@/components/capture/FloatingFacecamBubble";
import { saveLocalSession, LocalSession, type SaveSessionResult, formatBytes } from "@/lib/localSessionStorage";
import { runCapturePreflightGate } from "@/lib/capturePreflightGate";
import { markCaptureStop, setCameraPreviewActive, recordFrameTime } from "@/lib/processingTelemetry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Pause, Bug, Eye, Chrome, ExternalLink } from "lucide-react";
import { toast } from "sonner";
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

// Only show debug panel in development mode
const IS_DEV = import.meta.env.DEV;

// Storage failure state for recovery screen
interface StorageFailureState {
  blob: Blob;
  duration: number;
  title: string;
  mimeType: string;
  fileExt: "mp4" | "webm";
  error: NonNullable<SaveSessionResult["error"]>;
  thumbnailBlob: Blob | null;
}

export default function CapturePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { queueProcessing, setCapturing, requestNotifications } = useProcessing();
  const { challengeContext, markSessionCompleted } = useChallengeSession();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  
  // Countdown overlay state
  const [showCountdown, setShowCountdown] = useState(false);
  
  // Preview-only mode: browser can preview but not record
  const [isPreviewOnly, setIsPreviewOnly] = useState(() => {
    return searchParams.get("mode") === "preview";
  });
  
  // Storage failure state for recovery screen
  const [storageFailure, setStorageFailure] = useState<StorageFailureState | null>(null);
  // Check recording capability on mount
  const [recordingDisabledReason, setRecordingDisabledReason] = useState<string | null>(null);
  
  useEffect(() => {
    const preflightResult = runCapturePreflightGate();
    if (!preflightResult.supported) {
      if (preflightResult.canPreview) {
        setIsPreviewOnly(true);
        // Find the main issue to display
        const mainIssue = preflightResult.issues.find(i => i.severity === "critical");
        setRecordingDisabledReason(mainIssue?.title || "Recording not supported");
      }
    }
  }, []);
  
  const capture = useCaptureManager();
  
  // PiP management for facecam
  const pip = usePictureInPicture();
  
  // Attach/detach facecam stream to PiP when it changes
  useEffect(() => {
    pip.attachStream(capture.facecamStream);
  }, [capture.facecamStream, pip.attachStream]);
  
  // Capture health monitoring for performance mode
  const captureHealth = useCaptureHealth(false, true);
  
  // Preflight checks - validate streams before allowing recording
  const preflight = usePreflightChecks({
    screenStream: capture.screenStream,
    microphoneStream: capture.microphoneStream,
    facecamStream: capture.facecamStream,
    webcamEnabled: capture.captureConfig.hasCam,
  });
  const isRecordingOrFinalizing = 
    capture.captureState === "recording" || 
    capture.captureState === "paused" || 
    capture.captureState === "finalizing";
  
  // Start/stop health monitoring based on recording state
  useEffect(() => {
    if (isRecordingOrFinalizing && !captureHealth.isMonitoring) {
      captureHealth.startMonitoring();
    } else if (!isRecordingOrFinalizing && captureHealth.isMonitoring) {
      captureHealth.stopMonitoring();
    }
  }, [isRecordingOrFinalizing, captureHealth]);
  
  // Check if camera preview is active (for CPU-aware processing pause)
  const isCameraPreviewActiveNow = 
    capture.captureState === "preview_ready" || 
    capture.captureState === "recording" || 
    capture.captureState === "paused";

  // Notify ProcessingManager of capture state to pause heavy processing during recording
  useEffect(() => {
    setCapturing(isRecordingOrFinalizing);
  }, [isRecordingOrFinalizing, setCapturing]);
  
  // Track camera preview state for CPU-aware processing pause
  useEffect(() => {
    setCameraPreviewActive(isCameraPreviewActiveNow);
    return () => setCameraPreviewActive(false);
  }, [isCameraPreviewActiveNow]);

  // Block navigation when recording
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isRecordingOrFinalizing && currentLocation.pathname !== nextLocation.pathname
  );

  // Show dialog when blocker is triggered
  useEffect(() => {
    if (blocker.state === "blocked") {
      setShowLeaveDialog(true);
    }
  }, [blocker.state]);

  // Handle beforeunload (browser close/refresh)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecordingOrFinalizing) {
        e.preventDefault();
        e.returnValue = "You have an active recording. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRecordingOrFinalizing]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space to toggle pause/resume during recording
      if (e.code === "Space" && (capture.captureState === "recording" || capture.captureState === "paused")) {
        e.preventDefault();
        capture.togglePause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [capture.captureState, capture.togglePause]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (sessionId && user) {
      loadSession();
    }
  }, [sessionId, user]);

  const loadSession = async () => {
    try {
      const data = await getCaptureSession(sessionId!);
      setSession(data);
      
      // If session is already processed, redirect to review
      if (data.status !== "recording") {
        navigate(`/session/${sessionId}`);
      }
    } catch (error) {
      console.error("Error loading session:", error);
      toast.error("Session not found");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  // Setup complete → acquire sources (preview_ready)
  const handleSetupComplete = async (config: { enableFacecam: boolean; enableSystemAudio: boolean }) => {
    await capture.selectSources(config);
  };

  // User clicks "Start Recording" - show countdown overlay
  const handleStartRecording = useCallback(() => {
    // Clear any previous inline error before attempting
    if (capture.error) {
      capture.retryFromError(); // This clears the error
    }
    
    // Show countdown overlay
    setShowCountdown(true);
  }, [capture.error, capture.retryFromError]);

  // Countdown completed - actually start recording
  const handleCountdownComplete = useCallback(async () => {
    console.log("[record] handleCountdownComplete called");
    
    try {
      const success = await capture.startRecording();
      
      if (!success) {
        // Error is already set in capture.error for inline display
        console.error("[record] startRecording returned false - showing inline error");
        toast.error("Recording failed to start", {
          description: "Please check your browser permissions and try again.",
        });
        setShowCountdown(false);
        return;
      }
      
      console.log("[record] startRecording success - closing overlay");
      setShowCountdown(false);
      
      // Request notification permission after user interaction (non-blocking)
      // This is a good moment because user has explicitly started recording
      requestNotifications().catch(() => {});
    } catch (error) {
      console.error("[record] startRecording threw error:", error);
      toast.error("Recording failed to start", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
      setShowCountdown(false);
    }
  }, [capture.startRecording, requestNotifications]);

  // Countdown cancelled
  const handleCountdownCancel = useCallback(() => {
    setShowCountdown(false);
  }, []);

  // Dismiss inline recording error (stays in preview_ready state)
  const handleDismissInlineError = () => {
    capture.retryFromError(); // This clears the error without changing state
  };

  // User clicks "End Capture" - stops recording and queues background processing
  const handleEndCapture = async () => {
    if (!session) return;
    
    // Only proceed if we're recording or paused
    if (capture.captureState !== "recording" && capture.captureState !== "paused") {
      console.warn("handleEndCapture called but not in recording/paused state");
      return;
    }

    // Mark capture stop for telemetry (measures Stop -> Library time)
    markCaptureStop();

    try {
      // IMMEDIATELY set session status to "processing" so assetReadiness knows recording happened
      // This is the contract: "processing" means video will become ready
      await updateCaptureSession(session.id, { 
        status: "processing",
        duration_seconds: capture.duration,
      });

      // Capture thumbnail BEFORE stopping (while canvas is still active)
      const [thumbnailDataUrl, thumbnailBlob] = await Promise.all([
        Promise.resolve(capture.captureThumbnail()),
        capture.captureThumbnailBlob(),
      ]);
      
      if (import.meta.env.DEV) {
        console.log("[Capture] Thumbnail captured:", thumbnailDataUrl ? "dataURL yes" : "dataURL no", thumbnailBlob ? `blob ${thumbnailBlob.size} bytes` : "blob no");
      }

      // Stop recording and get data
      const recordedData = await capture.stopRecording();
      
      if (!recordedData) {
        // Update session to failed - recording never produced data
        await updateCaptureSession(session.id, { 
          status: "failed",
          metadata: { last_error: "Recording produced no data", gameplay_video_status: "missing" },
        });
        // Show toast with link to session media panel
        toast.error("Gameplay recording failed to save.", {
          description: "No data was captured. Try recording again.",
          action: {
            label: "View details",
            onClick: () => navigate(`/session/${session.id}?panel=media`),
          },
          duration: 8000,
        });
        return;
      }

      if (!recordedData.compositeBlob) {
        // Update session to failed - composite blob missing
        await updateCaptureSession(session.id, { 
          status: "failed",
          metadata: { last_error: "No composite recording data", gameplay_video_status: "failed" },
        });
        // Show toast with link to session media panel
        toast.error("Gameplay recording failed to save.", {
          description: "Recording data was incomplete.",
          action: {
            label: "View details",
            onClick: () => navigate(`/session/${session.id}?panel=media`),
          },
          duration: 8000,
        });
        return;
      }

      // Create placeholder video asset immediately - establishes durable reference
      // Status: "processing" until upload completes
      let placeholderAssetId: string | undefined;
      if (user?.id) {
        try {
          const placeholderAsset = await createPlaceholderVideoAsset({
            sessionId: session.id,
            userId: user.id,
            durationMs: recordedData.duration * 1000,
            fileSize: recordedData.compositeBlob.size,
            mimeType: recordedData.compositeMimeType || recordedData.compositeBlob.type || "video/webm",
          });
          placeholderAssetId = placeholderAsset.id;
          
          if (import.meta.env.DEV) {
            console.log("[Capture] Created placeholder video asset:", placeholderAssetId);
          }
        } catch (assetError) {
          // Non-fatal - processing manager will create asset on upload
          console.warn("[Capture] Failed to create placeholder asset:", assetError);
        }
      }

      // Queue background processing - returns immediately (non-blocking)
      // Blob storage and processing happen asynchronously after navigation
      queueProcessing({
        sessionId: session.id,
        sessionTitle: session.title,
        blob: recordedData.compositeBlob,
        thumbnailBlob,
        thumbnailDataUrl,
        mimeType: recordedData.compositeMimeType || recordedData.compositeBlob.type || "video/webm",
        fileExt: recordedData.fileExt || "webm",
        duration: recordedData.duration,
        hasCam: capture.captureConfig.hasCam,
        hasMic: capture.captureConfig.hasMic,
        hasSystemAudio: capture.captureConfig.hasSystemAudio,
        hasGameAudio: recordedData.hasGameAudio,
        audioMixSettings: recordedData.audioMixSettings,
        userId: user?.id,
        gameName: session.game_name,
      });

      toast.success("Recording complete! Processing in background...");
      
      // If recording was started from a challenge, mark session as completed for prompt
      if (challengeContext) {
        markSessionCompleted(session.id);
      }
      
      // Navigate to library immediately - don't wait for blob storage or processing
      navigate("/library", { state: { highlightSession: session.id } });
    } catch (error: any) {
      console.error("Error ending capture:", error);
      
      // Update session to failed with error details
      try {
        await updateCaptureSession(session.id, { 
          status: "failed",
          metadata: { 
            last_error: error.message || "Unknown error during finalization",
            gameplay_video_status: "failed",
          },
        });
      } catch (updateError) {
        console.error("Failed to update session status:", updateError);
      }
      
      // Show toast with link to session media panel
      toast.error("Gameplay recording failed to save.", {
        description: error.message || "An error occurred while saving the recording.",
        action: {
          label: "View details",
          onClick: () => navigate(`/session/${session.id}?panel=media`),
        },
        duration: 8000,
      });
    }
  };

  // Stop preview without recording (from preview_ready state)
  const handleStopPreview = () => {
    capture.stopPreview();
  };

  // Cancel everything and go back
  const handleCancel = async () => {
    capture.cancelCapture();
    
    if (session) {
      try {
        await updateCaptureSession(session.id, { status: "failed" });
      } catch (error) {
        console.error("Error updating session:", error);
      }
    }
    
    navigate("/");
  };

  // Retry from error state
  const handleRetry = () => {
    capture.retryFromError();
  };

  // Retry saving to storage (for storage recovery screen)
  const handleStorageRetry = async (): Promise<boolean> => {
    if (!storageFailure || !session) return false;
    
    const localSession: LocalSession = {
      id: session.id,
      title: session.title,
      gameName: session.game_name,
      createdAt: new Date().toISOString(),
      duration: storageFailure.duration,
      hasCam: capture.captureConfig.hasCam,
      hasMic: capture.captureConfig.hasMic,
      hasSystemAudio: capture.captureConfig.hasSystemAudio,
      visibility: "private",
      thumbnailDataUrl: null,
      blobSize: storageFailure.blob.size,
      mimeType: storageFailure.mimeType,
      fileExt: storageFailure.fileExt,
      status: "stored_local",
      totalBytes: storageFailure.blob.size,
    };
    
    const result = await saveLocalSession(localSession, storageFailure.blob, storageFailure.thumbnailBlob);
    
    if (result.success) {
      toast.success("Recording saved successfully!");
      return true;
    } else {
      toast.error("Storage still full. Please download the recording.");
      return false;
    }
  };

  // Continue from storage recovery (navigate to library)
  const handleStorageContinue = () => {
    setStorageFailure(null);
    navigate("/library", { state: { highlightSession: session?.id } });
  };

  // Handle leave confirmation
  const handleConfirmLeave = () => {
    capture.cancelCapture();
    setShowLeaveDialog(false);
    if (blocker.state === "blocked") {
      blocker.proceed();
    }
  };

  const handleCancelLeave = () => {
    setShowLeaveDialog(false);
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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

  // ERROR STATE
  if (capture.captureState === "error" && capture.error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="max-w-2xl mx-auto">
            <CaptureErrorDisplay 
              error={capture.error} 
              onRetry={handleRetry}
              onCancel={handleCancel}
            />
          </div>
        </main>
      </div>
    );
  }

  // IDLE or SELECTING_SOURCES STATE - show setup
  if (capture.captureState === "idle" || capture.captureState === "selecting_sources") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="max-w-2xl mx-auto">
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="mb-6 uppercase tracking-wider text-xs"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            
            <CaptureWizard
              session={session}
              onStart={handleSetupComplete}
              isLoading={capture.captureState === "selecting_sources"}
              previewOnly={isPreviewOnly}
            />
          </div>
        </main>
      </div>
    );
  }

  // STORAGE RECOVERY STATE - show recovery screen when local save failed
  if (storageFailure) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <StorageRecoveryScreen
          blob={storageFailure.blob}
          duration={storageFailure.duration}
          title={storageFailure.title}
          mimeType={storageFailure.mimeType}
          fileExt={storageFailure.fileExt}
          error={storageFailure.error}
          onRetry={handleStorageRetry}
          onContinue={handleStorageContinue}
        />
      </div>
    );
  }

  // SAVED STATE - should redirect, but show loading
  if (capture.captureState === "saved") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecting to library...</p>
        </div>
      </div>
    );
  }

  // PREVIEW_READY, RECORDING, PAUSED, or FINALIZING STATE
  const isRecording = capture.captureState === "recording";
  const isPaused = capture.captureState === "paused";
  const isFinalizing = capture.captureState === "finalizing";
  const isPreviewReady = capture.captureState === "preview_ready";
  const isStarting = capture.captureState === "starting";
  const isActiveRecording = isRecording || isPaused;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Session Info & Status */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              {isRecording && (
                <>
                  <span className="w-3 h-3 rounded-full bg-destructive recording-pulse" />
                  <Badge variant="outline" className="border-destructive/30 text-destructive uppercase tracking-wider text-xs">
                    REC
                  </Badge>
                  <span className="font-display text-3xl">{formatTime(capture.duration)}</span>
                  {/* Live recording size */}
                  <span className="text-xs text-muted-foreground font-mono ml-2">
                    {formatBytes(capture.debugInfo.totalBytes)}
                  </span>
                  {/* Performance Mode Badge - shows during recording */}
                  <PerformanceModeBadge
                    mode={captureHealth.mode}
                    health={captureHealth.health}
                    isRecording={true}
                    size="sm"
                  />
                </>
              )}
              {isPaused && (
                <>
                  <Pause className="h-4 w-4 text-warning" />
                  <Badge variant="outline" className="border-warning/30 text-warning uppercase tracking-wider text-xs">
                    PAUSED
                  </Badge>
                  <span className="font-display text-3xl text-muted-foreground">{formatTime(capture.duration)}</span>
                  <span className="text-xs text-muted-foreground font-mono ml-2">
                    {formatBytes(capture.debugInfo.totalBytes)}
                  </span>
                  {/* Performance Mode Badge - shows when paused too */}
                  <PerformanceModeBadge
                    mode={captureHealth.mode}
                    health={captureHealth.health}
                    isRecording={false}
                    size="sm"
                  />
                </>
              )}
              {isPreviewReady && (
                <>
                  {isPreviewOnly ? (
                    <>
                      <Eye className="h-4 w-4 text-warning" />
                      <Badge variant="outline" className="border-warning/30 text-warning uppercase tracking-wider text-xs">
                        PREVIEW MODE
                      </Badge>
                    </>
                  ) : (
                    <>
                      <span className="w-3 h-3 rounded-full bg-vantage-success" />
                      <Badge variant="outline" className="border-vantage-success/30 text-vantage-success uppercase tracking-wider text-xs">
                        READY
                      </Badge>
                    </>
                  )}
                  <span className="font-mono text-lg text-muted-foreground">0:00</span>
                </>
              )}
              {isStarting && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-warning" />
                  <Badge variant="outline" className="border-warning/30 text-warning uppercase tracking-wider text-xs">
                    STARTING
                  </Badge>
                  <span className="font-mono text-lg text-muted-foreground">0:00</span>
                </>
              )}
              {isFinalizing && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <Badge variant="outline" className="border-primary/30 text-primary uppercase tracking-wider text-xs">
                    FINALIZING
                  </Badge>
                </>
              )}
            </div>
            <h1 className="font-display text-2xl tracking-wide">{session.title.toUpperCase()}</h1>
            {session.game_name && (
              <p className="text-sm text-primary uppercase tracking-wider">{session.game_name}</p>
            )}
          </div>

          {/* Preview */}
          <CapturePreview
            screenStream={capture.screenStream}
            facecamStream={capture.facecamStream}
            microphoneStream={capture.microphoneStream}
            isRecording={isRecording}
            isPaused={isPaused}
            microphoneLevel={capture.microphoneLevel}
          />

          {/* Controls with Preflight Checklist */}
          <CaptureControls
            captureState={capture.captureState}
            onStartRecording={handleStartRecording}
            onPauseRecording={capture.pauseRecording}
            onResumeRecording={capture.resumeRecording}
            onStopRecording={handleEndCapture}
            onStopPreview={handleStopPreview}
            onCancel={handleCancel}
            preflightChecks={preflight.checks}
            preflightPassed={preflight.allPassed}
            preflightRunning={preflight.isRunning}
            previewOnly={isPreviewOnly}
            recordingDisabledReason={recordingDisabledReason}
            inlineError={capture.captureState === "preview_ready" ? capture.error : null}
            onDismissError={handleDismissInlineError}
            onRetryRecording={handleStartRecording}
            onRetryLowQuality={async () => {
              handleDismissInlineError();
              await capture.startRecordingLowQuality();
            }}
            onContinuePreviewMode={() => {
              handleDismissInlineError();
              setIsPreviewOnly(true);
              setRecordingDisabledReason("Recording failed - preview mode active");
            }}
          />

          {/* Countdown Overlay */}
          <CountdownOverlay
            isOpen={showCountdown}
            onComplete={handleCountdownComplete}
            onCancel={handleCountdownCancel}
            startFrom={5}
          />

          {/* Floating Facecam Bubble - fixed position during active recording */}
          <FloatingFacecamBubble
            stream={capture.facecamStream}
            isVisible={isActiveRecording && capture.captureConfig.hasCam}
            isPiPActive={pip.isPiPActive}
            isPiPSupported={pip.isPiPSupported}
            onRequestPiP={pip.requestPiP}
            onExitPiP={pip.exitPiP}
          />

          {IS_DEV && (
            <div className="mt-8">
              {!showDebug ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDebug(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Bug className="h-4 w-4 mr-2" />
                  Show Debug Panel
                </Button>
              ) : (
                <CaptureDiagnostics
                  captureState={capture.captureState}
                  screenStream={capture.screenStream}
                  microphoneStream={capture.microphoneStream}
                  facecamStream={capture.facecamStream}
                  duration={capture.duration}
                  error={capture.error}
                  recorderState={capture.debugInfo.recorderState || undefined}
                  chunksCount={capture.debugInfo.chunksCount}
                  totalBytes={capture.debugInfo.totalBytes}
                  mimeTypeInfo={capture.debugInfo.mimeTypeInfo || undefined}
                  recorderStateLog={capture.debugInfo.recorderStateLog}
                  lastRecorderError={capture.debugInfo.lastRecorderError}
                  recordedSource={
                    capture.captureState === "recording" || capture.captureState === "paused"
                      ? "composed"
                      : undefined
                  }
                />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Leave confirmation dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase tracking-wide">
              Recording in Progress
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have an active recording. If you leave now, your recording will be lost. Are you sure you want to leave?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelLeave}>
              Continue Recording
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLeave} className="bg-destructive hover:bg-destructive/90">
              Discard & Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
