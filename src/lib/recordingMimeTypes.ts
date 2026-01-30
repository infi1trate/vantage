/**
 * Recording MIME type selection with browser compatibility checks.
 * Ensures the selected format works for BOTH MediaRecorder AND HTMLVideoElement playback.
 */

export interface RecordingMimeTypeInfo {
  mimeType: string;
  fileExt: "mp4" | "webm";
  codecsLabel: string;
  browserLabel: string;
}

/**
 * Priority order for MIME type selection:
 * 1. video/mp4;codecs=h264,aac (best compatibility if supported)
 * 2. video/mp4 (fallback mp4)
 * 3. video/webm;codecs=vp9,opus (high quality webm)
 * 4. video/webm;codecs=vp8,opus (fallback webm)
 * 5. video/webm (basic webm)
 */
const MIME_TYPE_PRIORITY: Array<{ mime: string; ext: "mp4" | "webm"; codecs: string }> = [
  { mime: "video/mp4;codecs=h264,aac", ext: "mp4", codecs: "H.264 + AAC" },
  { mime: "video/mp4", ext: "mp4", codecs: "MP4 (default)" },
  { mime: "video/webm;codecs=vp9,opus", ext: "webm", codecs: "VP9 + Opus" },
  { mime: "video/webm;codecs=vp8,opus", ext: "webm", codecs: "VP8 + Opus" },
  { mime: "video/webm", ext: "webm", codecs: "WebM (default)" },
];

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
 * @returns RecordingMimeTypeInfo if a compatible format is found, null otherwise.
 */
export function chooseRecordingMimeType(): RecordingMimeTypeInfo | null {
  const browserLabel = getBrowserLabel();
  
  console.log("[MimeType] Checking recording/playback compatibility...");
  console.log(`[MimeType] Browser: ${browserLabel}`);
  
  for (const { mime, ext, codecs } of MIME_TYPE_PRIORITY) {
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

/**
 * Get all MIME types and their support status for diagnostics
 */
export function getAllMimeTypeSupportStatus(): Array<{
  mimeType: string;
  canRecord: boolean;
  canPlayback: boolean;
  compatible: boolean;
}> {
  return MIME_TYPE_PRIORITY.map(({ mime }) => {
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
