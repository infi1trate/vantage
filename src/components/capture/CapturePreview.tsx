import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { ActiveCaptureIndicators } from "@/components/privacy/ActiveCaptureIndicators";
import { Mic, Shield } from "lucide-react";

interface CapturePreviewProps {
  screenStream: MediaStream | null;
  facecamStream: MediaStream | null;
  isPaused: boolean;
  microphoneLevel: number;
  captureConfig?: {
    screen: boolean;
    microphone: boolean;
    facecam: boolean;
    systemAudio: boolean;
  };
}

export function CapturePreview({
  screenStream,
  facecamStream,
  isPaused,
  microphoneLevel,
  captureConfig = { screen: true, microphone: true, facecam: false, systemAudio: true },
}: CapturePreviewProps) {
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const facecamVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  useEffect(() => {
    if (facecamVideoRef.current && facecamStream) {
      facecamVideoRef.current.srcObject = facecamStream;
    }
  }, [facecamStream]);

  return (
    <Card className="relative aspect-video bg-black rounded-lg overflow-hidden border border-border/50 mb-6">
      {/* Screen capture preview */}
      {screenStream ? (
        <video
          ref={screenVideoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-contain ${isPaused ? "opacity-50" : ""}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p>No screen capture</p>
          </div>
        </div>
      )}

      {/* Paused overlay */}
      {isPaused && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-vantage-warning/20 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-vantage-warning" />
            </div>
            <p className="text-foreground font-medium">Recording Paused</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your mic and camera are still active
            </p>
          </div>
        </div>
      )}

      {/* Facecam overlay */}
      {facecamStream && (
        <div className="absolute bottom-4 right-4 w-48 aspect-video rounded-lg overflow-hidden border-2 border-primary/50 shadow-lg">
          <video
            ref={facecamVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {/* Camera active indicator */}
          <div className="absolute top-1 right-1 flex items-center gap-1 bg-background/80 rounded-full px-1.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-vantage-success" />
            <span className="text-[10px] text-foreground">CAM</span>
          </div>
        </div>
      )}

      {/* Top bar with active capture indicators */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <ActiveCaptureIndicators
          isRecording={!!screenStream}
          isPaused={isPaused}
          captureConfig={captureConfig}
          microphoneLevel={microphoneLevel}
        />

        {/* Privacy assurance */}
        <div className="flex items-center gap-1.5 bg-vantage-success/10 border border-vantage-success/30 rounded-full px-2.5 py-1">
          <Shield className="h-3 w-3 text-vantage-success" />
          <span className="text-xs text-vantage-success font-medium">Private</span>
        </div>
      </div>

      {/* Microphone level indicator */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-background/80 rounded-full px-3 py-1.5">
        <Mic className={`h-4 w-4 ${microphoneLevel > 0.1 ? "text-primary" : "text-muted-foreground"}`} />
        <div className="w-24 h-2 bg-muted/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-75 rounded-full"
            style={{ width: `${Math.min(microphoneLevel * 100 * 2, 100)}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">MIC</span>
      </div>
    </Card>
  );
}
