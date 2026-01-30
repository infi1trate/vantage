import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { updateCaptureSession, getCaptureSession, CaptureSession, createVideoAsset } from "@/lib/captures";
import { supabase } from "@/integrations/supabase/client";
import { useCaptureManager, RecordedData } from "@/hooks/useCaptureManager";
import { CapturePreview } from "@/components/capture/CapturePreview";
import { CaptureControls } from "@/components/capture/CaptureControls";
import { CaptureSetup } from "@/components/capture/CaptureSetup";
import { PermissionError } from "@/components/capture/PermissionError";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Play } from "lucide-react";
import { toast } from "sonner";

export default function CapturePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [loading, setLoading] = useState(true);
  
  const capture = useCaptureManager();

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
    // Don't auto-start recording - user must explicitly click "Start Recording"
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
    
    // Only proceed if we're actually recording
    if (capture.captureState !== "recording") {
      console.warn("handleEndCapture called but not in recording state");
      return;
    }

    try {
      // Stop recording and get data
      const recordedData = await capture.stopRecording();
      
      if (!recordedData) {
        throw new Error("No recorded data");
      }

      // Upload the single composite recording (screen + PiP webcam + mixed audio)
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
      navigate(`/session/${session.id}`);
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
          <p className="text-muted-foreground">Redirecting to session...</p>
        </div>
      </div>
    );
  }

  // PREVIEW_READY, RECORDING, or FINALIZING STATE
  const isRecording = capture.captureState === "recording";
  const isFinalizing = capture.captureState === "finalizing";
  const isPreviewReady = capture.captureState === "preview_ready";

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
              {isPreviewReady && (
                <>
                  <span className="w-3 h-3 rounded-full bg-vantage-success" />
                  <Badge variant="outline" className="border-vantage-success/30 text-vantage-success uppercase tracking-wider text-xs">
                    PREVIEW
                  </Badge>
                  <span className="text-sm text-muted-foreground">Ready to record</span>
                </>
              )}
              {isFinalizing && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <Badge variant="outline" className="border-primary/30 text-primary uppercase tracking-wider text-xs">
                    SAVING
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
            microphoneLevel={capture.microphoneLevel}
          />

          {/* Controls */}
          <CaptureControls
            captureState={capture.captureState}
            onStartRecording={handleStartRecording}
            onStopRecording={handleEndCapture}
            onStopPreview={handleStopPreview}
            onCancel={handleCancel}
          />
        </div>
      </main>
    </div>
  );
}
