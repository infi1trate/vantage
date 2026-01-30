import { useState, useRef, useCallback, useEffect } from "react";
import { useScreenCapture } from "./useScreenCapture";
import { useMicrophoneCapture } from "./useMicrophoneCapture";
import { useFacecamCapture } from "./useFacecamCapture";
import { useCompositeRecorder } from "./useCompositeRecorder";
import { chooseRecordingMimeType, type RecordingMimeTypeInfo } from "@/lib/recordingMimeTypes";
import { type CaptureError, type CaptureErrorCode, parseMediaError, createNoDataError, createRecorderError } from "@/lib/captureErrors";

/**
 * EXPLICIT CAPTURE STATE MACHINE
 * 
 * States and valid transitions:
 * 
 * idle → selecting_sources (user initiates capture)
 * selecting_sources → preview_ready (all required streams acquired)
 * selecting_sources → error (permission denied or failure)
 * preview_ready → starting (user clicks start recording, waiting for data)
 * preview_ready → idle (user cancels)
 * starting → recording (first data chunk received from MediaRecorder)
 * starting → error (timeout waiting for data, or recorder error)
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
  | "starting"              // MediaRecorder started, waiting for first data chunk
  | "recording"             // MediaRecorder actively producing data, timer running
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

/** Debug indicator of what stream was actually recorded */
export type RecordedSourceType = "composed" | "screenOnly" | "unknown";

export interface RecordedData {
  /** Single composited video with PiP and mixed audio */
  compositeBlob: Blob | null;
  /** MIME type of the composite blob (e.g., "video/webm;codecs=vp9,opus") */
  compositeMimeType: string | null;
  /** File extension based on MIME type */
  fileExt: "mp4" | "webm";
  /** Human-readable codec label */
  codecsLabel: string;
  /** Simplified browser identifier */
  browserLabel: string;
  /** Debug: What stream source was used for the recording */
  recordedSource: RecordedSourceType;
  /** Legacy: screen only (null when using composite) */
  screenBlob: Blob | null;
  microphoneBlob: Blob | null;
  facecamBlob: Blob | null;
  systemAudioBlob: Blob | null;
  duration: number;
}

// Re-export CaptureError type for consumers
export type { CaptureError, CaptureErrorCode } from "@/lib/captureErrors";

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
  
  // Thumbnail capture (only valid during recording/paused states)
  captureThumbnail: () => string | null;
  captureThumbnailBlob: () => Promise<Blob | null>;
  
  // Config info for saving
  captureConfig: { hasCam: boolean; hasMic: boolean; hasSystemAudio: boolean };
  
  // Debug info (for diagnostics panel)
  debugInfo: {
    recorderState: RecordingState | null;
    chunksCount: number;
    totalBytes: number;
    mimeTypeInfo: RecordingMimeTypeInfo | null;
  };
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
  
  // Debug state for diagnostics panel
  const [debugChunksCount, setDebugChunksCount] = useState(0);
  const [debugTotalBytes, setDebugTotalBytes] = useState(0);
  const [mimeTypeInfo, setMimeTypeInfo] = useState<RecordingMimeTypeInfo | null>(null);
  
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
        code: "RECORDER_UNSUPPORTED",
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
        // Use the parsed error from the hook if available
        throw microphone.captureError || {
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
        // Use the parsed error from the hook if available
        throw screen.captureError || {
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
        code: "RECORDER_UNSUPPORTED",
        message: "Recording is not supported in your browser.",
        recoverable: false,
      });
      setCaptureState("error");
      return false;
    }

    if (!screen.stream) {
      setError({
        code: "STREAM_ENDED",
        message: "No screen stream available. The screen share may have ended.",
        recoverable: true,
      });
      setCaptureState("error");
      return false;
    }

    try {
      console.log("[Capture] Starting composite recording...");
      
      // Check for compatible MIME type FIRST
      const selectedMimeType = chooseRecordingMimeType();
      
      if (!selectedMimeType) {
        throw {
          code: "NO_COMPATIBLE_FORMAT" as const,
          message: "This browser can't record a playable format. Use Chrome.",
          recoverable: false,
          details: "No MIME type supported by both MediaRecorder and HTMLVideoElement",
        };
      }
      
      // Store for debug/diagnostics
      setMimeTypeInfo(selectedMimeType);
      console.log(`[Capture] Selected MIME type: ${selectedMimeType.mimeType} (${selectedMimeType.codecsLabel})`);
      
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
      
      // Create MediaRecorder with the selected compatible MIME type
      const options: MediaRecorderOptions = {
        mimeType: selectedMimeType.mimeType,
      };
      
      const recorder = new MediaRecorder(compositeStream, options);
      compositeChunksRef.current = [];
      setDebugChunksCount(0);
      setDebugTotalBytes(0);
      
      // Set to "starting" state - waiting for first chunk
      setCaptureState("starting");
      console.log("[Capture] Recorder created, waiting for first data chunk...");
      
      // Promise that resolves when we get the first valid chunk
      const waitForFirstChunk = new Promise<boolean>((resolve, reject) => {
        let firstChunkReceived = false;
        const startTime = Date.now();
        const TIMEOUT_MS = 2500; // 2.5 second timeout
        
        // Check for timeout
        const timeoutId = setTimeout(() => {
          if (!firstChunkReceived) {
            console.error("[Capture] Timeout: No data received within 2.5 seconds");
            reject({
              code: "NO_DATA_CAPTURED" as const,
              message: "Recording failed to produce data. Your browser may not support this recording format.",
              recoverable: true,
              details: `Timeout after ${TIMEOUT_MS}ms. Recorder state: ${recorder.state}, MIME: ${selectedMimeType.mimeType}`,
            });
          }
        }, TIMEOUT_MS);
        
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            compositeChunksRef.current.push(event.data);
            setDebugChunksCount(compositeChunksRef.current.length);
            setDebugTotalBytes(prev => prev + event.data.size);
            console.log(`[Composite] Chunk received: ${event.data.size} bytes, total: ${compositeChunksRef.current.length}`);
            
            // First valid chunk received - resolve promise
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              clearTimeout(timeoutId);
              console.log(`[Capture] First chunk received after ${Date.now() - startTime}ms`);
              resolve(true);
            }
          }
        };
        
        recorder.onerror = (event: Event) => {
          console.error("[Composite] Recorder error:", event);
          clearTimeout(timeoutId);
          reject({
            code: "RECORDER_ERROR" as const,
            message: "MediaRecorder encountered an error.",
            recoverable: false,
            details: `Error event: ${JSON.stringify(event)}`,
          });
        };
        
        recorder.onstart = () => {
          console.log(`[Composite] Recorder started, state: ${recorder.state}, mimeType: ${recorder.mimeType}`);
        };
      });
      
      compositeRecorderRef.current = recorder;
      recorder.start(1000); // 1 second timeslice chunks
      
      // Wait for first chunk before transitioning to "recording" state
      await waitForFirstChunk;
      
      // Verify recorder is still in recording state
      if (recorder.state !== "recording") {
        throw {
          code: "RECORDER_ERROR" as const,
          message: "Recorder stopped unexpectedly before data was captured.",
          recoverable: true,
          details: `Recorder state: ${recorder.state}`,
        };
      }

      // NOW we can safely say we're recording
      startTimeRef.current = Date.now();
      setDuration(0);
      isRecordingRef.current = true;
      
      durationIntervalRef.current = setInterval(() => {
        if (isRecordingRef.current) {
          setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 100);

      setCaptureState("recording");
      console.log("[Capture] Recording confirmed - MediaRecorder is producing data");
      return true;
    } catch (err: any) {
      console.error("Failed to start recording:", err);
      
      // Cleanup on failure
      cleanupRecorder(compositeRecorderRef.current);
      compositeRecorderRef.current = null;
      composite.stopCompositing();
      
      const captureError: CaptureError = err.code ? err : {
        code: "RECORDER_ERROR" as const,
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

    // Stop composite recorder and get blob with mimeType
    const stopCompositeRecorder = (): Promise<{ blob: Blob | null; mimeType: string }> => {
      return new Promise((resolve) => {
        const recorder = compositeRecorderRef.current;
        const chunks = compositeChunksRef.current;
        
        // Fallback mime type order
        const getFallbackMimeType = (): string => {
          const fallbacks = [
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm",
          ];
          for (const type of fallbacks) {
            if (MediaRecorder.isTypeSupported(type)) {
              return type;
            }
          }
          return "video/webm";
        };
        
        if (!recorder) {
          console.log("[Composite] No recorder to stop");
          resolve({ blob: null, mimeType: getFallbackMimeType() });
          return;
        }

        // Get mimeType from recorder (most reliable source)
        const recorderMimeType = recorder.mimeType || getFallbackMimeType();
        console.log(`[Composite] Recorder mimeType: ${recorderMimeType}`);

        if (recorder.state === "inactive") {
          console.log(`[Composite] Recorder already inactive, chunks: ${chunks.length}`);
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: recorderMimeType });
            console.log(`[Composite] Created blob from existing chunks: ${blob.size} bytes, type: ${blob.type}`);
            resolve({ blob, mimeType: recorderMimeType });
          } else {
            resolve({ blob: null, mimeType: recorderMimeType });
          }
          return;
        }

        // Set up onstop handler BEFORE calling stop()
        recorder.onstop = () => {
          console.log(`[Composite] onstop fired, chunks collected: ${chunks.length}`);
          
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: recorderMimeType });
            console.log(`[Composite] Created blob: ${blob.size} bytes, type: ${blob.type}`);
            resolve({ blob, mimeType: recorderMimeType });
          } else {
            console.warn("[Composite] No chunks collected!");
            resolve({ blob: null, mimeType: recorderMimeType });
          }
        };

        try {
          console.log(`[Composite] Calling stop(), current state: ${recorder.state}`);
          recorder.stop();
        } catch (err) {
          console.error("[Composite] Error stopping recorder:", err);
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: recorderMimeType });
            resolve({ blob, mimeType: recorderMimeType });
          } else {
            resolve({ blob: null, mimeType: recorderMimeType });
          }
        }
      });
    };

    try {
      // Stop composite recorder and wait for blob + mimeType
      console.log("[Capture] Waiting for composite recorder to stop...");
      const { blob: compositeBlob, mimeType: compositeMimeType } = await stopCompositeRecorder();

      console.log("[Capture] Composite recorder stopped:", {
        compositeSize: compositeBlob?.size || 0,
        compositeMimeType,
        chunks: compositeChunksRef.current.length,
      });

      // Validate we got enough data - require chunks >= 2 OR totalBytes > 50KB
      const totalBytes = compositeChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
      const chunksCount = compositeChunksRef.current.length;
      const MIN_CHUNKS = 2;
      const MIN_BYTES = 50 * 1024; // 50KB
      
      console.log(`[Capture] Validation: chunks=${chunksCount}, totalBytes=${totalBytes}, duration=${finalDuration}s`);
      
      if (!compositeBlob || compositeBlob.size === 0) {
        throw {
          code: "NO_DATA_CAPTURED" as const,
          message: "No recording data was captured. The recording may have been too short or failed.",
          recoverable: false,
          details: `Chunks: ${chunksCount}, Bytes: ${totalBytes}, Duration: ${finalDuration}s`,
        };
      }
      
      // Require at least 2 chunks OR 50KB of data
      if (chunksCount < MIN_CHUNKS && totalBytes < MIN_BYTES) {
        throw {
          code: "NO_DATA_CAPTURED" as const,
          message: "Recording is too short or incomplete. Please record for at least a few seconds.",
          recoverable: false,
          details: `Chunks: ${chunksCount} (need ${MIN_CHUNKS}+), Bytes: ${totalBytes} (need ${MIN_BYTES}+), Duration: ${finalDuration}s`,
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
        compositeMimeType,
        fileExt: mimeTypeInfo?.fileExt || (compositeMimeType?.startsWith("video/mp4") ? "mp4" : "webm"),
        codecsLabel: mimeTypeInfo?.codecsLabel || "Unknown",
        browserLabel: mimeTypeInfo?.browserLabel || navigator.userAgent.substring(0, 50),
        recordedSource: "composed" as const, // This blob came from the composed canvas stream
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
        code: "RECORDER_ERROR" as const,
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
    
    // Thumbnail capture
    captureThumbnail: composite.captureThumbnail,
    captureThumbnailBlob: composite.captureThumbnailBlob,
    
    // Config info
    captureConfig: {
      hasCam: config.enableFacecam && facecam.stream !== null,
      hasMic: microphone.stream !== null,
      hasSystemAudio: config.enableSystemAudio,
    },
    
    // Debug info for diagnostics panel
    debugInfo: {
      recorderState: compositeRecorderRef.current?.state || null,
      chunksCount: debugChunksCount,
      totalBytes: debugTotalBytes,
      mimeTypeInfo,
    },
  };
}
