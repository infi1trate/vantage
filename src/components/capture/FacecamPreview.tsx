import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBackgroundRemoval } from "@/hooks/useBackgroundRemoval";

export type FrameShape = "circle" | "rounded-square";
export type CameraSize = "small" | "large";

// Professional, muted color palette for background masks
export const BACKGROUND_COLORS = [
  { id: "transparent", value: "transparent", label: "None" },
  { id: "slate-900", value: "hsl(222.2 47.4% 11.2%)", label: "Charcoal" },
  { id: "zinc-800", value: "hsl(240 3.7% 15.9%)", label: "Graphite" },
  { id: "neutral-700", value: "hsl(0 0% 32%)", label: "Steel" },
  { id: "stone-600", value: "hsl(25 5.3% 44.7%)", label: "Taupe" },
  { id: "amber-900", value: "hsl(21.7 77.8% 26.5%)", label: "Ember" },
  { id: "emerald-900", value: "hsl(152 68% 18%)", label: "Forest" },
  { id: "vantage", value: "hsl(65 70% 45%)", label: "Vantage" },
  { id: "cyan-900", value: "hsl(192 91% 18%)", label: "Deep Teal" },
  { id: "blue-900", value: "hsl(224 64% 23%)", label: "Navy" },
  { id: "violet-900", value: "hsl(263 70% 24%)", label: "Plum" },
  { id: "rose-900", value: "hsl(343 79% 22%)", label: "Wine" },
] as const;

export type BackgroundColorId = typeof BACKGROUND_COLORS[number]["id"];

interface FacecamPreviewProps {
  enabled: boolean;
  frameShape?: FrameShape;
  cameraSize?: CameraSize;
  backgroundColor?: BackgroundColorId;
  backgroundImage?: string | null;
  flipCamera?: boolean;
  className?: string;
}

export function FacecamPreview({ 
  enabled, 
  frameShape = "circle", 
  cameraSize = "small",
  backgroundColor = "transparent",
  backgroundImage = null,
  flipCamera = true,
  className 
}: FacecamPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  
  const bgColor = BACKGROUND_COLORS.find(c => c.id === backgroundColor)?.value || "transparent";
  
  // Determine if we need background removal (not transparent)
  const needsBackgroundRemoval = backgroundColor !== "transparent" || backgroundImage !== null;
  
  // Background removal hook
  const {
    canvasRef,
    isModelLoaded,
    error: segmentError,
  } = useBackgroundRemoval({
    enabled: enabled && needsBackgroundRemoval && videoReady,
    videoElement: videoRef.current,
    backgroundColor: bgColor === "transparent" ? "#000000" : bgColor,
    backgroundImage,
  });

  useEffect(() => {
    if (!enabled) {
      // Stop stream when disabled
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setVideoReady(false);
      return;
    }

    const startCamera = async () => {
      setLoading(true);
      setError(null);
      setVideoReady(false);
      
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

  // Handle video ready state
  const handleVideoLoadedData = () => {
    setVideoReady(true);
  };

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

  // Show canvas with background removal when active, otherwise show video
  const showCanvas = needsBackgroundRemoval && isModelLoaded && videoReady;

  return (
    <div 
      className={cn(
        "border border-border/30 overflow-hidden relative transition-all duration-150 ease-out bg-black",
        getContainerClasses(),
        getFrameClasses(),
        className
      )}
    >
      {/* Hidden video element for source (always needed) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedData={handleVideoLoadedData}
        className={cn(
          "w-full h-full object-cover transition-transform duration-150 ease-out",
          flipCamera && "scale-x-[-1]",
          frameShape === "circle" && "rounded-full",
          // Hide video when showing canvas with background removal
          showCanvas && "opacity-0 absolute inset-0"
        )}
      />
      
      {/* Canvas with background removal effect */}
      {needsBackgroundRemoval && (
        <canvas
          ref={canvasRef}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            flipCamera && "scale-x-[-1]",
            frameShape === "circle" && "rounded-full",
            // Only show canvas when model is loaded and processing
            showCanvas ? "opacity-100" : "opacity-0 absolute inset-0"
          )}
        />
      )}
      
      {/* Loading indicator for background removal model */}
      {needsBackgroundRemoval && !isModelLoaded && videoReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="text-center space-y-2">
            <RefreshCw className="h-4 w-4 text-primary mx-auto animate-spin" />
            <p className="text-[10px] text-muted-foreground">Loading mask...</p>
          </div>
        </div>
      )}
      
      {/* Status badge */}
      <div className={cn(
        "absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] text-white/80 transition-all duration-150",
        frameShape === "circle" && "bottom-3 right-3"
      )}>
        <Camera className="h-3 w-3" />
        <span>Live</span>
        {showCanvas && (
          <Sparkles className="h-2.5 w-2.5 text-primary ml-0.5" />
        )}
      </div>
      
      {/* Segmentation error indicator */}
      {segmentError && needsBackgroundRemoval && (
        <div className="absolute top-2 left-2 right-2 px-2 py-1 bg-warning/20 border border-warning/30 rounded text-[10px] text-warning text-center">
          {segmentError}
        </div>
      )}
    </div>
  );
}
