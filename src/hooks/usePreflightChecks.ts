import { useState, useCallback, useEffect, useMemo } from "react";
import { chooseRecordingMimeType } from "@/lib/recordingMimeTypes";

export type PreflightCheckId =
  | "secure_context"
  | "display_stream"
  | "mic_permission"
  | "webcam_permission"
  | "recorder_support";

export type PreflightStatus = "pending" | "checking" | "passed" | "failed";

export interface PreflightCheck {
  id: PreflightCheckId;
  label: string;
  status: PreflightStatus;
  fix?: string;
  required: boolean;
}

export interface UsePreflightChecksOptions {
  screenStream: MediaStream | null;
  microphoneStream: MediaStream | null;
  facecamStream: MediaStream | null;
  micRequired: boolean;
  webcamEnabled: boolean;
}

export interface UsePreflightChecksReturn {
  checks: PreflightCheck[];
  allPassed: boolean;
  runChecks: () => void;
  isRunning: boolean;
}

export function usePreflightChecks({
  screenStream,
  microphoneStream,
  facecamStream,
  micRequired,
  webcamEnabled,
}: UsePreflightChecksOptions): UsePreflightChecksReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [checkResults, setCheckResults] = useState<Record<PreflightCheckId, { status: PreflightStatus; fix?: string }>>({
    secure_context: { status: "pending" },
    display_stream: { status: "pending" },
    mic_permission: { status: "pending" },
    webcam_permission: { status: "pending" },
    recorder_support: { status: "pending" },
  });

  const runChecks = useCallback(() => {
    setIsRunning(true);
    
    const results: Record<PreflightCheckId, { status: PreflightStatus; fix?: string }> = {
      secure_context: { status: "checking" },
      display_stream: { status: "checking" },
      mic_permission: { status: "checking" },
      webcam_permission: { status: "checking" },
      recorder_support: { status: "checking" },
    };
    
    // 1. Secure context check
    if (window.isSecureContext) {
      results.secure_context = { status: "passed" };
    } else {
      results.secure_context = { 
        status: "failed", 
        fix: "Access this page via HTTPS or localhost" 
      };
    }
    
    // 2. Display stream check
    if (screenStream) {
      const videoTracks = screenStream.getVideoTracks();
      const hasLiveVideoTrack = videoTracks.some(track => track.readyState === "live");
      if (hasLiveVideoTrack) {
        results.display_stream = { status: "passed" };
      } else {
        results.display_stream = { 
          status: "failed", 
          fix: "Screen share stopped. Re-select your screen or window." 
        };
      }
    } else {
      results.display_stream = { 
        status: "failed", 
        fix: "No screen stream. Select a screen or window to share." 
      };
    }
    
    // 3. Mic permission check (if required)
    if (micRequired) {
      if (microphoneStream) {
        const audioTracks = microphoneStream.getAudioTracks();
        const hasLiveAudioTrack = audioTracks.some(track => track.readyState === "live");
        if (hasLiveAudioTrack) {
          results.mic_permission = { status: "passed" };
        } else {
          results.mic_permission = { 
            status: "failed", 
            fix: "Microphone stopped. Reconnect your microphone." 
          };
        }
      } else {
        results.mic_permission = { 
          status: "failed", 
          fix: "No microphone detected. Allow mic access or connect a microphone." 
        };
      }
    } else {
      results.mic_permission = { status: "passed" }; // Not required, auto-pass
    }
    
    // 4. Webcam check (if enabled)
    if (webcamEnabled) {
      if (facecamStream) {
        const videoTracks = facecamStream.getVideoTracks();
        const hasLiveVideoTrack = videoTracks.some(track => track.readyState === "live");
        if (hasLiveVideoTrack) {
          results.webcam_permission = { status: "passed" };
        } else {
          results.webcam_permission = { 
            status: "failed", 
            fix: "Webcam stopped. Reconnect your camera." 
          };
        }
      } else {
        results.webcam_permission = { 
          status: "failed", 
          fix: "No webcam detected. Allow camera access or connect a webcam." 
        };
      }
    } else {
      results.webcam_permission = { status: "passed" }; // Not enabled, auto-pass
    }
    
    // 5. Recorder support check
    if (typeof MediaRecorder === "undefined") {
      results.recorder_support = { 
        status: "failed", 
        fix: "Your browser doesn't support recording. Use Chrome, Firefox, or Edge." 
      };
    } else {
      const mimeTypeInfo = chooseRecordingMimeType();
      if (mimeTypeInfo) {
        results.recorder_support = { status: "passed" };
      } else {
        results.recorder_support = { 
          status: "failed", 
          fix: "No compatible recording format. Update your browser or try Chrome." 
        };
      }
    }
    
    setCheckResults(results);
    setIsRunning(false);
  }, [screenStream, microphoneStream, facecamStream, micRequired, webcamEnabled]);

  // Auto-run checks when streams change
  useEffect(() => {
    // Only run if we have at least one stream (meaning preflight is relevant)
    if (screenStream || microphoneStream || facecamStream) {
      runChecks();
    }
  }, [screenStream, microphoneStream, facecamStream, runChecks]);

  const checks = useMemo<PreflightCheck[]>(() => {
    const allChecks: PreflightCheck[] = [
      {
        id: "secure_context",
        label: "Secure context (HTTPS)",
        status: checkResults.secure_context.status,
        fix: checkResults.secure_context.fix,
        required: true,
      },
      {
        id: "display_stream",
        label: "Screen capture active",
        status: checkResults.display_stream.status,
        fix: checkResults.display_stream.fix,
        required: true,
      },
      {
        id: "mic_permission",
        label: "Microphone ready",
        status: checkResults.mic_permission.status,
        fix: checkResults.mic_permission.fix,
        required: micRequired,
      },
      {
        id: "recorder_support",
        label: "Recording format supported",
        status: checkResults.recorder_support.status,
        fix: checkResults.recorder_support.fix,
        required: true,
      },
    ];
    
    // Only include webcam check if enabled
    if (webcamEnabled) {
      allChecks.splice(3, 0, {
        id: "webcam_permission",
        label: "Webcam ready",
        status: checkResults.webcam_permission.status,
        fix: checkResults.webcam_permission.fix,
        required: true,
      });
    }
    
    return allChecks;
  }, [checkResults, micRequired, webcamEnabled]);

  const allPassed = useMemo(() => {
    return checks.every(check => 
      check.status === "passed" || (!check.required && check.status !== "failed")
    );
  }, [checks]);

  return {
    checks,
    allPassed,
    runChecks,
    isRunning,
  };
}
