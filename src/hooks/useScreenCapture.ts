import { useState, useRef, useCallback, useEffect } from "react";
import { parseMediaError, type CaptureError } from "@/lib/captureErrors";
import { mark, measure } from "@/lib/performanceMetrics";

export interface ScreenCaptureOptions {
  video?: {
    cursor?: "always" | "motion" | "never";
    displaySurface?: "monitor" | "window" | "browser";
  };
  audio?: boolean;
}

export interface UseScreenCaptureReturn {
  isCapturing: boolean;
  isPaused: boolean;
  stream: MediaStream | null;
  error: string | null;
  captureError: CaptureError | null;
  permissionDenied: boolean;
  startCapture: (options?: ScreenCaptureOptions) => Promise<MediaStream | null>;
  stopCapture: () => void;
  pauseCapture: () => void;
  resumeCapture: () => void;
}

export function useScreenCapture(): UseScreenCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<CaptureError | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  const streamRef = useRef<MediaStream | null>(null);

  const startCapture = useCallback(async (options?: ScreenCaptureOptions): Promise<MediaStream | null> => {
    // Mark screen capture request start
    mark("screen:permission-request");
    
    try {
      setError(null);
      setCaptureError(null);
      setPermissionDenied(false);

      // Check for secure context
      if (!window.isSecureContext) {
        const err = parseMediaError({ name: "SecurityError" }, "screen");
        setError(err.message);
        setCaptureError(err);
        return null;
      }

      const displayMediaOptions: DisplayMediaStreamOptions = {
        video: {
          cursor: options?.video?.cursor || "always",
          displaySurface: options?.video?.displaySurface || "window",
        } as MediaTrackConstraints,
        audio: options?.audio ?? true,
      };

      const mediaStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      
      // Measure time from permission request to stream acquired
      const permissionTime = measure(
        "screen:permission-to-stream",
        "screen:permission-request",
        undefined,
        "capture:screen"
      );
      
      // Mark for first frame timing
      mark("screen:stream-acquired");
      
      // Handle user stopping share via browser UI
      mediaStream.getVideoTracks()[0].addEventListener("ended", () => {
        stopCapture();
      });
      
      // Get first frame timing from track settings
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        if (settings.width && settings.height) {
          const firstFrameTime = measure(
            "screen:first-frame",
            "screen:stream-acquired",
            undefined,
            "capture:screen:first-frame"
          );
          
          console.log(`[Perf] Screen capture ready: permission=${permissionTime.toFixed(0)}ms, resolution=${settings.width}x${settings.height}`);
        }
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCapturing(true);
      setIsPaused(false);

      return mediaStream;
    } catch (err: any) {
      console.error("Screen capture error:", err);
      
      // Clear marks on error
      measure("screen:error", "screen:permission-request");
      
      const parsedError = parseMediaError(err, "screen");
      setError(parsedError.message);
      setCaptureError(parsedError);
      
      if (parsedError.code === "PERMISSION_DENIED") {
        setPermissionDenied(true);
      }
      
      return null;
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsCapturing(false);
    setIsPaused(false);
  }, []);

  const pauseCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.enabled = false;
      });
      setIsPaused(true);
    }
  }, []);

  const resumeCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.enabled = true;
      });
      setIsPaused(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isCapturing,
    isPaused,
    stream,
    error,
    captureError,
    permissionDenied,
    startCapture,
    stopCapture,
    pauseCapture,
    resumeCapture,
  };
}
