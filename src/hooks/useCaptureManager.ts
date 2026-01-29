import { useState, useRef, useCallback, useEffect } from "react";
import { useScreenCapture } from "./useScreenCapture";
import { useMicrophoneCapture } from "./useMicrophoneCapture";
import { useFacecamCapture } from "./useFacecamCapture";

export type CaptureState = 
  | "idle" 
  | "requesting_permissions"
  | "ready" 
  | "recording" 
  | "paused" 
  | "stopping"
  | "error";

export interface CaptureConfig {
  enableFacecam: boolean;
  enableSystemAudio: boolean;
  microphoneDeviceId?: string;
  facecamDeviceId?: string;
}

export interface RecordedData {
  screenBlob: Blob | null;
  microphoneBlob: Blob | null;
  facecamBlob: Blob | null;
  systemAudioBlob: Blob | null;
  duration: number;
}

export interface UseCaptureManagerReturn {
  // State
  captureState: CaptureState;
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  error: string | null;
  
  // Streams
  screenStream: MediaStream | null;
  microphoneStream: MediaStream | null;
  facecamStream: MediaStream | null;
  
  // Audio level
  microphoneLevel: number;
  
  // Device management
  availableMicrophones: { deviceId: string; label: string }[];
  availableCameras: { deviceId: string; label: string }[];
  selectedMicrophone: string | null;
  selectedCamera: string | null;
  
  // Actions
  requestPermissions: (config: CaptureConfig) => Promise<boolean>;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<RecordedData | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
  selectMicrophone: (deviceId: string) => void;
  selectCamera: (deviceId: string) => void;
  refreshDevices: () => Promise<void>;
}

export function useCaptureManager(): UseCaptureManagerReturn {
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<CaptureConfig>({
    enableFacecam: false,
    enableSystemAudio: true,
  });
  
  // Recording refs
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const facecamRecorderRef = useRef<MediaRecorder | null>(null);
  
  const screenChunksRef = useRef<Blob[]>([]);
  const micChunksRef = useRef<Blob[]>([]);
  const facecamChunksRef = useRef<Blob[]>([]);
  
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use the individual capture hooks
  const screen = useScreenCapture();
  const microphone = useMicrophoneCapture();
  const facecam = useFacecamCapture();

  // Derived state
  const isRecording = captureState === "recording";
  const isPaused = captureState === "paused";

  // Refresh all devices
  const refreshDevices = useCallback(async () => {
    await Promise.all([
      microphone.refreshDevices(),
      facecam.refreshDevices(),
    ]);
  }, [microphone, facecam]);

  // Request all necessary permissions and start streams
  const requestPermissions = useCallback(async (captureConfig: CaptureConfig): Promise<boolean> => {
    setCaptureState("requesting_permissions");
    setError(null);
    setConfig(captureConfig);

    try {
      // Start microphone (required)
      const micStream = await microphone.startCapture({
        deviceId: captureConfig.microphoneDeviceId,
      });
      
      if (!micStream) {
        setError(microphone.error || "Microphone is required for capture.");
        setCaptureState("error");
        return false;
      }

      // Start screen capture
      const screenStream = await screen.startCapture({
        audio: captureConfig.enableSystemAudio,
      });
      
      if (!screenStream) {
        microphone.stopCapture();
        setError(screen.error || "Screen capture is required.");
        setCaptureState("error");
        return false;
      }

      // Start facecam if enabled
      if (captureConfig.enableFacecam) {
        const facecamStream = await facecam.startCapture({
          deviceId: captureConfig.facecamDeviceId,
        });
        
        if (!facecamStream) {
          // Facecam is optional, just log warning
          console.warn("Facecam capture failed:", facecam.error);
        }
      }

      setCaptureState("ready");
      return true;
    } catch (err: any) {
      console.error("Permission request failed:", err);
      setError(err.message || "Failed to request permissions.");
      setCaptureState("error");
      return false;
    }
  }, [screen, microphone, facecam]);

  // Create MediaRecorder for a stream
  const createRecorder = useCallback((
    stream: MediaStream,
    chunksRef: React.MutableRefObject<Blob[]>,
    mimeType: string
  ): MediaRecorder => {
    const options: MediaRecorderOptions = {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
    };
    
    const recorder = new MediaRecorder(stream, options);
    chunksRef.current = [];
    
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    
    return recorder;
  }, []);

  // Start recording all streams
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (captureState !== "ready") {
      setError("Capture is not ready. Request permissions first.");
      return false;
    }

    try {
      // Create screen recorder
      if (screen.stream) {
        screenRecorderRef.current = createRecorder(
          screen.stream,
          screenChunksRef,
          "video/webm;codecs=vp9"
        );
        screenRecorderRef.current.start(1000); // Buffer every 1 second
      }

      // Create microphone recorder
      if (microphone.stream) {
        micRecorderRef.current = createRecorder(
          microphone.stream,
          micChunksRef,
          "audio/webm;codecs=opus"
        );
        micRecorderRef.current.start(1000);
      }

      // Create facecam recorder if available
      if (facecam.stream) {
        facecamRecorderRef.current = createRecorder(
          facecam.stream,
          facecamChunksRef,
          "video/webm;codecs=vp9"
        );
        facecamRecorderRef.current.start(1000);
      }

      // Start duration timer
      startTimeRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 100);

      setCaptureState("recording");
      return true;
    } catch (err: any) {
      console.error("Failed to start recording:", err);
      setError(err.message || "Failed to start recording.");
      setCaptureState("error");
      return false;
    }
  }, [captureState, screen.stream, microphone.stream, facecam.stream, createRecorder]);

  // Stop recording and return data
  const stopRecording = useCallback(async (): Promise<RecordedData | null> => {
    if (captureState !== "recording" && captureState !== "paused") {
      return null;
    }

    setCaptureState("stopping");

    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

    // Helper to stop recorder and get blob
    const stopRecorder = (
      recorder: MediaRecorder | null,
      chunks: Blob[],
      mimeType: string
    ): Promise<Blob | null> => {
      return new Promise((resolve) => {
        if (!recorder || recorder.state === "inactive") {
          resolve(chunks.length > 0 ? new Blob(chunks, { type: mimeType }) : null);
          return;
        }

        recorder.onstop = () => {
          resolve(chunks.length > 0 ? new Blob(chunks, { type: mimeType }) : null);
        };

        recorder.stop();
      });
    };

    // Stop all recorders
    const [screenBlob, microphoneBlob, facecamBlob] = await Promise.all([
      stopRecorder(screenRecorderRef.current, screenChunksRef.current, "video/webm"),
      stopRecorder(micRecorderRef.current, micChunksRef.current, "audio/webm"),
      stopRecorder(facecamRecorderRef.current, facecamChunksRef.current, "video/webm"),
    ]);

    // Stop all streams
    screen.stopCapture();
    microphone.stopCapture();
    facecam.stopCapture();

    // Clear refs
    screenRecorderRef.current = null;
    micRecorderRef.current = null;
    facecamRecorderRef.current = null;

    setCaptureState("idle");
    setDuration(0);

    return {
      screenBlob,
      microphoneBlob,
      facecamBlob,
      systemAudioBlob: null, // System audio is included in screen capture
      duration: finalDuration,
    };
  }, [captureState, screen, microphone, facecam]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (captureState !== "recording") return;

    [screenRecorderRef.current, micRecorderRef.current, facecamRecorderRef.current].forEach(recorder => {
      if (recorder && recorder.state === "recording") {
        recorder.pause();
      }
    });

    screen.pauseCapture();
    setCaptureState("paused");
  }, [captureState, screen]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (captureState !== "paused") return;

    [screenRecorderRef.current, micRecorderRef.current, facecamRecorderRef.current].forEach(recorder => {
      if (recorder && recorder.state === "paused") {
        recorder.resume();
      }
    });

    screen.resumeCapture();
    setCaptureState("recording");
  }, [captureState, screen]);

  // Cancel recording without saving
  const cancelRecording = useCallback(() => {
    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Stop all recorders without saving
    [screenRecorderRef.current, micRecorderRef.current, facecamRecorderRef.current].forEach(recorder => {
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    });

    // Stop all streams
    screen.stopCapture();
    microphone.stopCapture();
    facecam.stopCapture();

    // Clear refs and state
    screenRecorderRef.current = null;
    micRecorderRef.current = null;
    facecamRecorderRef.current = null;
    screenChunksRef.current = [];
    micChunksRef.current = [];
    facecamChunksRef.current = [];

    setCaptureState("idle");
    setDuration(0);
    setError(null);
  }, [screen, microphone, facecam]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  return {
    // State
    captureState,
    isRecording,
    isPaused,
    duration,
    error: error || screen.error || microphone.error || facecam.error,
    
    // Streams
    screenStream: screen.stream,
    microphoneStream: microphone.stream,
    facecamStream: facecam.stream,
    
    // Audio level
    microphoneLevel: microphone.audioLevel,
    
    // Device management
    availableMicrophones: microphone.availableDevices,
    availableCameras: facecam.availableDevices,
    selectedMicrophone: microphone.selectedDeviceId,
    selectedCamera: facecam.selectedDeviceId,
    
    // Actions
    requestPermissions,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    selectMicrophone: microphone.selectDevice,
    selectCamera: facecam.selectDevice,
    refreshDevices,
  };
}
