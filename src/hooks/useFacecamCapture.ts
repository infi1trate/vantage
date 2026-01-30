import { useState, useRef, useCallback, useEffect } from "react";
import { parseMediaError, type CaptureError } from "@/lib/captureErrors";

export interface FacecamOptions {
  deviceId?: string;
  width?: number;
  height?: number;
  frameRate?: number;
}

export interface VideoDevice {
  deviceId: string;
  label: string;
}

export interface UseFacecamCaptureReturn {
  isCapturing: boolean;
  stream: MediaStream | null;
  error: string | null;
  captureError: CaptureError | null;
  permissionDenied: boolean;
  availableDevices: VideoDevice[];
  selectedDeviceId: string | null;
  startCapture: (options?: FacecamOptions) => Promise<MediaStream | null>;
  stopCapture: () => void;
  selectDevice: (deviceId: string) => void;
  refreshDevices: () => Promise<void>;
}

export function useFacecamCapture(): UseFacecamCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<CaptureError | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<VideoDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  
  const streamRef = useRef<MediaStream | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      // Need to request permission first to get device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(track => track.stop());
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === "videoinput")
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        }));
      
      setAvailableDevices(videoDevices);
      
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (err: any) {
      console.error("Error enumerating devices:", err);
      if (err.name === "NotAllowedError") {
        setPermissionDenied(true);
      }
    }
  }, [selectedDeviceId]);

  const startCapture = useCallback(async (options?: FacecamOptions): Promise<MediaStream | null> => {
    try {
      setError(null);
      setCaptureError(null);
      setPermissionDenied(false);

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: options?.deviceId || selectedDeviceId || undefined,
          width: { ideal: options?.width || 1280 },
          height: { ideal: options?.height || 720 },
          frameRate: { ideal: options?.frameRate || 30 },
        },
        audio: false, // Facecam doesn't need audio - microphone is separate
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCapturing(true);

      return mediaStream;
    } catch (err: any) {
      console.error("Facecam capture error:", err);
      
      const parsedError = parseMediaError(err, "camera");
      setError(parsedError.message);
      setCaptureError(parsedError);
      
      if (parsedError.code === "PERMISSION_DENIED") {
        setPermissionDenied(true);
      }
      
      return null;
    }
  }, [selectedDeviceId]);

  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsCapturing(false);
  }, []);

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
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
    stream,
    error,
    captureError,
    permissionDenied,
    availableDevices,
    selectedDeviceId,
    startCapture,
    stopCapture,
    selectDevice,
    refreshDevices,
  };
}
