/**
 * Export Settings Persistence
 * Remembers user's last-used export settings per device
 */

const STORAGE_KEY = "vantage_export_settings";

export interface ExportSettings {
  // Download settings
  preset: "source" | "1080p" | "720p" | "audio";
  format: "mp4" | "mov" | "mp3" | "wav";
  includeMic: boolean;
  includeWebcam: boolean;
  burnCaptions: boolean;
  
  // Community settings
  visibility: "public" | "unlisted" | "private";
  allowComments: boolean;
  allowAnnotations: boolean;
  allowRemixes: boolean;
  
  // Last updated
  updatedAt: string;
}

const DEFAULT_SETTINGS: ExportSettings = {
  preset: "1080p",
  format: "mp4",
  includeMic: true,
  includeWebcam: true,
  burnCaptions: false,
  visibility: "public",
  allowComments: true,
  allowAnnotations: false,
  allowRemixes: false,
  updatedAt: new Date().toISOString(),
};

/**
 * Load saved export settings
 */
export function loadExportSettings(): ExportSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch (error) {
    console.error("[ExportSettings] Failed to load:", error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save export settings
 */
export function saveExportSettings(settings: Partial<ExportSettings>): void {
  try {
    const current = loadExportSettings();
    const updated = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("[ExportSettings] Failed to save:", error);
  }
}

/**
 * Reset to defaults
 */
export function resetExportSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("[ExportSettings] Failed to reset:", error);
  }
}
