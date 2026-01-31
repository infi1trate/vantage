import { useState, useRef, useCallback, useEffect } from "react";
import { parseMediaError, type CaptureError } from "@/lib/captureErrors";

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
  captureError: CaptureError | null;
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
  const [captureError, setCaptureError] = useState<CaptureError | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const smoothedLevelRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);

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

  /**
   * Monitors audio levels from the RAW microphone stream (pre-mix).
   * 
   * IMPORTANT: This analyzes the mic input directly, NOT the mixed output.
   * This ensures the level indicator reflects only the user's voice,
   * not game audio or other mixed sources.
   * 
   * The analyser is connected to a separate AudioContext that doesn't
   * affect the recording pipeline - it's purely for visualization.
   */
  const startAudioLevelMonitoring = useCallback((micStream: MediaStream) => {
    try {
      // Clean up any existing context first
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      
      // Create a dedicated AudioContext for level monitoring only
      // This is separate from the recording/mixing pipeline
      audioContextRef.current = new AudioContext();
      
      // Connect directly to the raw mic stream (pre-mix, pre-gain)
      const source = audioContextRef.current.createMediaStreamSource(micStream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      // Use smaller FFT for faster response, but we'll use time-domain data for RMS
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0; // We'll do our own smoothing
      
      // Don't connect to destination - we're only reading levels, not outputting audio
      source.connect(analyserRef.current);
      // analyserRef is NOT connected to audioContext.destination (no output)
      
      console.log("[MicCapture] Audio level monitoring started (raw mic stream, pre-mix)");

      // Use time-domain data for RMS calculation (better for voice levels)
      const dataArray = new Float32Array(analyserRef.current.fftSize);
      
      // Smoothing factor: higher = smoother but slower response
      // 0.15 gives responsive feel without jitter at ~60fps
      const SMOOTHING_RISE = 0.25;  // Faster attack when voice gets louder
      const SMOOTHING_FALL = 0.08;  // Slower decay for natural feel
      
      // Target ~45fps for level updates (every ~22ms)
      const TARGET_INTERVAL_MS = 22;

      const updateLevel = (timestamp: number) => {
        // Throttle updates to target interval
        const elapsed = timestamp - lastUpdateTimeRef.current;
        
        if (elapsed >= TARGET_INTERVAL_MS && analyserRef.current) {
          lastUpdateTimeRef.current = timestamp;
          
          // Get time-domain data for RMS calculation
          analyserRef.current.getFloatTimeDomainData(dataArray);
          
          // Calculate RMS (Root Mean Square) for accurate volume level
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sumSquares += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          
          // Convert to 0-1 range with some headroom
          // RMS of voice typically ranges 0.01-0.3, so scale accordingly
          const rawLevel = Math.min(rms * 3, 1);
          
          // Exponential smoothing with different rise/fall rates
          const smoothing = rawLevel > smoothedLevelRef.current ? SMOOTHING_RISE : SMOOTHING_FALL;
          smoothedLevelRef.current = smoothedLevelRef.current + smoothing * (rawLevel - smoothedLevelRef.current);
          
          setAudioLevel(smoothedLevelRef.current);
        }
        
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      // Start the loop
      animationFrameRef.current = requestAnimationFrame(updateLevel);
      console.log("[MicCapture] Audio level monitoring started");
    } catch (err) {
      console.error("[MicCapture] Error setting up audio monitoring:", err);
    }
  }, []);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    smoothedLevelRef.current = 0;
    lastUpdateTimeRef.current = 0;
    setAudioLevel(0);
    console.log("[MicCapture] Audio level monitoring stopped");
  }, []);

  const startCapture = useCallback(async (options?: MicrophoneOptions): Promise<MediaStream | null> => {
    try {
      setError(null);
      setCaptureError(null);
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
      
      const parsedError = parseMediaError(err, "microphone");
      setError(parsedError.message);
      setCaptureError(parsedError);
      
      if (parsedError.code === "PERMISSION_DENIED") {
        setPermissionDenied(true);
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
    captureError,
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
