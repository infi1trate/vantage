import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type FrameShape = "circle" | "rounded-square";
export type CameraSize = "small" | "large";

interface FacecamPreviewProps {
  enabled: boolean;
  frameShape?: FrameShape;
  cameraSize?: CameraSize;
  className?: string;
}

export function FacecamPreview({ 
  enabled, 
  frameShape = "circle", 
  cameraSize = "small",
  className 
}: FacecamPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      // Stop stream when disabled
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      return;
    }

    const startCamera = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        if (err.name === "NotAllowedError") {
          setError("Camera access denied");
        } else if (err.name === "NotFoundError") {
          setError("No camera found");
        } else {
          setError("Camera unavailable");
        }
      } finally {
        setLoading(false);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [enabled]);

  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const getFrameClasses = () => {
    if (frameShape === "circle") {
      return "rounded-full aspect-square";
    }
    return "rounded-2xl aspect-video";
  };

  const getContainerClasses = () => {
    const sizeClasses = cameraSize === "large" 
      ? "max-w-none" 
      : frameShape === "circle" 
        ? "max-w-[140px]" 
        : "max-w-[200px]";
    
    if (frameShape === "circle") {
      return cn("aspect-square mx-auto", sizeClasses);
    }
    return cn("aspect-video mx-auto", sizeClasses);
  };

  if (!enabled) {
    return (
      <div className={cn(
        "bg-muted/20 border border-border/30 flex items-center justify-center",
        getContainerClasses(),
        getFrameClasses(),
        className
      )}>
        <div className="text-center space-y-2">
          <CameraOff className="h-6 w-6 text-muted-foreground/40 mx-auto" />
          <p className="text-xs text-muted-foreground/60">Facecam disabled</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn(
        "bg-muted/20 border border-border/30 flex items-center justify-center",
        getContainerClasses(),
        getFrameClasses(),
        className
      )}>
        <div className="text-center space-y-2">
          <RefreshCw className="h-5 w-5 text-muted-foreground/60 mx-auto animate-spin" />
          <p className="text-xs text-muted-foreground/60">Starting camera...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(
        "bg-muted/20 border border-destructive/30 flex items-center justify-center",
        getContainerClasses(),
        getFrameClasses(),
        className
      )}>
        <div className="text-center space-y-2">
          <CameraOff className="h-6 w-6 text-destructive/60 mx-auto" />
          <p className="text-xs text-destructive/80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-black border border-border/30 overflow-hidden relative",
      getContainerClasses(),
      getFrameClasses(),
      className
    )}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "w-full h-full object-cover scale-x-[-1]",
          frameShape === "circle" && "rounded-full"
        )}
      />
      <div className={cn(
        "absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white/80",
        frameShape === "circle" && "bottom-3 right-3"
      )}>
        <Camera className="h-3 w-3" />
        <span>Live</span>
      </div>
    </div>
  );
}
