/**
 * Recording MIME type selection with browser compatibility checks.
 * Ensures the selected format works for BOTH MediaRecorder AND HTMLVideoElement playback.
 */

import { mark, measure, recordMetric } from "@/lib/performanceMetrics";
export interface RecordingMimeTypeInfo {
  mimeType: string;
  fileExt: "mp4" | "webm";
  codecsLabel: string;
  browserLabel: string;
}

/**
 * Priority order for MIME type selection (robust fallback order):
 * 1. video/webm;codecs=vp8,opus (most widely supported)
 * 2. video/webm (basic webm fallback)
 * 3. video/mp4;codecs=h264,aac (if supported - Safari, some Chrome)
 * 4. video/mp4 (fallback mp4)
 * 5. video/webm;codecs=vp9,opus (high quality but less encoder support)
 */
export const MIME_TYPE_CANDIDATES: Array<{ mime: string; ext: "mp4" | "webm"; codecs: string }> = [
  { mime: "video/webm;codecs=vp8,opus", ext: "webm", codecs: "VP8 + Opus" },
  { mime: "video/webm", ext: "webm", codecs: "WebM (default)" },
  { mime: "video/mp4;codecs=h264,aac", ext: "mp4", codecs: "H.264 + AAC" },
  { mime: "video/mp4", ext: "mp4", codecs: "MP4 (default)" },
  { mime: "video/webm;codecs=vp9,opus", ext: "webm", codecs: "VP9 + Opus" },
];

/**
 * Detect if the current browser is Safari
 */
export function isSafariBrowser(): boolean {
  const ua = navigator.userAgent;
  return ua.includes("Safari/") && !ua.includes("Chrome/") && !ua.includes("Chromium/");
}

/**
 * Simplify the user agent string for display
 */
function getBrowserLabel(): string {
  const ua = navigator.userAgent;
  
  // Extract browser info
  if (ua.includes("Chrome/")) {
    const match = ua.match(/Chrome\/(\d+)/);
    return `Chrome ${match?.[1] || "?"}`;
  }
  if (ua.includes("Firefox/")) {
    const match = ua.match(/Firefox\/(\d+)/);
    return `Firefox ${match?.[1] || "?"}`;
  }
  if (ua.includes("Safari/") && !ua.includes("Chrome")) {
    const match = ua.match(/Version\/(\d+)/);
    return `Safari ${match?.[1] || "?"}`;
  }
  if (ua.includes("Edg/")) {
    const match = ua.match(/Edg\/(\d+)/);
    return `Edge ${match?.[1] || "?"}`;
  }
  
  // Fallback: truncate UA
  return ua.substring(0, 50) + (ua.length > 50 ? "..." : "");
}

/**
 * Check if MediaRecorder supports a given MIME type
 */
function isRecordingSupported(mimeType: string): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  return MediaRecorder.isTypeSupported(mimeType);
}

/**
 * Check if HTMLVideoElement can likely play a given MIME type.
 * Uses canPlayType which returns "", "maybe", or "probably".
 */
function isPlaybackSupported(mimeType: string): boolean {
  const video = document.createElement("video");
  const result = video.canPlayType(mimeType);
  return result === "probably" || result === "maybe";
}

/**
 * Choose the best recording MIME type that is supported by BOTH:
 * (A) MediaRecorder in this browser AND
 * (B) HTMLVideoElement playback in this browser.
 * 
 * NOTE: This only uses isTypeSupported, not actual recording tests.
 * For robust fallback, use tryRecordWithFallback() instead.
 * 
 * @returns RecordingMimeTypeInfo if a compatible format is found, null otherwise.
 */
export function chooseRecordingMimeType(): RecordingMimeTypeInfo | null {
  const browserLabel = getBrowserLabel();
  
  console.log("[MimeType] Checking recording/playback compatibility...");
  console.log(`[MimeType] Browser: ${browserLabel}`);
  
  for (const { mime, ext, codecs } of MIME_TYPE_CANDIDATES) {
    const canRecord = isRecordingSupported(mime);
    const canPlay = isPlaybackSupported(mime);
    
    console.log(`[MimeType] ${mime}: record=${canRecord}, playback=${canPlay}`);
    
    if (canRecord && canPlay) {
      console.log(`[MimeType] Selected: ${mime}`);
      return {
        mimeType: mime,
        fileExt: ext,
        codecsLabel: codecs,
        browserLabel,
      };
    }
  }
  
  console.warn("[MimeType] No compatible recording format found!");
  return null;
}

export type RobustRecorderResult = 
  | {
      success: true;
      recorder: MediaRecorder;
      mimeTypeInfo: RecordingMimeTypeInfo;
    }
  | {
      success: false;
      error: string;
      triedFormats: string[];
      /** True if this is Safari and no formats worked */
      isSafariCodecFailure: boolean;
    };

/**
 * Robust MIME type fallback: Actually try to create and start MediaRecorder with each candidate.
 * This is more reliable than just checking isTypeSupported(), as some browsers report
 * support but fail during actual encoding.
 * 
 * Algorithm:
 * - For each candidate in priority order:
 *   1. Create MediaRecorder with the candidate mimeType
 *   2. Call recorder.start(1000)
 *   3. Wait 250ms to verify recorder.state === 'recording'
 *   4. If successful, return the recorder (caller must handle stopping it)
 *   5. If failed, stop and try next candidate
 * 
 * @param stream The MediaStream to record
 * @param options Recording options (videoBitsPerSecond, audioBitsPerSecond)
 * @returns RobustRecorderResult with either the working recorder or error details
 */
export async function tryRecordWithFallback(
  stream: MediaStream,
  options: {
    videoBitsPerSecond: number;
    audioBitsPerSecond: number;
  }
): Promise<RobustRecorderResult> {
  const browserLabel = getBrowserLabel();
  const triedFormats: string[] = [];
  
  console.log("[MimeType] Starting robust MIME type fallback...");
  console.log(`[MimeType] Browser: ${browserLabel}`);
  console.log(`[MimeType] Stream tracks: ${stream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(", ")}`);
  
  for (const { mime, ext, codecs } of MIME_TYPE_CANDIDATES) {
    // Quick pre-check: skip if isTypeSupported returns false
    // This saves time on formats that definitely won't work
    if (!isRecordingSupported(mime)) {
      console.log(`[MimeType] ${mime}: skipped (isTypeSupported=false)`);
      continue;
    }
    
    console.log(`[MimeType] Trying ${mime}...`);
    triedFormats.push(mime);
    
    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: options.videoBitsPerSecond,
        audioBitsPerSecond: options.audioBitsPerSecond,
      });
      
      // Mark recorder start for timing first data
      mark(`recorder:start:${mime}`);
      
      // Try to start the recorder
      recorder.start(1000);
      
      // Wait 250ms and check if it's actually recording
      const isRecording = await new Promise<boolean>((resolve) => {
        const checkTimeout = setTimeout(() => {
          resolve(recorder.state === "recording");
        }, 250);
        
        // Also listen for immediate errors
        recorder.onerror = () => {
          clearTimeout(checkTimeout);
          resolve(false);
        };
        
        // Listen for first data to measure startup time
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            measure(
              `recorder:first-data:${mime}`,
              `recorder:start:${mime}`,
              undefined,
              "capture:recorder:first-data"
            );
          }
        };
      });
      
      if (isRecording) {
        console.log(`[MimeType] SUCCESS: ${mime} is working`);
        
        // Record the successful recorder start time
        recordMetric("capture:recorder", 250, { mimeType: mime, success: true });
        
        // Clear the error handler we set (but keep ondataavailable for timing)
        recorder.onerror = null;
        
        return {
          success: true,
          recorder,
          mimeTypeInfo: {
            mimeType: mime,
            fileExt: ext,
            codecsLabel: codecs,
            browserLabel,
          },
        };
      } else {
        console.log(`[MimeType] ${mime}: started but not recording after 250ms (state: ${recorder.state})`);
        
        // Stop the failed recorder
        try {
          if (recorder.state !== "inactive") {
            recorder.stop();
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    } catch (err) {
      console.log(`[MimeType] ${mime}: failed to create/start - ${err}`);
    }
  }
  
  // None succeeded
  const isSafari = isSafariBrowser();
  console.error("[MimeType] All MIME type candidates failed!");
  
  if (isSafari) {
    console.error("[MimeType] Safari detected - recording not supported");
    return {
      success: false,
      error: "Recording is not supported in Safari for this build. Use Chrome, Edge, or Brave.",
      triedFormats,
      isSafariCodecFailure: true,
    };
  }
  
  return {
    success: false,
    error: `Recording not supported on this browser/device. Tried: ${triedFormats.join(", ") || "none (no formats passed isTypeSupported)"}`,
    triedFormats,
    isSafariCodecFailure: false,
  };
}

/**
 * Get all MIME types and their support status for diagnostics
 */
export function getAllMimeTypeSupportStatus(): Array<{
  mimeType: string;
  canRecord: boolean;
  canPlayback: boolean;
  compatible: boolean;
}> {
  return MIME_TYPE_CANDIDATES.map(({ mime }) => {
    const canRecord = isRecordingSupported(mime);
    const canPlayback = isPlaybackSupported(mime);
    return {
      mimeType: mime,
      canRecord,
      canPlayback,
      compatible: canRecord && canPlayback,
    };
  });
}

/**
 * Get file extension from a MIME type string
 */
export function getFileExtFromMimeType(mimeType: string): "mp4" | "webm" {
  if (mimeType.startsWith("video/mp4")) return "mp4";
  return "webm";
}

/**
 * Get diagnostics text for clipboard (used in error displays)
 */
export function getMimeTypeDiagnosticsText(): string {
  const lines = [
    "=== Recording Format Diagnostics ===",
    `Browser: ${getBrowserLabel()}`,
    `User Agent: ${navigator.userAgent}`,
    `Secure Context: ${window.isSecureContext}`,
    `MediaRecorder: ${typeof MediaRecorder !== "undefined"}`,
    "",
    "=== MIME Type Support ===",
  ];

  for (const { mime, codecs } of MIME_TYPE_CANDIDATES) {
    const canRecord = isRecordingSupported(mime);
    const canPlay = isPlaybackSupported(mime);
    lines.push(`${mime} (${codecs}): record=${canRecord}, play=${canPlay}`);
  }

  lines.push("");
  lines.push(`Date: ${new Date().toISOString()}`);

  return lines.join("\n");
}
