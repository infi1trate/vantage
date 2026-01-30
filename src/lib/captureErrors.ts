/**
 * Explicit capture error types and their corresponding UI messages
 */

export type CaptureErrorCode =
  | "PERMISSION_DENIED"
  | "DEVICE_IN_USE"
  | "INSECURE_CONTEXT"
  | "NO_AUDIO_TRACK"
  | "RECORDER_UNSUPPORTED"
  | "RECORDER_ERROR"
  | "NO_DATA_CAPTURED"
  | "STREAM_ENDED"
  | "NO_COMPATIBLE_FORMAT"
  | "COMPOSITING_FAILED"
  | "DEVICE_NOT_FOUND"
  | "UNKNOWN";

export interface CaptureError {
  code: CaptureErrorCode;
  message: string;
  recoverable: boolean;
  details?: string;
}

export interface CaptureErrorInfo {
  title: string;
  description: string;
  icon: "permission" | "device" | "security" | "recording" | "error";
  steps: string[];
  showBrowserSettings: boolean;
  primaryAction: "retry" | "refresh" | "none";
  primaryActionLabel?: string;
  /** Show "Continue in Preview Mode" option */
  showPreviewMode?: boolean;
  /** Show "Open in Chrome" helper */
  showOpenInChrome?: boolean;
}

/**
 * Get detailed error information for display
 */
export function getCaptureErrorInfo(error: CaptureError): CaptureErrorInfo {
  switch (error.code) {
    case "PERMISSION_DENIED":
      return {
        title: "Permission Required",
        description: error.message || "You need to grant permission to capture your screen or microphone.",
        icon: "permission",
        steps: [
          "Click \"Allow\" when prompted by your browser",
          "If you dismissed the prompt, click the lock icon in your browser's address bar",
          "Find the relevant permission and change it to \"Allow\"",
          "Refresh the page and try again",
        ],
        showBrowserSettings: true,
        primaryAction: "retry",
        primaryActionLabel: "Try Again",
      };

    case "DEVICE_IN_USE":
      return {
        title: "Device In Use",
        description: error.message || "Your microphone, camera, or screen is being used by another application.",
        icon: "device",
        steps: [
          "Close any other applications using your camera or microphone (Zoom, Discord, OBS, etc.)",
          "Check for browser tabs that might be using media devices",
          "Try disconnecting and reconnecting the device",
          "Restart your browser if the issue persists",
        ],
        showBrowserSettings: false,
        primaryAction: "retry",
        primaryActionLabel: "Try Again",
      };

    case "INSECURE_CONTEXT":
      return {
        title: "Secure Connection Required",
        description: "Screen and camera capture requires a secure (HTTPS) connection.",
        icon: "security",
        steps: [
          "Make sure you're accessing this site via HTTPS",
          "If testing locally, use localhost instead of an IP address",
          "Contact the site administrator if the issue persists",
        ],
        showBrowserSettings: false,
        primaryAction: "none",
      };

    case "NO_AUDIO_TRACK":
      return {
        title: "Microphone Not Found",
        description: error.message || "No microphone was detected. A microphone is required for capture.",
        icon: "device",
        steps: [
          "Connect a microphone to your computer",
          "Check that your microphone is properly plugged in",
          "Verify the microphone works in other applications",
          "Try selecting a different microphone from the dropdown",
        ],
        showBrowserSettings: false,
        primaryAction: "retry",
        primaryActionLabel: "Retry",
      };

    case "RECORDER_UNSUPPORTED":
      return {
        title: "This Browser Can't Record",
        description: "Your browser doesn't support the MediaRecorder API needed for video recording.",
        icon: "error",
        steps: [
          "Open this page in Google Chrome (recommended)",
          "Microsoft Edge and Brave also work well",
          "Update your browser to the latest version",
          "Safari has very limited recording support",
        ],
        showBrowserSettings: false,
        primaryAction: "none",
        showPreviewMode: true,
        showOpenInChrome: true,
      };

    case "RECORDER_ERROR":
      return {
        title: "Recording Error",
        description: error.message || "An error occurred while recording. Your data may be partially lost.",
        icon: "recording",
        steps: [
          "Try starting a new recording",
          "Close other resource-intensive applications",
          "Check that you have sufficient disk space",
          "If the problem persists, try restarting your browser",
        ],
        showBrowserSettings: false,
        primaryAction: "retry",
        primaryActionLabel: "Start New Recording",
      };

    case "NO_DATA_CAPTURED":
      return {
        title: "No Data Captured",
        description: error.message || "The recording didn't capture any data. This can happen if the recording was too short or the streams ended unexpectedly.",
        icon: "recording",
        steps: [
          "Make sure to record for at least a few seconds",
          "Check that your screen share is still active during recording",
          "Ensure your microphone is connected and working",
          "Try again with a longer recording",
        ],
        showBrowserSettings: false,
        primaryAction: "retry",
        primaryActionLabel: "Try Again",
      };

    case "STREAM_ENDED":
      return {
        title: "Capture Stopped Unexpectedly",
        description: error.message || "The screen share or media stream ended unexpectedly during recording.",
        icon: "recording",
        steps: [
          "Make sure you don't click \"Stop Sharing\" in your browser during recording",
          "Don't close the window or tab you're sharing",
          "Check that your camera/microphone stays connected",
          "Try the recording again",
        ],
        showBrowserSettings: false,
        primaryAction: "retry",
        primaryActionLabel: "Start Over",
      };

    case "NO_COMPATIBLE_FORMAT":
      return {
        title: "This Browser Can't Record This Format",
        description: "Your browser doesn't support any video codec that can be both recorded and played back (e.g., VP9, VP8, H.264).",
        icon: "error",
        steps: [
          "Open this page in Google Chrome for full codec support",
          "Microsoft Edge and Brave also support all required codecs",
          "Safari only supports MP4/H.264 on newer versions",
          "Firefox supports WebM/VP9 recording",
        ],
        showBrowserSettings: false,
        primaryAction: "none",
        showPreviewMode: true,
        showOpenInChrome: true,
      };

    case "COMPOSITING_FAILED":
      return {
        title: "Video Processing Failed",
        description: error.message || "Failed to combine video and audio streams for recording.",
        icon: "recording",
        steps: [
          "Try refreshing the page and starting again",
          "Close other browser tabs to free up memory",
          "Disable hardware acceleration in browser settings if issues persist",
          "Try using Chrome for best compatibility",
        ],
        showBrowserSettings: false,
        primaryAction: "retry",
        primaryActionLabel: "Try Again",
      };

    case "DEVICE_NOT_FOUND":
      return {
        title: "Device Not Found",
        description: error.message || "The requested capture device was not found.",
        icon: "device",
        steps: [
          "Check that your camera/microphone is properly connected",
          "Try a different USB port",
          "Restart the device",
          "Select a different device from the available options",
        ],
        showBrowserSettings: false,
        primaryAction: "retry",
        primaryActionLabel: "Try Again",
      };

    case "UNKNOWN":
    default:
      return {
        title: "Something Went Wrong",
        description: error.message || "An unexpected error occurred during capture.",
        icon: "error",
        steps: [
          "Refresh the page and try again",
          "Make sure no other application is using your camera or microphone",
          "Try using Google Chrome if you're on a different browser",
          "Contact support if the problem persists",
        ],
        showBrowserSettings: true,
        primaryAction: "retry",
        primaryActionLabel: "Try Again",
      };
  }
}

/**
 * Parse a native browser error into a CaptureError
 */
export function parseMediaError(err: any, context: "screen" | "microphone" | "camera"): CaptureError {
  const errorName = err?.name || "";
  const errorMessage = err?.message || "";

  // Check for insecure context first
  if (!window.isSecureContext) {
    return {
      code: "INSECURE_CONTEXT",
      message: "Screen capture requires a secure (HTTPS) connection or localhost.",
      recoverable: false,
    };
  }

  // Permission denied
  if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
    const contextLabel = context === "screen" ? "screen sharing" : context === "microphone" ? "microphone" : "camera";
    return {
      code: "PERMISSION_DENIED",
      message: `Permission denied for ${contextLabel}. Please allow access to continue.`,
      recoverable: true,
    };
  }

  // Device in use by another application
  if (errorName === "NotReadableError") {
    const contextLabel = context === "screen" ? "Screen" : context === "microphone" ? "Microphone" : "Camera";
    return {
      code: "DEVICE_IN_USE",
      message: `${contextLabel} is being used by another application. Close other apps and try again.`,
      recoverable: true,
    };
  }

  // Device not found
  if (errorName === "NotFoundError") {
    const contextLabel = context === "screen" ? "screen/window" : context === "microphone" ? "microphone" : "camera";
    return {
      code: "DEVICE_NOT_FOUND",
      message: `No ${contextLabel} found. Please connect one and try again.`,
      recoverable: true,
    };
  }

  // User cancelled (AbortError)
  if (errorName === "AbortError") {
    return {
      code: "PERMISSION_DENIED",
      message: `${context === "screen" ? "Screen sharing" : "Capture"} was cancelled. Click to try again.`,
      recoverable: true,
    };
  }

  // OverconstrainedError - device doesn't meet requirements
  if (errorName === "OverconstrainedError") {
    return {
      code: "DEVICE_NOT_FOUND",
      message: `The selected device doesn't meet the required constraints. Try a different device.`,
      recoverable: true,
      details: errorMessage,
    };
  }

  // Security error
  if (errorName === "SecurityError") {
    return {
      code: "INSECURE_CONTEXT",
      message: "Security error: capture is not allowed in this context.",
      recoverable: false,
    };
  }

  // TypeError - usually means MediaRecorder not supported
  if (errorName === "TypeError" && errorMessage.includes("MediaRecorder")) {
    return {
      code: "RECORDER_UNSUPPORTED",
      message: "Your browser doesn't support recording. Please use Chrome, Firefox, or Edge.",
      recoverable: false,
    };
  }

  // Generic fallback
  return {
    code: "UNKNOWN",
    message: errorMessage || `An error occurred while accessing your ${context}.`,
    recoverable: true,
    details: `${errorName}: ${errorMessage}`,
  };
}

/**
 * Create a recorder error from MediaRecorder.onerror event
 */
export function createRecorderError(event: Event): CaptureError {
  const error = (event as any).error;
  return {
    code: "RECORDER_ERROR",
    message: error?.message || "An error occurred during recording.",
    recoverable: false,
    details: error?.name || "MediaRecorder error",
  };
}

/**
 * Create an error for when no data was captured
 */
export function createNoDataError(chunksCount: number, totalBytes: number, duration: number): CaptureError {
  let details = `Chunks: ${chunksCount}, Bytes: ${totalBytes}, Duration: ${duration}s`;
  let message: string;

  if (chunksCount === 0) {
    message = "No recording data was captured. The recording may have failed to start.";
  } else if (totalBytes < 1000) {
    message = "Recording data is too small. The recording may have been interrupted.";
  } else {
    message = "Recording data is incomplete or corrupted.";
  }

  return {
    code: "NO_DATA_CAPTURED",
    message,
    recoverable: false,
    details,
  };
}

/**
 * Create an error for when streams end unexpectedly
 */
export function createStreamEndedError(trackKind: string): CaptureError {
  return {
    code: "STREAM_ENDED",
    message: `The ${trackKind} stream ended unexpectedly. Please start a new recording.`,
    recoverable: true,
  };
}
