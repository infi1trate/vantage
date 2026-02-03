/**
 * DesktopBridge
 * 
 * Lightweight integration layer for Electron.
 * Detects if window.vantage exists (Electron context) and provides
 * wrapper functions that either call Electron or fall back to stubs.
 */

/**
 * Desktop Recordings API Configuration
 * 
 * The Electron app MUST call this Supabase Edge Function URL directly:
 * - POST /init: Create session & get upload URL
 * - POST /complete: Finalize upload
 * 
 * DO NOT call /api/desktop/recordings/* - that will return HTML from the React app.
 */
export const DESKTOP_RECORDINGS_API = {
  /** Base URL for the desktop-recordings edge function */
  baseUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/desktop-recordings`,
  
  /** 
   * Get the init endpoint URL
   * Electron should POST to this with x-custom-path: init header
   */
  initUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/desktop-recordings`,
  
  /** 
   * Get the complete endpoint URL  
   * Electron should POST to this with x-custom-path: complete header
   */
  completeUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/desktop-recordings`,
  
  /** Custom header name for sub-routing */
  pathHeader: "x-custom-path",
};

// Types for the Electron bridge API
export interface VantageSource {
  id: string;
  name: string;
  type: "screen" | "window";
  thumbnail?: string;
}

export interface VantageState {
  state: "idle" | "picking_source" | "countdown" | "recording" | "paused" | "processing" | "uploading" | "success" | "error";
  duration?: number;
  countdown?: number;
  uploadProgress?: number;
  error?: { code: string; message: string };
  selectedSource?: VantageSource | null;
  cameraEnabled?: boolean;
  micEnabled?: boolean;
}

export interface VantageBridge {
  ping: () => Promise<{ version: string }>;
  listSources: () => Promise<VantageSource[]>;
  selectSource: (sourceId: string) => Promise<void>;
  startRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  setCameraEnabled: (enabled: boolean) => Promise<void>;
  setMicEnabled: (enabled: boolean) => Promise<void>;
  onState: (callback: (state: VantageState) => void) => () => void;
  quit?: () => Promise<void>;
  openExternal?: (url: string) => Promise<void>;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    vantage?: VantageBridge;
  }
}

/**
 * Check if we're running inside Electron with the Vantage bridge
 */
export function isElectronContext(): boolean {
  return typeof window !== "undefined" && typeof window.vantage !== "undefined";
}

/**
 * Get the Electron bridge if available
 */
export function getBridge(): VantageBridge | null {
  if (isElectronContext()) {
    return window.vantage!;
  }
  return null;
}

/**
 * Ping the Electron bridge to verify connection
 * Returns null if not in Electron context
 */
export async function ping(): Promise<{ version: string } | null> {
  const bridge = getBridge();
  if (!bridge) {
    console.log("[DesktopBridge] No Electron context, ping skipped");
    return null;
  }
  
  try {
    const result = await bridge.ping();
    console.log("[DesktopBridge] Ping successful:", result);
    return result;
  } catch (error) {
    console.error("[DesktopBridge] Ping failed:", error);
    return null;
  }
}

/**
 * List available capture sources from Electron
 * Returns empty array if not in Electron context
 */
export async function listSources(): Promise<VantageSource[]> {
  const bridge = getBridge();
  if (!bridge) {
    console.log("[DesktopBridge] No Electron context, returning empty sources");
    return [];
  }
  
  try {
    const sources = await bridge.listSources();
    console.log("[DesktopBridge] Listed sources:", sources.length);
    return sources;
  } catch (error) {
    console.error("[DesktopBridge] listSources failed:", error);
    return [];
  }
}

/**
 * Select a capture source in Electron
 * No-op if not in Electron context
 */
export async function selectSource(sourceId: string): Promise<boolean> {
  const bridge = getBridge();
  if (!bridge) {
    console.log("[DesktopBridge] No Electron context, selectSource skipped");
    return false;
  }
  
  try {
    await bridge.selectSource(sourceId);
    console.log("[DesktopBridge] Source selected:", sourceId);
    return true;
  } catch (error) {
    console.error("[DesktopBridge] selectSource failed:", error);
    return false;
  }
}

/**
 * Start recording via Electron
 * Returns false if not in Electron context
 */
export async function startRecording(): Promise<boolean> {
  const bridge = getBridge();
  if (!bridge) {
    console.log("[DesktopBridge] No Electron context, startRecording skipped");
    return false;
  }
  
  try {
    await bridge.startRecording();
    console.log("[DesktopBridge] Recording started");
    return true;
  } catch (error) {
    console.error("[DesktopBridge] startRecording failed:", error);
    return false;
  }
}

/**
 * Pause recording via Electron
 * Returns false if not in Electron context
 */
export async function pauseRecording(): Promise<boolean> {
  const bridge = getBridge();
  if (!bridge) {
    console.log("[DesktopBridge] No Electron context, pauseRecording skipped");
    return false;
  }
  
  try {
    await bridge.pauseRecording();
    console.log("[DesktopBridge] Recording paused");
    return true;
  } catch (error) {
    console.error("[DesktopBridge] pauseRecording failed:", error);
    return false;
  }
}

/**
 * Resume recording via Electron
 * Returns false if not in Electron context
 */
export async function resumeRecording(): Promise<boolean> {
  const bridge = getBridge();
  if (!bridge) {
    console.log("[DesktopBridge] No Electron context, resumeRecording skipped");
    return false;
  }
  
  try {
    await bridge.resumeRecording();
    console.log("[DesktopBridge] Recording resumed");
    return true;
  } catch (error) {
    console.error("[DesktopBridge] resumeRecording failed:", error);
    return false;
  }
}

/**
 * Stop recording via Electron
 * Returns false if not in Electron context
 */
export async function stopRecording(): Promise<boolean> {
  const bridge = getBridge();
  if (!bridge) {
    console.log("[DesktopBridge] No Electron context, stopRecording skipped");
    return false;
  }
  
  try {
    await bridge.stopRecording();
    console.log("[DesktopBridge] Recording stopped");
    return true;
  } catch (error) {
    console.error("[DesktopBridge] stopRecording failed:", error);
    return false;
  }
}

/**
 * Set camera enabled state via Electron
 * Returns false if not in Electron context
 */
export async function setCameraEnabled(enabled: boolean): Promise<boolean> {
  const bridge = getBridge();
  if (!bridge) {
    console.log("[DesktopBridge] No Electron context, setCameraEnabled skipped");
    return false;
  }
  
  try {
    await bridge.setCameraEnabled(enabled);
    console.log("[DesktopBridge] Camera enabled:", enabled);
    return true;
  } catch (error) {
    console.error("[DesktopBridge] setCameraEnabled failed:", error);
    throw error; // Re-throw to allow caller to handle permission errors
  }
}

/**
 * Set microphone enabled state via Electron
 * Returns false if not in Electron context
 */
export async function setMicEnabled(enabled: boolean): Promise<boolean> {
  const bridge = getBridge();
  if (!bridge) {
    console.log("[DesktopBridge] No Electron context, setMicEnabled skipped");
    return false;
  }
  
  try {
    await bridge.setMicEnabled(enabled);
    console.log("[DesktopBridge] Mic enabled:", enabled);
    return true;
  } catch (error) {
    console.error("[DesktopBridge] setMicEnabled failed:", error);
    throw error; // Re-throw to allow caller to handle permission errors
  }
}

/**
 * Subscribe to state updates from Electron
 * Returns unsubscribe function, or null if not in Electron context
 */
export function subscribeToState(
  callback: (state: VantageState) => void
): (() => void) | null {
  const bridge = getBridge();
  if (!bridge) {
    console.log("[DesktopBridge] No Electron context, state subscription skipped");
    return null;
  }
  
  try {
    const unsubscribe = bridge.onState(callback);
    console.log("[DesktopBridge] State subscription active");
    return unsubscribe;
  } catch (error) {
    console.error("[DesktopBridge] subscribeToState failed:", error);
    return null;
  }
}

/**
 * Quit the Electron app
 * Returns false if not in Electron context or quit not available
 */
export async function quit(): Promise<boolean> {
  const bridge = getBridge();
  if (!bridge?.quit) {
    console.log("[DesktopBridge] No Electron context or quit not available");
    return false;
  }
  
  try {
    await bridge.quit();
    console.log("[DesktopBridge] Quit requested");
    return true;
  } catch (error) {
    console.error("[DesktopBridge] quit failed:", error);
    return false;
  }
}

/**
 * Open a URL in the system default browser
 * Falls back to window.open if not in Electron context
 */
export async function openExternal(url: string): Promise<boolean> {
  const bridge = getBridge();
  if (!bridge?.openExternal) {
    console.log("[DesktopBridge] No Electron context, using window.open");
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }
  
  try {
    await bridge.openExternal(url);
    console.log("[DesktopBridge] Opened external URL:", url);
    return true;
  } catch (error) {
    console.error("[DesktopBridge] openExternal failed:", error);
    // Fallback to window.open
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }
}
