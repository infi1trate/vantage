/**
 * usePopoverState
 * 
 * State machine hook for the desktop capture popover.
 * Manages all states and transitions with mock functionality.
 * 
 * When running in Electron (window.vantage exists), actions delegate
 * to the bridge and state is driven from Electron via onState.
 * In browser, falls back to existing stubbed behavior.
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
  MOCK_WINDOWS,
  RECORDING_LIMIT_SECONDS,
} from "./types";
import {
  isElectronContext,
  subscribeToState as bridgeSubscribe,
  startRecording as bridgeStartRecording,
  pauseRecording as bridgePauseRecording,
  resumeRecording as bridgeResumeRecording,
  stopRecording as bridgeStopRecording,
  selectSource as bridgeSelectSource,
  listSources as bridgeListSources,
  ping as bridgePing,
  setCameraEnabled as bridgeSetCameraEnabled,
  setMicEnabled as bridgeSetMicEnabled,
  type VantageState,
  type VantageSource,
} from "@/lib/desktopBridge";
import { toast } from "sonner";

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
  
  // Available sources from Electron (or mock)
  availableSources: MockWindow[];
  isLoadingSources: boolean;
  
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

interface UsePopoverStateOptions {
  /** If true, start in idle state (authenticated context) instead of unauthorized */
  startAuthenticated?: boolean;
}

export function usePopoverState(options: UsePopoverStateOptions = {}): UsePopoverStateReturn {
  const { startAuthenticated = false } = options;
  
  // Track if we're in Electron context
  const [isElectron, setIsElectron] = useState(false);
  
  // Core state - start authenticated goes straight to idle
  const [state, setState] = useState<ExtendedPopoverState>(
    startAuthenticated ? "idle" : "unauthorized"
  );
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
  
  // Available sources (from Electron or mock)
  const [availableSources, setAvailableSources] = useState<MockWindow[]>(MOCK_WINDOWS);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  
  // Settings
  const [forceUploadError, setForceUploadError] = useState(false);
  
  // Refs for intervals
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check for Electron context on mount and subscribe to state
  useEffect(() => {
    const inElectron = isElectronContext();
    setIsElectron(inElectron);
    
    if (inElectron) {
      console.log("[usePopoverState] Running in Electron context");
      
      // Ping to verify connection
      bridgePing().then((result) => {
        if (result) {
          console.log("[usePopoverState] Electron bridge version:", result.version);
        }
      });
      
      // Subscribe to state updates from Electron
      const unsubscribe = bridgeSubscribe((electronState: VantageState) => {
        console.log("[usePopoverState] Electron state update:", electronState);
        
        // Map Electron state to popover state
        // "picking_source" from Electron maps to "selecting_source" in UI
        const mappedState = electronState.state === "picking_source" 
          ? "selecting_source" 
          : electronState.state;
        setState(mappedState as ExtendedPopoverState);
        
        if (electronState.duration !== undefined) {
          setDuration(electronState.duration);
        }
        if (electronState.countdown !== undefined) {
          setCountdown(electronState.countdown);
        }
        if (electronState.uploadProgress !== undefined) {
          setUploadProgress(electronState.uploadProgress);
        }
        if (electronState.error) {
          // Map Electron error codes to our known types, default to "unknown"
          const knownCodes = ["permission_denied", "source_lost", "upload_failed", "unknown"] as const;
          const errorCode = knownCodes.includes(electronState.error.code as typeof knownCodes[number])
            ? (electronState.error.code as PopoverError["code"])
            : "unknown";
          
          setError({
            code: errorCode,
            message: electronState.error.message,
            recoverable: true,
          });
        } else {
          setError(null);
        }
        
        // Update selected source from Electron
        if (electronState.selectedSource) {
          setSelectedWindow({
            id: electronState.selectedSource.id,
            name: electronState.selectedSource.name,
            appName: electronState.selectedSource.name.split(' – ')[0] || electronState.selectedSource.name,
            thumbnail: electronState.selectedSource.thumbnail || '',
          });
        }
        
        // Update paused state
        setIsPaused(electronState.state === "paused");
        
        // Sync camera/mic state from Electron
        if (electronState.cameraEnabled !== undefined) {
          setConfig(prev => ({ ...prev, cameraEnabled: electronState.cameraEnabled! }));
        }
        if (electronState.micEnabled !== undefined) {
          setConfig(prev => ({ ...prev, micEnabled: electronState.micEnabled! }));
        }
        
        // Update post-recording phase
        if (["processing", "uploading", "success", "error"].includes(electronState.state)) {
          setPostRecordingPhase(electronState.state as PostRecordingPhase);
        } else {
          setPostRecordingPhase(null);
        }
      });
      
      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    } else {
      console.log("[usePopoverState] Running in browser context (stubbed)");
    }
  }, []);

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

  // Open window picker - fetch sources from Electron if available
  const openWindowPicker = useCallback(async () => {
    setState("selecting_source");
    
    // If in Electron, fetch real sources
    if (isElectron) {
      setIsLoadingSources(true);
      console.log("[usePopoverState] Fetching sources from Electron");
      
      try {
        const sources = await bridgeListSources();
        console.log("[usePopoverState] Received sources:", sources);
        
        // Convert VantageSource to MockWindow format for UI compatibility
        const adaptedSources: MockWindow[] = sources.map((source: VantageSource) => ({
          id: source.id,
          name: source.name,
          appName: source.name.split(' – ')[0] || source.name, // Extract app name from window title
          thumbnail: source.thumbnail || '',
        }));
        
        setAvailableSources(adaptedSources);
      } catch (error) {
        console.error("[usePopoverState] Failed to fetch sources:", error);
        // Keep existing sources on error
      } finally {
        setIsLoadingSources(false);
      }
    }
  }, [isElectron]);

  // Close window picker
  const closeWindowPicker = useCallback(() => {
    setState("idle");
  }, []);

  // Select specific window
  const selectWindow = useCallback(async (window: MockWindow) => {
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
    
    // If in Electron, also notify the bridge
    if (isElectron) {
      console.log("[usePopoverState] Calling bridge.selectSource:", window.id);
      await bridgeSelectSource(window.id);
    }
  }, [isElectron]);

  // Start recording with countdown
  const startRecording = useCallback(async () => {
    // If in Electron, delegate to bridge
    if (isElectron) {
      console.log("[usePopoverState] Calling bridge.startRecording");
      await bridgeStartRecording();
      return;
    }
    
    // Browser stub: local countdown and state machine
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
  }, [isElectron]);

  // Pause recording
  const pauseRecording = useCallback(async () => {
    // If in Electron, delegate to bridge
    if (isElectron) {
      console.log("[usePopoverState] Calling bridge.pauseRecording");
      await bridgePauseRecording();
      return;
    }
    
    // Browser stub
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setIsPaused(true);
  }, [isElectron]);

  // Resume recording
  const resumeRecording = useCallback(async () => {
    // If in Electron, delegate to bridge
    if (isElectron) {
      console.log("[usePopoverState] Calling bridge.resumeRecording");
      await bridgeResumeRecording();
      return;
    }
    
    // Browser stub
    setIsPaused(false);
    durationIntervalRef.current = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
  }, [isElectron]);

  // Stop recording - starts post-recording flow
  const stopRecording = useCallback(async () => {
    // If in Electron, delegate to bridge
    if (isElectron) {
      console.log("[usePopoverState] Calling bridge.stopRecording");
      await bridgeStopRecording();
      return;
    }
    
    // Browser stub: clean up intervals and start post-recording flow
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
  }, [isElectron, forceUploadError]);

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

  // Config setters - with Electron bridge integration
  const setMicEnabled = useCallback(async (enabled: boolean) => {
    // Optimistically update UI
    setConfig(prev => ({ ...prev, micEnabled: enabled }));
    
    // If in Electron, delegate to bridge
    if (isElectron) {
      try {
        await bridgeSetMicEnabled(enabled);
      } catch (error: any) {
        // Revert on error
        setConfig(prev => ({ ...prev, micEnabled: !enabled }));
        
        // Check for permission error
        if (error?.code === "permission_denied" || error?.message?.includes("permission")) {
          toast.error("Microphone access denied", {
            description: "Please grant microphone permission in System Preferences.",
          });
        } else {
          toast.error("Failed to toggle microphone", {
            description: error?.message || "An unexpected error occurred.",
          });
        }
      }
    }
  }, [isElectron]);

  const setCameraEnabled = useCallback(async (enabled: boolean) => {
    // Optimistically update UI
    setConfig(prev => ({ ...prev, cameraEnabled: enabled }));
    
    // If in Electron, delegate to bridge
    if (isElectron) {
      try {
        await bridgeSetCameraEnabled(enabled);
      } catch (error: any) {
        // Revert on error
        setConfig(prev => ({ ...prev, cameraEnabled: !enabled }));
        
        // Check for permission error
        if (error?.code === "permission_denied" || error?.message?.includes("permission")) {
          toast.error("Camera access denied", {
            description: "Please grant camera permission in System Preferences.",
          });
        } else {
          toast.error("Failed to toggle camera", {
            description: error?.message || "An unexpected error occurred.",
          });
        }
      }
    }
  }, [isElectron]);

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
    availableSources,
    isLoadingSources,
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
