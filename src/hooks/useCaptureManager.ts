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
  code: "PERMISSION_DENIED" | "DEVICE_NOT_FOUND" | "RECORDING_FAILED" | "MEDIARECORDER_UNSUPPORTED" | "NO_CHUNKS" | "UNKNOWN";
  message: string;
  recoverable: boolean;
  details?: string;
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

// Determine best supported audio mime type with fallbacks
function getSupportedAudioMimeType(): string {
  const audioTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  
  for (const type of audioTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`[MediaRecorder] Using audio mime type: ${type}`);
      return type;
    }
  }
  
  console.warn("[MediaRecorder] No preferred audio mime type supported, using default");
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
  
  // Recording refs - use refs to avoid stale closures in callbacks
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const facecamRecorderRef = useRef<MediaRecorder | null>(null);
  
  const screenChunksRef = useRef<Blob[]>([]);
  const micChunksRef = useRef<Blob[]>([]);
  const facecamChunksRef = useRef<Blob[]>([]);
  
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track if we're actively recording (for cleanup)
  const isRecordingRef = useRef(false);

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

  // Cleanup a single recorder - nulls event handlers to prevent memory leaks
  const cleanupRecorder = useCallback((recorder: MediaRecorder | null) => {
    if (recorder) {
      try {
        // Null out event handlers to prevent memory leaks
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

    // Cleanup recorders
    cleanupRecorder(screenRecorderRef.current);
    cleanupRecorder(micRecorderRef.current);
    cleanupRecorder(facecamRecorderRef.current);

    // Clear refs
    screenRecorderRef.current = null;
    micRecorderRef.current = null;
    facecamRecorderRef.current = null;
    
    // Clear chunk arrays
    screenChunksRef.current = [];
    micChunksRef.current = [];
    facecamChunksRef.current = [];

    // Stop all streams
    screen.stopCapture();
    microphone.stopCapture();
    facecam.stopCapture();
    
    isRecordingRef.current = false;
  }, [screen, microphone, facecam, cleanupRecorder]);

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

  // Create MediaRecorder for a stream with proper error handling
  const createRecorder = useCallback((
    stream: MediaStream,
    chunksRef: React.MutableRefObject<Blob[]>,
    mimeType: string,
    label: string
  ): MediaRecorder | null => {
    try {
      const options: MediaRecorderOptions = {};
      
      // Only set mimeType if we have a supported one
      if (mimeType) {
        options.mimeType = mimeType;
      }
      
      const recorder = new MediaRecorder(stream, options);
      
      // Clear previous chunks - never overwrite, start fresh
      chunksRef.current = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          // Push to array, never overwrite
          chunksRef.current.push(event.data);
          console.log(`[${label}] Chunk received: ${event.data.size} bytes, total chunks: ${chunksRef.current.length}`);
        }
      };
      
      recorder.onerror = (event: Event) => {
        console.error(`[${label}] Recorder error:`, event);
      };
      
      recorder.onstart = () => {
        console.log(`[${label}] Recording started, state: ${recorder.state}, mimeType: ${recorder.mimeType}`);
      };
      
      return recorder;
    } catch (err) {
      console.error(`[${label}] Failed to create MediaRecorder:`, err);
      return null;
    }
  }, []);

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

    try {
      const videoMimeType = getSupportedVideoMimeType();
      const audioMimeType = getSupportedAudioMimeType();
      
      let hasScreenRecorder = false;

      // Create screen recorder (required)
      if (screen.stream) {
        const recorder = createRecorder(screen.stream, screenChunksRef, videoMimeType, "Screen");
        if (recorder) {
          screenRecorderRef.current = recorder;
          recorder.start(1000); // 1 second timeslice chunks
          hasScreenRecorder = true;
          console.log("[Screen] Started with timeslice=1000ms");
        } else {
          throw new Error("Failed to create screen recorder");
        }
      } else {
        throw new Error("No screen stream available");
      }

      // Create microphone recorder (optional but expected)
      if (microphone.stream) {
        const recorder = createRecorder(microphone.stream, micChunksRef, audioMimeType, "Microphone");
        if (recorder) {
          micRecorderRef.current = recorder;
          recorder.start(1000); // 1 second timeslice chunks
          console.log("[Microphone] Started with timeslice=1000ms");
        } else {
          console.warn("Failed to create microphone recorder, continuing without it");
        }
      }

      // Create facecam recorder if available (optional)
      if (facecam.stream) {
        const recorder = createRecorder(facecam.stream, facecamChunksRef, videoMimeType, "Facecam");
        if (recorder) {
          facecamRecorderRef.current = recorder;
          recorder.start(1000); // 1 second timeslice chunks
          console.log("[Facecam] Started with timeslice=1000ms");
        } else {
          console.warn("Failed to create facecam recorder, continuing without it");
        }
      }

      if (!hasScreenRecorder) {
        throw new Error("Screen recorder is required but could not be created");
      }

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
      console.log("[Capture] Recording started successfully");
      return true;
    } catch (err: any) {
      console.error("Failed to start recording:", err);
      
      // Cleanup any partially created recorders
      cleanupRecorder(screenRecorderRef.current);
      cleanupRecorder(micRecorderRef.current);
      cleanupRecorder(facecamRecorderRef.current);
      screenRecorderRef.current = null;
      micRecorderRef.current = null;
      facecamRecorderRef.current = null;
      
      setError({
        code: "RECORDING_FAILED",
        message: err.message || "Failed to start recording. Please try again.",
        recoverable: true,
        details: err.toString(),
      });
      setCaptureState("error");
      return false;
    }
  }, [captureState, screen.stream, microphone.stream, facecam.stream, createRecorder, cleanupRecorder]);

  // TRANSITION: recording → finalizing → saved
  const stopRecording = useCallback(async (): Promise<RecordedData | null> => {
    if (captureState !== "recording") {
      console.warn(`stopRecording called in invalid state: ${captureState}. Must be in recording.`);
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

    // Helper to stop recorder and await onstop, then create blob
    const stopRecorderAndGetBlob = (
      recorder: MediaRecorder | null,
      chunks: Blob[],
      label: string
    ): Promise<Blob | null> => {
      return new Promise((resolve) => {
        if (!recorder) {
          console.log(`[${label}] No recorder to stop`);
          resolve(null);
          return;
        }

        if (recorder.state === "inactive") {
          console.log(`[${label}] Recorder already inactive, chunks: ${chunks.length}`);
          if (chunks.length > 0) {
            const mimeType = recorder.mimeType || "video/webm";
            const blob = new Blob(chunks, { type: mimeType });
            console.log(`[${label}] Created blob from existing chunks: ${blob.size} bytes`);
            resolve(blob);
          } else {
            resolve(null);
          }
          return;
        }

        // Set up onstop handler BEFORE calling stop()
        recorder.onstop = () => {
          console.log(`[${label}] onstop fired, chunks collected: ${chunks.length}`);
          
          if (chunks.length > 0) {
            const mimeType = recorder.mimeType || "video/webm";
            const blob = new Blob(chunks, { type: mimeType });
            console.log(`[${label}] Created blob: ${blob.size} bytes, type: ${blob.type}`);
            resolve(blob);
          } else {
            console.warn(`[${label}] No chunks collected!`);
            resolve(null);
          }
        };

        try {
          console.log(`[${label}] Calling stop(), current state: ${recorder.state}`);
          recorder.stop();
        } catch (err) {
          console.error(`[${label}] Error stopping recorder:`, err);
          // Still try to create blob from existing chunks
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
      // Stop all recorders and wait for onstop callbacks
      console.log("[Capture] Waiting for all recorders to stop...");
      const [screenBlob, microphoneBlob, facecamBlob] = await Promise.all([
        stopRecorderAndGetBlob(screenRecorderRef.current, screenChunksRef.current, "Screen"),
        stopRecorderAndGetBlob(micRecorderRef.current, micChunksRef.current, "Microphone"),
        stopRecorderAndGetBlob(facecamRecorderRef.current, facecamChunksRef.current, "Facecam"),
      ]);

      console.log("[Capture] All recorders stopped:", {
        screen: screenBlob?.size || 0,
        microphone: microphoneBlob?.size || 0,
        facecam: facecamBlob?.size || 0,
      });

      // Validate we got at least the screen recording
      if (!screenBlob || screenBlob.size === 0) {
        throw {
          code: "NO_CHUNKS" as const,
          message: "No screen recording data was captured. The recording may have been too short or failed.",
          recoverable: false,
          details: `Screen chunks: ${screenChunksRef.current.length}, Duration: ${finalDuration}s`,
        };
      }

      // Stop all streams (stop tracks)
      screen.stopCapture();
      microphone.stopCapture();
      facecam.stopCapture();

      // Cleanup recorders - null event handlers to prevent memory leaks
      cleanupRecorder(screenRecorderRef.current);
      cleanupRecorder(micRecorderRef.current);
      cleanupRecorder(facecamRecorderRef.current);

      // Clear all refs
      screenRecorderRef.current = null;
      micRecorderRef.current = null;
      facecamRecorderRef.current = null;
      screenChunksRef.current = [];
      micChunksRef.current = [];
      facecamChunksRef.current = [];

      setCaptureState("saved");
      console.log("[Capture] Recording saved successfully");

      return {
        screenBlob,
        microphoneBlob,
        facecamBlob,
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
  }, [captureState, screen, microphone, facecam, cleanupRecorder, fullCleanup]);

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
