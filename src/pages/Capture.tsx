import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { updateCaptureSession, getCaptureSession, CaptureSession, createVideoAsset } from "@/lib/captures";
import { supabase } from "@/integrations/supabase/client";
import { useCaptureManager } from "@/hooks/useCaptureManager";
import { CapturePreview } from "@/components/capture/CapturePreview";
import { CaptureControls } from "@/components/capture/CaptureControls";
import { CaptureSetup } from "@/components/capture/CaptureSetup";
import { PermissionError } from "@/components/capture/PermissionError";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Pause } from "lucide-react";
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

export default function CapturePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  
  const capture = useCaptureManager();

  // Determine if we should block navigation
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
    const success = await capture.startRecording();
    if (!success) {
      toast.error("Failed to start recording");
    }
  };

  // User clicks "End Capture" - stops recording and saves
  const handleEndCapture = async () => {
    if (!session || !user) return;
    
    // Only proceed if we're recording or paused
    if (capture.captureState !== "recording" && capture.captureState !== "paused") {
      console.warn("handleEndCapture called but not in recording/paused state");
      return;
    }

    try {
      // Stop recording and get data
      const recordedData = await capture.stopRecording();
      
      if (!recordedData) {
        throw new Error("No recorded data");
      }

      // Upload the single composite recording
      if (recordedData.compositeBlob) {
        const compositePath = `${user.id}/${session.id}/gameplay.webm`;
        
        const { error: uploadError } = await supabase.storage
          .from("video-assets")
          .upload(compositePath, recordedData.compositeBlob, { contentType: "video/webm" });
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage.from("video-assets").getPublicUrl(compositePath);
        
        await createVideoAsset({
          session_id: session.id,
          user_id: user.id,
          asset_type: "gameplay",
          storage_url: urlData.publicUrl,
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
          thumbnail_url: null,
          thumbnail_sprite_url: null,
          error_message: null,
        });
        
        console.log(`[Capture] Uploaded composite video: ${recordedData.compositeBlob.size} bytes`);
      } else {
        throw new Error("No composite recording data");
      }

      // Update session status
      await updateCaptureSession(session.id, {
        status: "ready",
        duration_seconds: recordedData.duration,
      });

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
            <PermissionError 
              error={capture.error.message} 
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
            
            <CaptureSetup
              session={session}
              onStart={handleSetupComplete}
              isLoading={capture.captureState === "selecting_sources"}
            />
          </div>
        </main>
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
                </>
              )}
              {isPaused && (
                <>
                  <Pause className="h-4 w-4 text-warning" />
                  <Badge variant="outline" className="border-warning/30 text-warning uppercase tracking-wider text-xs">
                    PAUSED
                  </Badge>
                  <span className="font-display text-3xl text-muted-foreground">{formatTime(capture.duration)}</span>
                </>
              )}
              {isPreviewReady && (
                <>
                  <span className="w-3 h-3 rounded-full bg-vantage-success" />
                  <Badge variant="outline" className="border-vantage-success/30 text-vantage-success uppercase tracking-wider text-xs">
                    READY
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

          {/* Controls */}
          <CaptureControls
            captureState={capture.captureState}
            onStartRecording={handleStartRecording}
            onPauseRecording={capture.pauseRecording}
            onResumeRecording={capture.resumeRecording}
            onStopRecording={handleEndCapture}
            onStopPreview={handleStopPreview}
            onCancel={handleCancel}
          />
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
