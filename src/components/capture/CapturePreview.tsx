import { useEffect, useRef, memo, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Shield, Circle, Pause, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CapturePreviewProps {
  screenStream: MediaStream | null;
  facecamStream: MediaStream | null;
  microphoneStream: MediaStream | null;
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

/** Clipping threshold (0-1) - levels above this trigger warning */
const CLIPPING_THRESHOLD = 0.92;
/** How long to show clipping warning after level drops */
const CLIPPING_PERSIST_MS = 1500;

type MicState = "active" | "muted" | "unavailable";

export const CapturePreview = memo(function CapturePreview({
  screenStream,
  facecamStream,
  microphoneStream,
  isRecording,
  isPaused = false,
  microphoneLevel,
  captureConfig = { screen: true, microphone: true, facecam: false, systemAudio: true },
}: CapturePreviewProps) {
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const facecamVideoRef = useRef<HTMLVideoElement>(null);
  
  // Clipping detection state
  const [isClipping, setIsClipping] = useState(false);
  const clippingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Detect clipping (mic level near max)
  useEffect(() => {
    if (microphoneLevel >= CLIPPING_THRESHOLD) {
      setIsClipping(true);
      
      // Clear any existing timeout
      if (clippingTimeoutRef.current) {
        clearTimeout(clippingTimeoutRef.current);
      }
      
      // Set timeout to hide clipping warning after level drops
      clippingTimeoutRef.current = setTimeout(() => {
        setIsClipping(false);
      }, CLIPPING_PERSIST_MS);
    }
    
    return () => {
      if (clippingTimeoutRef.current) {
        clearTimeout(clippingTimeoutRef.current);
      }
    };
  }, [microphoneLevel]);

  // Determine mic state based on stream and track status
  const micState: MicState = useMemo(() => {
    if (!microphoneStream) {
      return "unavailable";
    }
    
    const audioTracks = microphoneStream.getAudioTracks();
    if (audioTracks.length === 0) {
      return "unavailable";
    }
    
    const track = audioTracks[0];
    
    // Check if track has ended
    if (track.readyState === "ended") {
      return "unavailable";
    }
    
    // Check if track is muted/disabled
    if (!track.enabled || track.muted) {
      return "muted";
    }
    
    return "active";
  }, [microphoneStream]);

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

  // Render mic indicator based on state
  const renderMicIndicator = () => {
    // Unavailable state - warning with tooltip
    if (micState === "unavailable") {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-destructive/20 border border-destructive/40 backdrop-blur-sm rounded-full px-3 py-1.5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-xs text-destructive font-medium uppercase tracking-wider">Mic unavailable</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-sm">Microphone is not available. Check your device permissions or reconnect.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    // Muted state - show muted icon, no level bar
    if (micState === "muted") {
      return (
        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5">
          <MicOff className="h-4 w-4 text-muted-foreground" />
          <div className="w-24 h-2 bg-muted/30 rounded-full" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Muted</span>
        </div>
      );
    }
    
    // Active state - show animated level bar
    return (
      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5">
        <Mic 
          className={`h-4 w-4 transition-colors duration-100 ${
            isClipping 
              ? "text-destructive" 
              : microphoneLevel > 0.05 
                ? "text-primary" 
                : "text-muted-foreground"
          }`} 
        />
        <div className="w-24 h-2 bg-muted/50 rounded-full overflow-hidden relative">
          {/* Level bar */}
          <div 
            className={`h-full rounded-full ${isClipping ? "bg-destructive" : "bg-primary"}`}
            style={{ 
              width: `${Math.min(microphoneLevel * 100, 100)}%`,
              transition: 'width 50ms ease-out',
            }}
          />
          {/* Clipping threshold marker */}
          <div 
            className="absolute top-0 bottom-0 w-px bg-destructive/50"
            style={{ left: `${CLIPPING_THRESHOLD * 100}%` }}
          />
        </div>
        {isClipping ? (
          <span className="text-xs text-destructive font-medium uppercase tracking-wider animate-pulse">
            Clipping
          </span>
        ) : (
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Mic</span>
        )}
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

      {/* Microphone level indicator */}
      {renderMicIndicator()}
    </Card>
  );
});
