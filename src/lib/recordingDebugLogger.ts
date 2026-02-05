/**
 * Recording Debug Logger
 * 
 * Dev-only logging for MediaRecorder, streams, and data events.
 * All logging is stripped in production builds via import.meta.env.DEV checks.
 */

const IS_DEV = import.meta.env.DEV;

export interface TrackInfo {
  kind: string;
  label: string;
  enabled: boolean;
  readyState: string;
  settings: MediaTrackSettings | null;
}

export interface StreamDebugInfo {
  tracks: TrackInfo[];
  id: string;
  active: boolean;
}

/**
 * Extract detailed info from a MediaStream
 */
export function getStreamDebugInfo(stream: MediaStream | null): StreamDebugInfo | null {
  if (!stream) return null;
  
  return {
    id: stream.id,
    active: stream.active,
    tracks: stream.getTracks().map(track => ({
      kind: track.kind,
      label: track.label,
      enabled: track.enabled,
      readyState: track.readyState,
      settings: typeof track.getSettings === 'function' ? track.getSettings() : null,
    })),
  };
}

/**
 * Log stream information (dev only)
 */
export function logStreamInfo(label: string, stream: MediaStream | null): void {
  if (!IS_DEV) return;
  
  const info = getStreamDebugInfo(stream);
  if (!info) {
    console.log(`[Recording Debug] ${label}: null`);
    return;
  }
  
  console.log(`[Recording Debug] ${label}:`);
  console.log(`  ID: ${info.id}, Active: ${info.active}`);
  info.tracks.forEach((track, i) => {
    console.log(`  Track ${i}: ${track.kind} "${track.label}"`);
    console.log(`    enabled=${track.enabled}, readyState=${track.readyState}`);
    if (track.settings) {
      const s = track.settings;
      if (track.kind === 'video') {
        console.log(`    ${s.width}x${s.height} @ ${s.frameRate}fps`);
      } else if (track.kind === 'audio') {
        console.log(`    ${s.sampleRate}Hz, ${s.channelCount}ch`);
      }
    }
  });
}

/**
 * Log MIME type selection (dev only)
 */
export function logMimeTypeSelection(selectedMime: string, candidates: string[], chosen: boolean): void {
  if (!IS_DEV) return;
  
  console.log(`[Recording Debug] MIME type selection:`);
  console.log(`  Candidates tested: ${candidates.join(', ')}`);
  console.log(`  Selected: ${selectedMime}`);
  console.log(`  Success: ${chosen}`);
}

/**
 * Log MediaRecorder state transition (dev only)
 */
export function logRecorderStateTransition(
  event: string,
  recorderState: RecordingState,
  timestamp?: number
): void {
  if (!IS_DEV) return;
  
  const ts = timestamp ? new Date(timestamp).toISOString().split('T')[1].slice(0, 12) : 
             new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[Recording Debug] ${ts} Recorder: ${event} → state=${recorderState}`);
}

/**
 * Log dataavailable event (dev only)
 */
export function logDataAvailable(
  chunkIndex: number,
  size: number,
  totalBytes: number,
  timestamp: number
): void {
  if (!IS_DEV) return;
  
  const ts = new Date(timestamp).toISOString().split('T')[1].slice(0, 12);
  console.log(`[Recording Debug] ${ts} Data chunk #${chunkIndex}: ${size} bytes (total: ${totalBytes})`);
}

/**
 * Log recorder error (dev only)
 */
export function logRecorderError(errorName: string, errorMessage: string, context?: string): void {
  if (!IS_DEV) return;
  
  console.error(`[Recording Debug] Recorder error:`, {
    name: errorName,
    message: errorMessage,
    context,
  });
}

/**
 * Log track ended event (dev only)
 */
export function logTrackEnded(kind: string, label: string): void {
  if (!IS_DEV) return;
  
  console.warn(`[Recording Debug] Track ended: ${kind} "${label}"`);
}

/**
 * Create a comprehensive diagnostics string for clipboard/error display
 */
export function createDiagnosticsString(options: {
  streams: { label: string; stream: MediaStream | null }[];
  mimeType: string | null;
  recorderState: RecordingState | null;
  chunksCount: number;
  totalBytes: number;
  timeoutMs: number;
  browserInfo: string;
}): string {
  const lines = [
    '=== Recording Diagnostics ===',
    `Date: ${new Date().toISOString()}`,
    `Browser: ${options.browserInfo}`,
    `Secure Context: ${window.isSecureContext}`,
    `MediaRecorder Available: ${typeof MediaRecorder !== 'undefined'}`,
    '',
    '=== Streams ===',
  ];
  
  for (const { label, stream } of options.streams) {
    const info = getStreamDebugInfo(stream);
    if (!info) {
      lines.push(`${label}: null`);
      continue;
    }
    lines.push(`${label}: active=${info.active}`);
    info.tracks.forEach(track => {
      lines.push(`  ${track.kind} "${track.label}" enabled=${track.enabled} state=${track.readyState}`);
      if (track.settings && track.kind === 'video') {
        const s = track.settings;
        lines.push(`    ${s.width}x${s.height} @ ${s.frameRate}fps`);
      }
    });
  }
  
  lines.push('');
  lines.push('=== Recording ===');
  lines.push(`MIME Type: ${options.mimeType || 'none'}`);
  lines.push(`Recorder State: ${options.recorderState || 'none'}`);
  lines.push(`Chunks: ${options.chunksCount}`);
  lines.push(`Total Bytes: ${options.totalBytes}`);
  lines.push(`Timeout: ${options.timeoutMs}ms`);
  
  return lines.join('\n');
}

/**
 * Validate that a stream has at least one live video track
 */
export function validateStreamForRecording(stream: MediaStream | null): {
  valid: boolean;
  error: string | null;
  videoTrack: MediaStreamTrack | null;
} {
  if (!stream) {
    return { valid: false, error: 'Stream is null', videoTrack: null };
  }
  
  if (!stream.active) {
    return { valid: false, error: 'Stream is not active', videoTrack: null };
  }
  
  const videoTracks = stream.getVideoTracks();
  if (videoTracks.length === 0) {
    return { valid: false, error: 'No video track found', videoTrack: null };
  }
  
  const liveTrack = videoTracks.find(t => t.readyState === 'live');
  if (!liveTrack) {
    return { 
      valid: false, 
      error: `Video track not live (state: ${videoTracks[0].readyState})`,
      videoTrack: videoTracks[0],
    };
  }
  
  // Check for valid dimensions
  const settings = liveTrack.getSettings();
  if (settings.width && settings.height) {
    if (settings.width < 1 || settings.height < 1) {
      return {
        valid: false,
        error: `Invalid video dimensions: ${settings.width}x${settings.height}`,
        videoTrack: liveTrack,
      };
    }
  }
  
  return { valid: true, error: null, videoTrack: liveTrack };
}
