/**
 * Desktop Popover Types
 * 
 * State machine and configuration for the desktop capture popover UI.
 */

// Recording limit in seconds (configurable)
export const RECORDING_LIMIT_SECONDS = 5 * 60; // 5 minutes

// Popover states
export type PopoverState =
  | "unauthorized"      // Permissions not granted
  | "idle"              // Authorized, ready to configure
  | "selecting_source"  // Window picker open
  | "countdown"         // 3-2-1 countdown before recording
  | "recording"         // Actively recording
  | "paused"            // Recording paused
  | "processing"        // Post-recording processing/upload
  | "error";            // Something went wrong

// Source types
export type CaptureSourceType = "screen" | "window" | "camera";

export interface CaptureSource {
  id: string;
  type: CaptureSourceType;
  name: string;
  icon?: string;
  thumbnail?: string;
}

// Mock window data for picker
export interface MockWindow {
  id: string;
  name: string;
  appName: string;
  thumbnail: string;
}

// Device info
export interface AudioDevice {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface VideoDevice {
  id: string;
  name: string;
  isDefault?: boolean;
}

// Recording state
export interface RecordingState {
  duration: number; // seconds
  isPaused: boolean;
  source: CaptureSource | null;
}

// Error types
export interface PopoverError {
  code: "permission_denied" | "source_lost" | "upload_failed" | "unknown";
  message: string;
  recoverable: boolean;
}

// Popover configuration
export interface PopoverConfig {
  micEnabled: boolean;
  cameraEnabled: boolean;
  selectedMicId: string | null;
  selectedCameraId: string | null;
  selectedSource: CaptureSource | null;
}

// Mock data
export const MOCK_SOURCES: CaptureSource[] = [
  { id: "fullscreen", type: "screen", name: "Full screen" },
  { id: "window", type: "window", name: "Specific window" },
  { id: "camera", type: "camera", name: "Camera only" },
];

export const MOCK_WINDOWS: MockWindow[] = [
  { id: "w1", name: "Valorant", appName: "VALORANT-Win64-Shipping.exe", thumbnail: "/placeholder.svg" },
  { id: "w2", name: "Discord", appName: "Discord", thumbnail: "/placeholder.svg" },
  { id: "w3", name: "Chrome - YouTube", appName: "Google Chrome", thumbnail: "/placeholder.svg" },
  { id: "w4", name: "VS Code", appName: "Visual Studio Code", thumbnail: "/placeholder.svg" },
  { id: "w5", name: "OBS Studio", appName: "obs64.exe", thumbnail: "/placeholder.svg" },
  { id: "w6", name: "Steam", appName: "Steam", thumbnail: "/placeholder.svg" },
];

export const MOCK_MICS: AudioDevice[] = [
  { id: "mic1", name: "Blue Yeti X", isDefault: true },
  { id: "mic2", name: "MacBook Pro Microphone" },
  { id: "mic3", name: "AirPods Pro" },
];

export const MOCK_CAMERAS: VideoDevice[] = [
  { id: "cam1", name: "FaceTime HD Camera", isDefault: true },
  { id: "cam2", name: "Logitech C920" },
];

// Format recording time as MM:SS
export function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Format recording limit for display
export function formatRecordingLimit(): string {
  const mins = Math.floor(RECORDING_LIMIT_SECONDS / 60);
  return `${mins} min recording limit`;
}
