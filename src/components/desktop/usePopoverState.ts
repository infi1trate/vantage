/**
 * usePopoverState
 * 
 * State machine hook for the desktop capture popover.
 * Manages all states and transitions with mock functionality.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  PopoverState,
  PopoverConfig,
  PopoverError,
  CaptureSource,
  CaptureSourceType,
  MockWindow,
  MOCK_SOURCES,
  MOCK_MICS,
  MOCK_CAMERAS,
  RECORDING_LIMIT_SECONDS,
} from "./types";

// Extended state to include source picker, authorizing, and post-recording states
type ExtendedPopoverState = PopoverState | "selecting_source_type" | "authorizing" | "uploading" | "success";

// Post-recording sub-state for more granular control
export type PostRecordingPhase = "processing" | "uploading" | "success" | "error";

// Mock user for account display
export const MOCK_USER = {
  username: "jacob.turner",
  email: "jacob@vantage.gg",
};

export interface UsePopoverStateReturn {
  // Current state
  state: ExtendedPopoverState;
  config: PopoverConfig;
  error: PopoverError | null;
  
  // Recording state
  duration: number;
  isPaused: boolean;
  countdown: number | null;
  
  // Post-recording state
  postRecordingPhase: PostRecordingPhase | null;
  uploadProgress: number;
  
  // Selected window (for window capture)
  selectedWindow: MockWindow | null;
  
  // Auth
  username: string;
  
  // Settings
  forceUploadError: boolean;
  setForceUploadError: (value: boolean) => void;
  
  // State transitions
  authorize: () => void;
  signOut: () => void;
  selectSource: (source: CaptureSource) => void;
  selectSourceType: (type: CaptureSourceType) => void;
  selectWindow: (window: MockWindow) => void;
  openSourceTypePicker: () => void;
  closeSourceTypePicker: () => void;
  openWindowPicker: () => void;
  closeWindowPicker: () => void;
  startRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  retry: () => void;
  reset: () => void;
  
  // Post-recording actions
  openEditor: () => void;
  copyLink: () => void;
  retryUpload: () => void;
  openRecordingsFolder: () => void;
  
  // Config changes
  setMicEnabled: (enabled: boolean) => void;
  setCameraEnabled: (enabled: boolean) => void;
  setMicDevice: (deviceId: string) => void;
  setCameraDevice: (deviceId: string) => void;
  
  // Helpers
  canStartRecording: boolean;
}

export function usePopoverState(): UsePopoverStateReturn {
  // Core state
  const [state, setState] = useState<ExtendedPopoverState>("unauthorized");
  const [error, setError] = useState<PopoverError | null>(null);
  
  // Config
  const [config, setConfig] = useState<PopoverConfig>({
    micEnabled: true,
    cameraEnabled: false,
    selectedMicId: MOCK_MICS[0]?.id || null,
    selectedCameraId: MOCK_CAMERAS[0]?.id || null,
    selectedSource: MOCK_SOURCES[0],
  });
  
  // Recording state
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<MockWindow | null>(null);
  
  // Post-recording state
  const [postRecordingPhase, setPostRecordingPhase] = useState<PostRecordingPhase | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Settings
  const [forceUploadError, setForceUploadError] = useState(false);
  
  // Refs for intervals
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current);
    };
  }, []);

  // Check recording limit
  useEffect(() => {
    if (duration >= RECORDING_LIMIT_SECONDS && state === "recording") {
      stopRecording();
    }
  }, [duration, state]);

  // Authorize (mock with loading state)
  const authorize = useCallback(() => {
    setState("authorizing");
    // Simulate auth flow - 1.5s loading
    setTimeout(() => {
      setState("idle");
    }, 1500);
  }, []);

  // Sign out
  const signOut = useCallback(() => {
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    setDuration(0);
    setIsPaused(false);
    setCountdown(null);
    setState("unauthorized");
  }, []);

  // Select capture source
  const selectSource = useCallback((source: CaptureSource) => {
    setConfig(prev => ({ ...prev, selectedSource: source }));
    
    // If selecting window type but no window selected, open picker
    if (source.type === "window" && !selectedWindow) {
      setState("selecting_source");
    } else {
      setState("idle");
    }
  }, [selectedWindow]);

  // Select source type (from source type picker)
  const selectSourceType = useCallback((type: CaptureSourceType) => {
    const source = MOCK_SOURCES.find(s => s.type === type) || MOCK_SOURCES[0];
    setConfig(prev => ({ ...prev, selectedSource: source }));
    
    if (type === "window") {
      // Go to window picker
      setState("selecting_source");
    } else {
      // For screen or camera, go back to idle
      setState("idle");
    }
  }, []);

  // Open source type picker
  const openSourceTypePicker = useCallback(() => {
    setState("selecting_source_type");
  }, []);

  // Close source type picker
  const closeSourceTypePicker = useCallback(() => {
    setState("idle");
  }, []);

  // Open window picker
  const openWindowPicker = useCallback(() => {
    setState("selecting_source");
  }, []);

  // Close window picker
  const closeWindowPicker = useCallback(() => {
    setState("idle");
  }, []);

  // Select specific window
  const selectWindow = useCallback((window: MockWindow) => {
    setSelectedWindow(window);
    setConfig(prev => ({
      ...prev,
      selectedSource: { 
        id: "window", 
        type: "window", 
        name: window.name 
      },
    }));
    setState("idle");
  }, []);

  // Start recording with countdown
  const startRecording = useCallback(() => {
    setCountdown(3);
    setState("countdown");
    
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          
          // Start actual recording
          setState("recording");
          setDuration(0);
          setIsPaused(false);
          
          // Start duration counter
          durationIntervalRef.current = setInterval(() => {
            setDuration(d => d + 1);
          }, 1000);
          
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setIsPaused(true);
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    setIsPaused(false);
    durationIntervalRef.current = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
  }, []);

  // Stop recording - starts post-recording flow
  const stopRecording = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    
    // Start processing phase
    setState("processing");
    setPostRecordingPhase("processing");
    setUploadProgress(0);
    
    // Simulate processing (1.5s) -> uploading (2s with progress) -> success/error
    setTimeout(() => {
      setPostRecordingPhase("uploading");
      setState("uploading");
      
      // Simulate upload progress
      let progress = 0;
      uploadIntervalRef.current = setInterval(() => {
        progress += Math.random() * 15 + 5;
        if (progress >= 100) {
          progress = 100;
          if (uploadIntervalRef.current) {
            clearInterval(uploadIntervalRef.current);
            uploadIntervalRef.current = null;
          }
          setUploadProgress(100);
          
          // Determine success or error based on forceUploadError setting
          setTimeout(() => {
            if (forceUploadError) {
              setError({
                code: "upload_failed",
                message: "Upload failed. Please check your connection and try again.",
                recoverable: true,
              });
              setPostRecordingPhase("error");
              setState("error");
            } else {
              setPostRecordingPhase("success");
              setState("success");
            }
          }, 300);
        } else {
          setUploadProgress(Math.round(progress));
        }
      }, 200);
    }, 1500);
  }, [forceUploadError]);

  // Retry after error
  const retry = useCallback(() => {
    setError(null);
    setPostRecordingPhase(null);
    setState("idle");
    setDuration(0);
    setIsPaused(false);
    setUploadProgress(0);
  }, []);

  // Post-recording actions
  const openEditor = useCallback(() => {
    console.log("Opening editor...");
    // Reset state after opening
    setPostRecordingPhase(null);
    setState("idle");
    setDuration(0);
    setIsPaused(false);
    setUploadProgress(0);
  }, []);

  const copyLink = useCallback(() => {
    console.log("Link copied to clipboard");
  }, []);

  const retryUpload = useCallback(() => {
    // Start upload process again
    setError(null);
    setPostRecordingPhase("uploading");
    setState("uploading");
    setUploadProgress(0);
    
    let progress = 0;
    uploadIntervalRef.current = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 100) {
        progress = 100;
        if (uploadIntervalRef.current) {
          clearInterval(uploadIntervalRef.current);
          uploadIntervalRef.current = null;
        }
        setUploadProgress(100);
        
        setTimeout(() => {
          if (forceUploadError) {
            setError({
              code: "upload_failed",
              message: "Upload failed. Please check your connection and try again.",
              recoverable: true,
            });
            setPostRecordingPhase("error");
            setState("error");
          } else {
            setPostRecordingPhase("success");
            setState("success");
          }
        }, 300);
      } else {
        setUploadProgress(Math.round(progress));
      }
    }, 200);
  }, [forceUploadError]);

  const openRecordingsFolder = useCallback(() => {
    console.log("Opening recordings folder...");
  }, []);

  // Full reset
  const reset = useCallback(() => {
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    setState("unauthorized");
    setError(null);
    setDuration(0);
    setIsPaused(false);
    setCountdown(null);
    setSelectedWindow(null);
    setConfig({
      micEnabled: true,
      cameraEnabled: false,
      selectedMicId: MOCK_MICS[0]?.id || null,
      selectedCameraId: MOCK_CAMERAS[0]?.id || null,
      selectedSource: MOCK_SOURCES[0],
    });
  }, []);

  // Config setters
  const setMicEnabled = useCallback((enabled: boolean) => {
    setConfig(prev => ({ ...prev, micEnabled: enabled }));
  }, []);

  const setCameraEnabled = useCallback((enabled: boolean) => {
    setConfig(prev => ({ ...prev, cameraEnabled: enabled }));
  }, []);

  const setMicDevice = useCallback((deviceId: string) => {
    setConfig(prev => ({ ...prev, selectedMicId: deviceId }));
  }, []);

  const setCameraDevice = useCallback((deviceId: string) => {
    setConfig(prev => ({ ...prev, selectedCameraId: deviceId }));
  }, []);

  // Computed: can start recording
  const canStartRecording = 
    config.selectedSource?.type !== "window" || 
    selectedWindow !== null;

  return {
    state,
    config,
    error,
    duration,
    isPaused,
    countdown,
    postRecordingPhase,
    uploadProgress,
    selectedWindow,
    username: MOCK_USER.username,
    forceUploadError,
    setForceUploadError,
    authorize,
    signOut,
    selectSource,
    selectSourceType,
    selectWindow,
    openSourceTypePicker,
    closeSourceTypePicker,
    openWindowPicker,
    closeWindowPicker,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    retry,
    reset,
    openEditor,
    copyLink,
    retryUpload,
    openRecordingsFolder,
    setMicEnabled,
    setCameraEnabled,
    setMicDevice,
    setCameraDevice,
    canStartRecording,
  };
}
