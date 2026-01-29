import { useState, useRef, useCallback, useEffect } from "react";

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
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  const streamRef = useRef<MediaStream | null>(null);

  const startCapture = useCallback(async (options?: ScreenCaptureOptions): Promise<MediaStream | null> => {
    try {
      setError(null);
      setPermissionDenied(false);

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
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionDenied(true);
        setError("Screen capture permission denied. Please allow screen sharing to continue.");
      } else if (err.name === "NotFoundError") {
        setError("No screen or window available for capture.");
      } else if (err.name === "NotReadableError") {
        setError("Screen capture is not available. Another application may be using it.");
      } else if (err.name === "AbortError") {
        setError("Screen capture was cancelled.");
      } else {
        setError(err.message || "Failed to start screen capture.");
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
    permissionDenied,
    startCapture,
    stopCapture,
    pauseCapture,
    resumeCapture,
  };
}
