import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { updateCaptureSession, getCaptureSession, CaptureSession, createVideoAsset, createAudioTrack } from "@/lib/captures";
import { supabase } from "@/integrations/supabase/client";
import { useCaptureManager, RecordedData } from "@/hooks/useCaptureManager";
import { CapturePreview } from "@/components/capture/CapturePreview";
import { CaptureControls } from "@/components/capture/CaptureControls";
import { CaptureSetup } from "@/components/capture/CaptureSetup";
import { PermissionError } from "@/components/capture/PermissionError";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function CapturePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  
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

  const handleSetupComplete = async (config: { enableFacecam: boolean; enableSystemAudio: boolean }) => {
    const success = await capture.requestPermissions(config);
    if (success) {
      setSetupComplete(true);
      // Auto-start recording
      await capture.startRecording();
    }
  };

  const handlePauseResume = () => {
    if (capture.isPaused) {
      capture.resumeRecording();
    } else {
      capture.pauseRecording();
    }
  };

  const handleEndCapture = async () => {
    if (!session || !user) return;
    
    setSaving(true);
    try {
      // Stop recording and get data
      const recordedData = await capture.stopRecording();
      
      if (!recordedData) {
        throw new Error("No recorded data");
      }

      // Upload recorded files to storage
      const uploadPromises: Promise<void>[] = [];
      
      // Upload screen recording
      if (recordedData.screenBlob) {
        const screenPath = `${user.id}/${session.id}/gameplay.webm`;
        uploadPromises.push(
          supabase.storage
            .from("video-assets")
            .upload(screenPath, recordedData.screenBlob, { contentType: "video/webm" })
            .then(async ({ data, error }) => {
              if (error) throw error;
              const { data: urlData } = supabase.storage.from("video-assets").getPublicUrl(screenPath);
              
              await createVideoAsset({
                session_id: session.id,
                user_id: user.id,
                asset_type: "gameplay",
                storage_url: urlData.publicUrl,
                storage_path: screenPath,
                duration_ms: recordedData.duration * 1000,
                status: "ready",
                processing_progress: 100,
                mime_type: "video/webm",
                file_size_bytes: recordedData.screenBlob!.size,
                width: null,
                height: null,
                framerate: null,
                bitrate: null,
                codec: null,
                thumbnail_url: null,
                thumbnail_sprite_url: null,
                error_message: null,
              });
            })
        );
      }

      // Upload microphone recording
      if (recordedData.microphoneBlob) {
        const micPath = `${user.id}/${session.id}/microphone.webm`;
        uploadPromises.push(
          supabase.storage
            .from("audio-tracks")
            .upload(micPath, recordedData.microphoneBlob, { contentType: "audio/webm" })
            .then(async ({ data, error }) => {
              if (error) throw error;
              const { data: urlData } = supabase.storage.from("audio-tracks").getPublicUrl(micPath);
              
              await createAudioTrack({
                session_id: session.id,
                user_id: user.id,
                video_asset_id: null,
                track_type: "microphone",
                track_name: "Microphone",
                storage_url: urlData.publicUrl,
                storage_path: micPath,
                duration_ms: recordedData.duration * 1000,
                status: "ready",
                mime_type: "audio/webm",
                file_size_bytes: recordedData.microphoneBlob!.size,
                sample_rate: 48000,
                channels: 1,
                bitrate: null,
                codec: null,
                volume_level: 1.0,
                is_muted: false,
                offset_ms: 0,
                waveform_data: null,
              });
            })
        );
      }

      // Upload facecam recording if available
      if (recordedData.facecamBlob) {
        const facecamPath = `${user.id}/${session.id}/facecam.webm`;
        uploadPromises.push(
          supabase.storage
            .from("facecam-tracks")
            .upload(facecamPath, recordedData.facecamBlob, { contentType: "video/webm" })
            .then(async ({ error }) => {
              if (error) throw error;
              // Create facecam track record - would need to add createFacecamTrack function
            })
        );
      }

      // Wait for all uploads
      await Promise.all(uploadPromises);

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
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    capture.cancelRecording();
    
    if (session) {
      try {
        await updateCaptureSession(session.id, { status: "failed" });
      } catch (error) {
        console.error("Error updating session:", error);
      }
    }
    
    navigate("/");
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

  // Show permission error
  if (capture.captureState === "error" && capture.error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="max-w-2xl mx-auto">
            <PermissionError 
              error={capture.error} 
              onRetry={() => setSetupComplete(false)}
              onCancel={handleCancel}
            />
          </div>
        </main>
      </div>
    );
  }

  // Show setup screen
  if (!setupComplete) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="max-w-2xl mx-auto">
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="mb-6"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            
            <CaptureSetup
              session={session}
              onStart={handleSetupComplete}
              isLoading={capture.captureState === "requesting_permissions"}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Session Info */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className={`w-3 h-3 rounded-full ${capture.isPaused ? "bg-yellow-500" : "bg-red-500 recording-pulse"}`} />
              <Badge variant="outline" className={capture.isPaused ? "border-yellow-500/30 text-yellow-400" : "border-red-500/30 text-red-400"}>
                {capture.isPaused ? "PAUSED" : "RECORDING"}
              </Badge>
              <span className="text-2xl font-bold font-mono-data">{formatTime(capture.duration)}</span>
            </div>
            <h1 className="text-xl font-semibold">{session.title}</h1>
            {session.game_name && (
              <p className="text-sm text-primary">{session.game_name}</p>
            )}
          </div>

          {/* Preview */}
          <CapturePreview
            screenStream={capture.screenStream}
            facecamStream={capture.facecamStream}
            isPaused={capture.isPaused}
            microphoneLevel={capture.microphoneLevel}
          />

          {/* Controls */}
          <CaptureControls
            isRecording={capture.isRecording}
            isPaused={capture.isPaused}
            isSaving={saving}
            onPauseResume={handlePauseResume}
            onStop={handleEndCapture}
            onCancel={handleCancel}
          />
        </div>
      </main>
    </div>
  );
}
