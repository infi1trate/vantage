import { useState, useRef, useCallback, useEffect } from "react";

export interface MicrophoneOptions {
  deviceId?: string;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export interface UseMicrophoneCaptureReturn {
  isCapturing: boolean;
  stream: MediaStream | null;
  error: string | null;
  permissionDenied: boolean;
  availableDevices: AudioDevice[];
  selectedDeviceId: string | null;
  audioLevel: number;
  startCapture: (options?: MicrophoneOptions) => Promise<MediaStream | null>;
  stopCapture: () => void;
  selectDevice: (deviceId: string) => void;
  refreshDevices: () => Promise<void>;
}

export function useMicrophoneCapture(): UseMicrophoneCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      // Need to request permission first to get device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach(track => track.stop());
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices
        .filter(device => device.kind === "audioinput")
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        }));
      
      setAvailableDevices(audioDevices);
      
      if (audioDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(audioDevices[0].deviceId);
      }
    } catch (err: any) {
      console.error("Error enumerating audio devices:", err);
      if (err.name === "NotAllowedError") {
        setPermissionDenied(true);
      }
    }
  }, [selectedDeviceId]);

  const startAudioLevelMonitoring = useCallback((mediaStream: MediaStream) => {
    try {
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(mediaStream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      const updateLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255); // Normalize to 0-1
        }
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.error("Error setting up audio monitoring:", err);
    }
  }, []);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const startCapture = useCallback(async (options?: MicrophoneOptions): Promise<MediaStream | null> => {
    try {
      setError(null);
      setPermissionDenied(false);

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: options?.deviceId || selectedDeviceId || undefined,
          echoCancellation: options?.echoCancellation ?? true,
          noiseSuppression: options?.noiseSuppression ?? true,
          autoGainControl: options?.autoGainControl ?? true,
        },
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCapturing(true);
      
      // Start monitoring audio levels
      startAudioLevelMonitoring(mediaStream);

      return mediaStream;
    } catch (err: any) {
      console.error("Microphone capture error:", err);
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionDenied(true);
        setError("Microphone permission denied. Please allow microphone access to record voice.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone.");
      } else if (err.name === "NotReadableError") {
        setError("Microphone is in use by another application.");
      } else {
        setError(err.message || "Failed to start microphone capture.");
      }
      
      return null;
    }
  }, [selectedDeviceId, startAudioLevelMonitoring]);

  const stopCapture = useCallback(() => {
    stopAudioLevelMonitoring();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsCapturing(false);
  }, [stopAudioLevelMonitoring]);

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioLevelMonitoring();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [stopAudioLevelMonitoring]);

  return {
    isCapturing,
    stream,
    error,
    permissionDenied,
    availableDevices,
    selectedDeviceId,
    audioLevel,
    startCapture,
    stopCapture,
    selectDevice,
    refreshDevices,
  };
}
