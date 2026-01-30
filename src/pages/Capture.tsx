import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useBlocker, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { updateCaptureSession, getCaptureSession, CaptureSession, createVideoAsset } from "@/lib/captures";
import { supabase } from "@/integrations/supabase/client";
import { useCaptureManager } from "@/hooks/useCaptureManager";
import { usePreflightChecks } from "@/hooks/usePreflightChecks";
import { CapturePreview } from "@/components/capture/CapturePreview";
import { CaptureControls } from "@/components/capture/CaptureControls";
import { CaptureWizard } from "@/components/capture/CaptureWizard";
import { CaptureErrorDisplay } from "@/components/capture/CaptureError";
import { CaptureDiagnostics } from "@/components/capture/CaptureDiagnostics";
import { StorageRecoveryScreen } from "@/components/capture/StorageRecoveryScreen";
import { saveLocalSession, LocalSession, type SaveSessionResult, formatBytes } from "@/lib/localSessionStorage";
import { runCapturePreflightGate } from "@/lib/capturePreflightGate";
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
  const navigate = useNavigate();
  
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  
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

  // User clicks "Start Recording" from preview_ready state
  const handleStartRecording = async () => {
    // Clear any previous inline error before attempting
    if (capture.error) {
      capture.retryFromError(); // This clears the error
    }
    
    const success = await capture.startRecording();
    if (!success) {
      // Error is already set in capture.error for inline display
      // Don't show toast - the inline error is more informative
      console.log("[Capture] Start recording failed - showing inline error");
    }
  };

  // Dismiss inline recording error (stays in preview_ready state)
  const handleDismissInlineError = () => {
    capture.retryFromError(); // This clears the error without changing state
  };

  // User clicks "End Capture" - stops recording and saves
  const handleEndCapture = async () => {
    if (!session) return;
    
    // Only proceed if we're recording or paused
    if (capture.captureState !== "recording" && capture.captureState !== "paused") {
      console.warn("handleEndCapture called but not in recording/paused state");
      return;
    }

    try {
      // Capture thumbnail BEFORE stopping (while canvas is still active)
      // Capture both dataURL (for quick render) and blob (for IndexedDB storage)
      const [thumbnailDataUrl, thumbnailBlob] = await Promise.all([
        Promise.resolve(capture.captureThumbnail()),
        capture.captureThumbnailBlob(),
      ]);
      console.log("[Capture] Thumbnail captured:", thumbnailDataUrl ? "dataURL yes" : "dataURL no", thumbnailBlob ? `blob ${thumbnailBlob.size} bytes` : "blob no");

      // Stop recording and get data
      const recordedData = await capture.stopRecording();
      
      if (!recordedData) {
        throw new Error("No recorded data");
      }

      if (!recordedData.compositeBlob) {
        throw new Error("No composite recording data");
      }

      // Save to IndexedDB for local persistence
      const localSession: LocalSession = {
        id: session.id,
        title: session.title,
        gameName: session.game_name,
        createdAt: new Date().toISOString(),
        duration: recordedData.duration,
        hasCam: capture.captureConfig.hasCam,
        hasMic: capture.captureConfig.hasMic,
        hasSystemAudio: capture.captureConfig.hasSystemAudio,
        visibility: "private",
        thumbnailDataUrl, // Keep dataURL for quick fallback render
        blobSize: recordedData.compositeBlob.size,
        mimeType: recordedData.compositeMimeType || recordedData.compositeBlob.type || "video/webm",
        fileExt: recordedData.fileExt,
        codecsLabel: recordedData.codecsLabel,
        browserLabel: recordedData.browserLabel,
        durationMs: recordedData.duration * 1000,
        recordedSource: recordedData.recordedSource,
        status: "stored_local", // Will be updated by saveLocalSession if storage fails
        totalBytes: recordedData.compositeBlob.size,
      };

      // Save session with thumbnail blob - handle storage failures gracefully
      const saveResult = await saveLocalSession(localSession, recordedData.compositeBlob, thumbnailBlob);
      
      if (!saveResult.success) {
        // Storage failed - show recovery screen instead of error
        console.warn("[Capture] Local storage failed:", saveResult.error);
        
        // Store the blob in state for the recovery screen
        setStorageFailure({
          blob: recordedData.compositeBlob,
          duration: recordedData.duration,
          title: session.title,
          mimeType: recordedData.compositeMimeType || "video/webm",
          fileExt: recordedData.fileExt,
          error: saveResult.error!,
          thumbnailBlob,
        });
        return; // Don't navigate - show recovery screen
      }
      
      console.log(`[Capture] Saved to IndexedDB: ${recordedData.compositeBlob.size} bytes, mimeType: ${localSession.mimeType}`);

      // Also upload to Supabase if user is logged in
      // Use the actual mimeType for proper content-type header
      const uploadMimeType = recordedData.compositeMimeType || "video/webm";
      if (user) {
        try {
          const compositePath = `${user.id}/${session.id}/gameplay.webm`;
          
          const { error: uploadError } = await supabase.storage
            .from("video-assets")
            .upload(compositePath, recordedData.compositeBlob, { contentType: uploadMimeType });
          
          if (uploadError) {
            console.warn("[Capture] Supabase upload failed, but local save succeeded:", uploadError);
          } else {
            // Use signed URL for private bucket access (24 hour expiration)
            const { data: urlData, error: urlError } = await supabase.storage
              .from("video-assets")
              .createSignedUrl(compositePath, 86400);
            
            if (urlError) {
              console.warn("[Capture] Failed to create signed URL:", urlError);
              return;
            }
            
            await createVideoAsset({
              session_id: session.id,
              user_id: user.id,
              asset_type: "gameplay",
              storage_url: urlData.signedUrl,
              storage_path: compositePath,
              duration_ms: recordedData.duration * 1000,
              status: "ready",
              processing_progress: 100,
              mime_type: "video/webm",
              file_size_bytes: recordedData.compositeBlob.size,
              width: null,
              height: null,
              framerate: 60,
              bitrate: null,
              codec: null,
              thumbnail_url: thumbnailDataUrl,
              thumbnail_sprite_url: null,
              error_message: null,
            });
            
            // Update session status in Supabase
            await updateCaptureSession(session.id, {
              status: "ready",
              duration_seconds: recordedData.duration,
              thumbnail_url: thumbnailDataUrl,
            });
            
            console.log(`[Capture] Uploaded to Supabase: ${recordedData.compositeBlob.size} bytes`);
          }
        } catch (supabaseError) {
          console.warn("[Capture] Supabase sync failed, but local save succeeded:", supabaseError);
        }
      }

      toast.success("Capture saved successfully!");
      
      // Navigate to library with this session highlighted
      navigate("/library", { state: { highlightSession: session.id } });
    } catch (error: any) {
      console.error("Error saving capture:", error);
      toast.error(error.message || "Failed to save capture");
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
          />

          {/* Debug Panel - Dev mode only */}
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
