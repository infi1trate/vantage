import { useEffect, useRef, memo } from "react";
import { Card } from "@/components/ui/card";
import { Mic, Shield, Circle, Pause } from "lucide-react";

interface CapturePreviewProps {
  screenStream: MediaStream | null;
  facecamStream: MediaStream | null;
  isRecording: boolean;
  isPaused?: boolean;
  microphoneLevel: number;
  captureConfig?: {
    screen: boolean;
    microphone: boolean;
    facecam: boolean;
    systemAudio: boolean;
  };
}

export const CapturePreview = memo(function CapturePreview({
  screenStream,
  facecamStream,
  isRecording,
  isPaused = false,
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

  // Determine status indicator
  const getStatusIndicator = () => {
    if (isRecording) {
      return (
        <div className="flex items-center gap-2 bg-destructive/90 rounded-full px-3 py-1.5">
          <Circle className="h-3 w-3 text-destructive-foreground recording-pulse" fill="currentColor" />
          <span className="text-xs font-bold text-destructive-foreground uppercase tracking-wider">REC</span>
        </div>
      );
    }
    
    if (isPaused) {
      return (
        <div className="flex items-center gap-2 bg-warning/90 rounded-full px-3 py-1.5">
          <Pause className="h-3 w-3 text-warning-foreground" />
          <span className="text-xs font-bold text-warning-foreground uppercase tracking-wider">PAUSED</span>
        </div>
      );
    }
    
    // Preview ready state
    return (
      <div className="flex items-center gap-2 bg-vantage-success/90 rounded-full px-3 py-1.5">
        <span className="w-2 h-2 rounded-full bg-background" />
        <span className="text-xs font-bold text-background uppercase tracking-wider">READY</span>
      </div>
    );
  };

  return (
    <Card className="relative aspect-video bg-black rounded-lg overflow-hidden border border-border/30 mb-6">
      {/* Screen capture preview */}
      {screenStream ? (
        <video
          ref={screenVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p>No screen capture</p>
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
            <span className="text-[10px] text-foreground uppercase tracking-wider">Cam</span>
          </div>
        </div>
      )}

      {/* Top bar with recording indicator and privacy badge */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        {/* Status indicator */}
        {getStatusIndicator()}

        {/* Privacy assurance */}
        <div className="flex items-center gap-1.5 bg-vantage-success/10 border border-vantage-success/30 rounded-full px-2.5 py-1">
          <Shield className="h-3 w-3 text-vantage-success" />
          <span className="text-xs text-vantage-success font-medium uppercase tracking-wider">Private</span>
        </div>
      </div>

      {/* Microphone level indicator - reacts live to voice */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5">
        <Mic className={`h-4 w-4 transition-colors duration-100 ${microphoneLevel > 0.05 ? "text-primary" : "text-muted-foreground"}`} />
        <div className="w-24 h-2 bg-muted/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full"
            style={{ 
              width: `${Math.min(microphoneLevel * 100, 100)}%`,
              transition: 'width 50ms ease-out',
            }}
          />
        </div>
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Mic</span>
      </div>
    </Card>
  );
});
