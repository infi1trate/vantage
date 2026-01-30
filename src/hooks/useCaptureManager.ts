import { useState, useRef, useCallback, useEffect } from "react";
import { useScreenCapture } from "./useScreenCapture";
import { useMicrophoneCapture } from "./useMicrophoneCapture";
import { useFacecamCapture } from "./useFacecamCapture";
import { useCompositeRecorder } from "./useCompositeRecorder";

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
  | "paused"                // Recording paused, timer stopped
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
  /** Single composited video with PiP and mixed audio */
  compositeBlob: Blob | null;
  /** Legacy: screen only (null when using composite) */
  screenBlob: Blob | null;
  microphoneBlob: Blob | null;
  facecamBlob: Blob | null;
  systemAudioBlob: Blob | null;
  duration: number;
}

export interface CaptureError {
  code: "PERMISSION_DENIED" | "DEVICE_NOT_FOUND" | "RECORDING_FAILED" | "MEDIARECORDER_UNSUPPORTED" | "NO_CHUNKS" | "COMPOSITING_FAILED" | "UNKNOWN";
  message: string;
  recoverable: boolean;
  details?: string;
}

export interface UseCaptureManagerReturn {
  // State
  captureState: CaptureState;
  error: CaptureError | null;
  isPaused: boolean;
  
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
  pauseRecording: () => void;                                // recording → paused
  resumeRecording: () => void;                               // paused → recording
  togglePause: () => void;                                   // toggle between recording/paused
  stopRecording: () => Promise<RecordedData | null>;        // recording/paused → finalizing → saved
  stopPreview: () => void;                                   // preview_ready → idle
  cancelCapture: () => void;                                 // any → idle
  retryFromError: () => void;                               // error → idle
  selectMicrophone: (deviceId: string) => void;
  selectCamera: (deviceId: string) => void;
  refreshDevices: () => Promise<void>;
}

// Determine best supported video mime type with fallbacks
function getSupportedVideoMimeType(): string {
  const videoTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  
  for (const type of videoTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`[MediaRecorder] Using video mime type: ${type}`);
      return type;
    }
  }
  
  console.warn("[MediaRecorder] No preferred video mime type supported, using default");
  return "";
}

// Check if MediaRecorder is supported
function isMediaRecorderSupported(): boolean {
  return typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function";
}

export function useCaptureManager(): UseCaptureManagerReturn {
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<CaptureError | null>(null);
  const [config, setConfig] = useState<CaptureConfig>({
    enableFacecam: false,
    enableSystemAudio: true,
  });
  
  // Single composite recorder ref
  const compositeRecorderRef = useRef<MediaRecorder | null>(null);
  const compositeChunksRef = useRef<Blob[]>([]);
  
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const accumulatedDurationRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track if we're actively recording (for cleanup)
  const isRecordingRef = useRef(false);

  // Use the individual capture hooks for source acquisition
  const screen = useScreenCapture();
  const microphone = useMicrophoneCapture();
  const facecam = useFacecamCapture();
  
  // Use composite recorder for canvas + audio mixing
  const composite = useCompositeRecorder();

  // Refresh all devices
  const refreshDevices = useCallback(async () => {
    await Promise.all([
      microphone.refreshDevices(),
      facecam.refreshDevices(),
    ]);
  }, [microphone, facecam]);

  // Cleanup a single recorder - nulls event handlers to prevent memory leaks
  const cleanupRecorder = useCallback((recorder: MediaRecorder | null) => {
    if (recorder) {
      try {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        recorder.onstart = null;
        recorder.onpause = null;
        recorder.onresume = null;
        
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      } catch (e) {
        console.warn("[MediaRecorder] Cleanup error:", e);
      }
    }
  }, []);

  // Full cleanup of all recorders and streams
  const fullCleanup = useCallback(() => {
    console.log("[Capture] Running full cleanup");
    
    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Cleanup composite recorder
    cleanupRecorder(compositeRecorderRef.current);
    compositeRecorderRef.current = null;
    compositeChunksRef.current = [];
    
    // Stop compositing
    composite.stopCompositing();

    // Stop all source streams
    screen.stopCapture();
    microphone.stopCapture();
    facecam.stopCapture();
    
    isRecordingRef.current = false;
  }, [screen, microphone, facecam, composite, cleanupRecorder]);

  // TRANSITION: idle → selecting_sources → preview_ready | error
  const selectSources = useCallback(async (captureConfig: CaptureConfig): Promise<void> => {
    if (captureState !== "idle") {
      console.warn(`selectSources called in invalid state: ${captureState}`);
      return;
    }

    // Check MediaRecorder support early
    if (!isMediaRecorderSupported()) {
      setError({
        code: "MEDIARECORDER_UNSUPPORTED",
        message: "Your browser doesn't support recording. Please use Chrome, Firefox, or Edge.",
        recoverable: false,
        details: "MediaRecorder API is not available",
      });
      setCaptureState("error");
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

  // TRANSITION: preview_ready → recording
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (captureState !== "preview_ready") {
      console.warn(`startRecording called in invalid state: ${captureState}. Must be in preview_ready.`);
      return false;
    }

    // Double-check MediaRecorder support
    if (!isMediaRecorderSupported()) {
      setError({
        code: "MEDIARECORDER_UNSUPPORTED",
        message: "Recording is not supported in your browser.",
        recoverable: false,
      });
      setCaptureState("error");
      return false;
    }

    if (!screen.stream) {
      setError({
        code: "RECORDING_FAILED",
        message: "No screen stream available.",
        recoverable: true,
      });
      setCaptureState("error");
      return false;
    }

    try {
      console.log("[Capture] Starting composite recording...");
      
      // Start canvas compositing with all available streams
      const compositeStream = composite.startCompositing({
        screenStream: screen.stream,
        microphoneStream: microphone.stream,
        facecamStream: facecam.stream,
        facecamPosition: { x: 0.88, y: 0.82, scale: 0.22 }, // Bottom-right PiP
        frameRate: 60,
      });
      
      if (!compositeStream) {
        throw {
          code: "COMPOSITING_FAILED" as const,
          message: "Failed to start video compositing. Please try again.",
          recoverable: true,
        };
      }
      
      console.log(`[Capture] Composite stream ready: ${compositeStream.getTracks().length} tracks`);
      
      // Create MediaRecorder for the composite stream
      const videoMimeType = getSupportedVideoMimeType();
      const options: MediaRecorderOptions = {};
      if (videoMimeType) {
        options.mimeType = videoMimeType;
      }
      
      const recorder = new MediaRecorder(compositeStream, options);
      compositeChunksRef.current = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          compositeChunksRef.current.push(event.data);
          console.log(`[Composite] Chunk received: ${event.data.size} bytes, total: ${compositeChunksRef.current.length}`);
        }
      };
      
      recorder.onerror = (event: Event) => {
        console.error("[Composite] Recorder error:", event);
      };
      
      recorder.onstart = () => {
        console.log(`[Composite] Recording started, mimeType: ${recorder.mimeType}`);
      };
      
      compositeRecorderRef.current = recorder;
      recorder.start(1000); // 1 second timeslice chunks

      // Start duration timer - ONLY runs in recording state
      startTimeRef.current = Date.now();
      setDuration(0);
      isRecordingRef.current = true;
      
      durationIntervalRef.current = setInterval(() => {
        if (isRecordingRef.current) {
          setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 100);

      setCaptureState("recording");
      console.log("[Capture] Recording started successfully (composite mode)");
      return true;
    } catch (err: any) {
      console.error("Failed to start recording:", err);
      
      // Cleanup on failure
      cleanupRecorder(compositeRecorderRef.current);
      compositeRecorderRef.current = null;
      composite.stopCompositing();
      
      const captureError: CaptureError = err.code ? err : {
        code: "RECORDING_FAILED" as const,
        message: err.message || "Failed to start recording. Please try again.",
        recoverable: true,
        details: err.toString(),
      };
      
      setError(captureError);
      setCaptureState("error");
      return false;
    }
  }, [captureState, screen.stream, microphone.stream, facecam.stream, composite, cleanupRecorder]);

  // TRANSITION: recording → paused
  const pauseRecording = useCallback(() => {
    if (captureState !== "recording") {
      console.warn(`pauseRecording called in invalid state: ${captureState}. Must be in recording.`);
      return;
    }

    const recorder = compositeRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      console.log("[Capture] Recording paused");
    }

    // Stop timer and store accumulated duration
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    accumulatedDurationRef.current = duration;
    pausedAtRef.current = Date.now();

    setCaptureState("paused");
  }, [captureState, duration]);

  // TRANSITION: paused → recording
  const resumeRecording = useCallback(() => {
    if (captureState !== "paused") {
      console.warn(`resumeRecording called in invalid state: ${captureState}. Must be in paused.`);
      return;
    }

    const recorder = compositeRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      console.log("[Capture] Recording resumed");
    }

    // Restart timer from accumulated duration
    startTimeRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      if (isRecordingRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(accumulatedDurationRef.current + elapsed);
      }
    }, 100);

    setCaptureState("recording");
  }, [captureState]);

  // Toggle between recording/paused
  const togglePause = useCallback(() => {
    if (captureState === "recording") {
      pauseRecording();
    } else if (captureState === "paused") {
      resumeRecording();
    }
  }, [captureState, pauseRecording, resumeRecording]);

  // TRANSITION: recording/paused → finalizing → saved
  const stopRecording = useCallback(async (): Promise<RecordedData | null> => {
    if (captureState !== "recording" && captureState !== "paused") {
      console.warn(`stopRecording called in invalid state: ${captureState}. Must be in recording or paused.`);
      return null;
    }

    console.log("[Capture] Stopping recording...");
    setCaptureState("finalizing");
    isRecordingRef.current = false;

    // Stop duration timer immediately
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    console.log(`[Capture] Final duration: ${finalDuration}s`);

    // Stop composite recorder and get blob
    const stopCompositeRecorder = (): Promise<Blob | null> => {
      return new Promise((resolve) => {
        const recorder = compositeRecorderRef.current;
        const chunks = compositeChunksRef.current;
        
        if (!recorder) {
          console.log("[Composite] No recorder to stop");
          resolve(null);
          return;
        }

        if (recorder.state === "inactive") {
          console.log(`[Composite] Recorder already inactive, chunks: ${chunks.length}`);
          if (chunks.length > 0) {
            const mimeType = recorder.mimeType || "video/webm";
            const blob = new Blob(chunks, { type: mimeType });
            console.log(`[Composite] Created blob from existing chunks: ${blob.size} bytes`);
            resolve(blob);
          } else {
            resolve(null);
          }
          return;
        }

        // Set up onstop handler BEFORE calling stop()
        recorder.onstop = () => {
          console.log(`[Composite] onstop fired, chunks collected: ${chunks.length}`);
          
          if (chunks.length > 0) {
            const mimeType = recorder.mimeType || "video/webm";
            const blob = new Blob(chunks, { type: mimeType });
            console.log(`[Composite] Created blob: ${blob.size} bytes, type: ${blob.type}`);
            resolve(blob);
          } else {
            console.warn("[Composite] No chunks collected!");
            resolve(null);
          }
        };

        try {
          console.log(`[Composite] Calling stop(), current state: ${recorder.state}`);
          recorder.stop();
        } catch (err) {
          console.error("[Composite] Error stopping recorder:", err);
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: "video/webm" });
            resolve(blob);
          } else {
            resolve(null);
          }
        }
      });
    };

    try {
      // Stop composite recorder and wait for blob
      console.log("[Capture] Waiting for composite recorder to stop...");
      const compositeBlob = await stopCompositeRecorder();

      console.log("[Capture] Composite recorder stopped:", {
        compositeSize: compositeBlob?.size || 0,
        chunks: compositeChunksRef.current.length,
      });

      // Validate we got the composite recording
      if (!compositeBlob || compositeBlob.size === 0) {
        throw {
          code: "NO_CHUNKS" as const,
          message: "No recording data was captured. The recording may have been too short or failed.",
          recoverable: false,
          details: `Chunks: ${compositeChunksRef.current.length}, Duration: ${finalDuration}s`,
        };
      }

      // Stop compositing (canvas animation, audio context)
      composite.stopCompositing();

      // Stop all source streams
      screen.stopCapture();
      microphone.stopCapture();
      facecam.stopCapture();

      // Cleanup recorder
      cleanupRecorder(compositeRecorderRef.current);
      compositeRecorderRef.current = null;
      compositeChunksRef.current = [];

      setCaptureState("saved");
      console.log("[Capture] Recording saved successfully (single composite file)");

      return {
        compositeBlob,
        screenBlob: null, // Using composite instead
        microphoneBlob: null,
        facecamBlob: null,
        systemAudioBlob: null,
        duration: finalDuration,
      };
    } catch (err: any) {
      console.error("Failed to finalize recording:", err);
      
      // Full cleanup on error
      fullCleanup();
      
      const captureError: CaptureError = err.code ? err : {
        code: "RECORDING_FAILED" as const,
        message: "Failed to save recording data. Some data may be lost.",
        recoverable: false,
        details: err.toString(),
      };
      
      setError(captureError);
      setCaptureState("error");
      return null;
    }
  }, [captureState, screen, microphone, facecam, composite, cleanupRecorder, fullCleanup]);

  // TRANSITION: preview_ready → idle (stops streams without recording)
  const stopPreview = useCallback(() => {
    if (captureState !== "preview_ready") {
      console.warn(`stopPreview called in invalid state: ${captureState}. Must be in preview_ready.`);
      return;
    }

    console.log("[Capture] Stopping preview");
    
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
    console.log("[Capture] Cancelling capture from state:", captureState);
    fullCleanup();
    setCaptureState("idle");
    setDuration(0);
    setError(null);
  }, [captureState, fullCleanup]);

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
      console.log("[Capture] Component unmounting, cleaning up...");
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      isRecordingRef.current = false;
    };
  }, []);

  return {
    // State
    captureState,
    error,
    isPaused: captureState === "paused",
    
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
    pauseRecording,
    resumeRecording,
    togglePause,
    stopRecording,
    stopPreview,
    cancelCapture,
    retryFromError,
    selectMicrophone: microphone.selectDevice,
    selectCamera: facecam.selectDevice,
    refreshDevices,
  };
}
