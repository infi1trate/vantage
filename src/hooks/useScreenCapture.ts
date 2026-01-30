import { useState, useRef, useCallback, useEffect } from "react";
import { parseMediaError, type CaptureError } from "@/lib/captureErrors";

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
      
      // Handle user stopping share via browser UI
      mediaStream.getVideoTracks()[0].addEventListener("ended", () => {
        stopCapture();
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCapturing(true);
      setIsPaused(false);

      return mediaStream;
    } catch (err: any) {
      console.error("Screen capture error:", err);
      
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
