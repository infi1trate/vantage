import { useState, useRef, useCallback, useEffect } from "react";
import { useScreenCapture } from "./useScreenCapture";
import { useMicrophoneCapture } from "./useMicrophoneCapture";
import { useFacecamCapture } from "./useFacecamCapture";

/**
 * EXPLICIT CAPTURE STATE MACHINE
 * 
 * States and valid transitions:
 * 
 * idle → selecting_sources (user initiates capture)
 * selecting_sources → preview_ready (all required streams acquired)
 * selecting_sources → error (permission denied or failure)
 * preview_ready → recording (user clicks start recording)
 * preview_ready → idle (user cancels)
 * recording → finalizing (user clicks end capture)
 * recording → preview_ready (user stops recording but keeps preview)
 * finalizing → saved (blobs created successfully)
 * finalizing → error (blob creation failed)
 * saved → idle (reset for new capture)
 * error → idle (user dismisses error)
 * error → selecting_sources (user retries)
 */
export type CaptureState = 
  | "idle"                  // No streams, no recording
  | "selecting_sources"     // Requesting permissions, acquiring streams
  | "preview_ready"         // Streams active, preview visible, NOT recording
  | "recording"             // MediaRecorder actively recording, timer running
  | "finalizing"            // Stop requested, waiting for recorder.onstop, building blobs
  | "saved"                 // Session persisted successfully
  | "error";                // Actionable error state

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

export interface CaptureError {
  code: "PERMISSION_DENIED" | "DEVICE_NOT_FOUND" | "RECORDING_FAILED" | "UNKNOWN";
  message: string;
  recoverable: boolean;
}

export interface UseCaptureManagerReturn {
  // State
  captureState: CaptureState;
  error: CaptureError | null;
  
  // Only valid in recording state
  duration: number;
  
  // Streams (only valid in preview_ready, recording, or finalizing)
  screenStream: MediaStream | null;
  microphoneStream: MediaStream | null;
  facecamStream: MediaStream | null;
  
  // Audio level (only valid when mic stream active)
  microphoneLevel: number;
  
  // Device management
  availableMicrophones: { deviceId: string; label: string }[];
  availableCameras: { deviceId: string; label: string }[];
  selectedMicrophone: string | null;
  selectedCamera: string | null;
  
  // Actions - each only valid in specific states
  selectSources: (config: CaptureConfig) => Promise<void>;  // idle → selecting_sources
  startRecording: () => Promise<boolean>;                    // preview_ready → recording
  stopRecording: () => Promise<RecordedData | null>;        // recording → finalizing → saved
  stopPreview: () => void;                                   // preview_ready → idle (or recording → preview_ready)
  cancelCapture: () => void;                                 // any → idle
  retryFromError: () => void;                               // error → idle
  selectMicrophone: (deviceId: string) => void;
  selectCamera: (deviceId: string) => void;
  refreshDevices: () => Promise<void>;
}

export function useCaptureManager(): UseCaptureManagerReturn {
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<CaptureError | null>(null);
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

  // Refresh all devices
  const refreshDevices = useCallback(async () => {
    await Promise.all([
      microphone.refreshDevices(),
      facecam.refreshDevices(),
    ]);
  }, [microphone, facecam]);

  // TRANSITION: idle → selecting_sources → preview_ready | error
  const selectSources = useCallback(async (captureConfig: CaptureConfig): Promise<void> => {
    if (captureState !== "idle") {
      console.warn(`selectSources called in invalid state: ${captureState}`);
      return;
    }

    setCaptureState("selecting_sources");
    setError(null);
    setConfig(captureConfig);

    try {
      // Start microphone (required)
      const micStream = await microphone.startCapture({
        deviceId: captureConfig.microphoneDeviceId,
      });
      
      if (!micStream) {
        throw {
          code: "PERMISSION_DENIED" as const,
          message: microphone.error || "Microphone access is required. Please allow microphone permissions.",
          recoverable: true,
        };
      }

      // Start screen capture (required)
      const screenStream = await screen.startCapture({
        audio: captureConfig.enableSystemAudio,
      });
      
      if (!screenStream) {
        microphone.stopCapture();
        throw {
          code: "PERMISSION_DENIED" as const,
          message: screen.error || "Screen capture is required. Please select a screen or window to share.",
          recoverable: true,
        };
      }

      // Start facecam if enabled (optional)
      if (captureConfig.enableFacecam) {
        const facecamStream = await facecam.startCapture({
          deviceId: captureConfig.facecamDeviceId,
        });
        
        if (!facecamStream) {
          console.warn("Facecam capture failed (optional):", facecam.error);
          // Don't fail - facecam is optional
        }
      }

      // SUCCESS: Transition to preview_ready
      setCaptureState("preview_ready");
    } catch (err: any) {
      console.error("Source selection failed:", err);
      
      // Clean up any partial streams
      screen.stopCapture();
      microphone.stopCapture();
      facecam.stopCapture();
      
      // Set error state
      const captureError: CaptureError = err.code ? err : {
        code: "UNKNOWN" as const,
        message: err.message || "Failed to acquire capture sources.",
        recoverable: true,
      };
      
      setError(captureError);
      setCaptureState("error");
    }
  }, [captureState, screen, microphone, facecam]);

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

  // TRANSITION: preview_ready → recording
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (captureState !== "preview_ready") {
      console.warn(`startRecording called in invalid state: ${captureState}. Must be in preview_ready.`);
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
        screenRecorderRef.current.start(1000);
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

      // Start duration timer - ONLY in recording state
      startTimeRef.current = Date.now();
      setDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 100);

      setCaptureState("recording");
      return true;
    } catch (err: any) {
      console.error("Failed to start recording:", err);
      setError({
        code: "RECORDING_FAILED",
        message: err.message || "Failed to start recording. Please try again.",
        recoverable: true,
      });
      setCaptureState("error");
      return false;
    }
  }, [captureState, screen.stream, microphone.stream, facecam.stream, createRecorder]);

  // TRANSITION: recording → finalizing → saved
  const stopRecording = useCallback(async (): Promise<RecordedData | null> => {
    if (captureState !== "recording") {
      console.warn(`stopRecording called in invalid state: ${captureState}. Must be in recording.`);
      return null;
    }

    setCaptureState("finalizing");

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

    try {
      // Stop all recorders and wait for blobs
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
      screenChunksRef.current = [];
      micChunksRef.current = [];
      facecamChunksRef.current = [];

      setCaptureState("saved");

      return {
        screenBlob,
        microphoneBlob,
        facecamBlob,
        systemAudioBlob: null,
        duration: finalDuration,
      };
    } catch (err: any) {
      console.error("Failed to finalize recording:", err);
      setError({
        code: "RECORDING_FAILED",
        message: "Failed to save recording data. Some data may be lost.",
        recoverable: false,
      });
      setCaptureState("error");
      return null;
    }
  }, [captureState, screen, microphone, facecam]);

  // TRANSITION: preview_ready → idle (stops streams without recording)
  const stopPreview = useCallback(() => {
    if (captureState !== "preview_ready") {
      console.warn(`stopPreview called in invalid state: ${captureState}. Must be in preview_ready.`);
      return;
    }

    // Stop all streams
    screen.stopCapture();
    microphone.stopCapture();
    facecam.stopCapture();

    setCaptureState("idle");
    setDuration(0);
    setError(null);
  }, [captureState, screen, microphone, facecam]);

  // TRANSITION: any → idle (hard reset)
  const cancelCapture = useCallback(() => {
    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Stop all recorders without saving
    [screenRecorderRef.current, micRecorderRef.current, facecamRecorderRef.current].forEach(recorder => {
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch (e) {
          // Ignore errors during cleanup
        }
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

  // TRANSITION: error → idle
  const retryFromError = useCallback(() => {
    if (captureState !== "error") {
      console.warn(`retryFromError called in invalid state: ${captureState}`);
      return;
    }
    
    setError(null);
    setCaptureState("idle");
  }, [captureState]);

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
    error,
    
    // Duration - only meaningful in recording state
    duration,
    
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
    selectSources,
    startRecording,
    stopRecording,
    stopPreview,
    cancelCapture,
    retryFromError,
    selectMicrophone: microphone.selectDevice,
    selectCamera: facecam.selectDevice,
    refreshDevices,
  };
}
