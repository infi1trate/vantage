/**
 * Capture Preflight Gate
 * Runs immediately when user clicks "New Capture" BEFORE any getDisplayMedia/getUserMedia calls.
 * Validates browser capabilities and returns actionable error info.
 */

import { chooseRecordingMimeType, type RecordingMimeTypeInfo } from "./recordingMimeTypes";

export interface PreflightGateResult {
  supported: boolean;
  canPreview: boolean; // Can still preview even if recording not possible
  selectedFormat: RecordingMimeTypeInfo | null;
  issues: PreflightIssue[];
  browserInfo: BrowserInfo;
}

export interface PreflightIssue {
  id: string;
  severity: "critical" | "warning";
  title: string;
  description: string;
}

export interface BrowserInfo {
  name: string;
  version: string;
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  isBrave: boolean;
  userAgent: string;
}

/**
 * Detect browser from user agent
 */
function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent;
  
  const isBrave = !!(navigator as any).brave;
  const isEdge = ua.includes("Edg/");
  const isChrome = ua.includes("Chrome/") && !isEdge && !isBrave;
  const isFirefox = ua.includes("Firefox/");
  const isSafari = ua.includes("Safari/") && !ua.includes("Chrome/");
  
  let name = "Unknown";
  let version = "?";
  
  if (isBrave) {
    name = "Brave";
    const match = ua.match(/Chrome\/(\d+)/);
    version = match?.[1] || "?";
  } else if (isEdge) {
    name = "Edge";
    const match = ua.match(/Edg\/(\d+)/);
    version = match?.[1] || "?";
  } else if (isChrome) {
    name = "Chrome";
    const match = ua.match(/Chrome\/(\d+)/);
    version = match?.[1] || "?";
  } else if (isFirefox) {
    name = "Firefox";
    const match = ua.match(/Firefox\/(\d+)/);
    version = match?.[1] || "?";
  } else if (isSafari) {
    name = "Safari";
    const match = ua.match(/Version\/(\d+)/);
    version = match?.[1] || "?";
  }
  
  return {
    name,
    version,
    isSafari,
    isChrome,
    isFirefox,
    isEdge,
    isBrave,
    userAgent: ua,
  };
}

/**
 * Run all preflight checks
 */
export function runCapturePreflightGate(): PreflightGateResult {
  const issues: PreflightIssue[] = [];
  const browserInfo = detectBrowser();
  
  // Check 1: Secure context
  if (!window.isSecureContext) {
    issues.push({
      id: "insecure_context",
      severity: "critical",
      title: "Insecure Context",
      description: "Screen capture requires HTTPS. Please access this site over a secure connection.",
    });
  }
  
  // Check 2: navigator.mediaDevices exists
  if (!navigator.mediaDevices) {
    issues.push({
      id: "no_media_devices",
      severity: "critical",
      title: "Media Devices API Missing",
      description: "Your browser does not support the Media Devices API required for capture.",
    });
  }
  
  // Check 3: getDisplayMedia exists
  if (!navigator.mediaDevices?.getDisplayMedia) {
    issues.push({
      id: "no_get_display_media",
      severity: "critical",
      title: "Screen Capture Not Supported",
      description: "Your browser does not support screen capture (getDisplayMedia).",
    });
  }
  
  // Check 4: MediaRecorder exists
  if (typeof MediaRecorder === "undefined") {
    issues.push({
      id: "no_media_recorder",
      severity: "critical",
      title: "MediaRecorder Not Supported",
      description: "Your browser does not support the MediaRecorder API needed for recording.",
    });
  }
  
  // Check 5: Choose recording MIME type
  let selectedFormat: RecordingMimeTypeInfo | null = null;
  if (typeof MediaRecorder !== "undefined") {
    selectedFormat = chooseRecordingMimeType();
    
    if (!selectedFormat) {
      issues.push({
        id: "no_supported_mime_type",
        severity: "critical",
        title: "No Compatible Recording Format",
        description: "Your browser cannot record in a format that can also be played back. No supported video codec found.",
      });
    }
  }
  
  // Check 6: Safari-specific warning
  if (browserInfo.isSafari) {
    // Check if Safari has MP4/H264 support (Safari 14.1+ on macOS 11.3+)
    const hasMp4Support = selectedFormat?.mimeType.startsWith("video/mp4");
    
    if (!hasMp4Support) {
      issues.push({
        id: "safari_limited_support",
        severity: "warning",
        title: "Safari Has Limited Recording Support",
        description: "Safari may have compatibility issues with screen recording. For best results, use Chrome or Edge.",
      });
    }
  }
  
  // Determine overall support level
  const criticalIssues = issues.filter(i => i.severity === "critical");
  const supported = criticalIssues.length === 0;
  
  // Can preview if we have mediaDevices and getDisplayMedia (even without recording support)
  const canPreview = 
    window.isSecureContext && 
    !!navigator.mediaDevices?.getDisplayMedia;
  
  return {
    supported,
    canPreview,
    selectedFormat,
    issues,
    browserInfo,
  };
}

/**
 * Get recommended browsers message
 */
export function getRecommendedBrowsersMessage(): string {
  return "For best capture experience, we recommend Chrome, Edge, or Brave.";
}
