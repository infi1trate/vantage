/**
 * Effect Metadata Store
 * 
 * Lightweight JSON store for frame/SFX/VFX selections.
 * Effects are stored as metadata only - never composited during capture.
 * Applied during export/render or post-capture processing.
 * 
 * Design principles:
 * - Zero capture overhead (metadata only)
 * - Persists with session data
 * - Supports undo/redo via history stack
 */

// ============= Types =============

export type FrameStyle = 
  | "none"
  | "gaming-minimal"
  | "gaming-bold"
  | "streamer-classic"
  | "retro-pixel"
  | "neon-glow"
  | "clean-modern"
  | "custom";

export type SFXType =
  | "kill-confirm"
  | "headshot"
  | "multi-kill"
  | "streak"
  | "death"
  | "highlight"
  | "intro"
  | "outro";

export type VFXType =
  | "slow-motion"
  | "zoom-in"
  | "shake"
  | "flash"
  | "color-grade"
  | "vignette"
  | "blur-transition";

export interface FrameConfig {
  /** Frame style preset */
  style: FrameStyle;
  /** Custom frame asset URL (for custom style) */
  customAssetUrl?: string;
  /** Frame color theme */
  colorTheme?: string;
  /** Opacity 0-1 */
  opacity: number;
  /** Whether to show facecam border */
  facecamBorder: boolean;
  /** Facecam border color */
  facecamBorderColor?: string;
}

export interface SFXConfig {
  /** Sound effect type */
  type: SFXType;
  /** Timestamp to trigger (seconds) */
  triggerAt: number;
  /** Duration in seconds (for looping sounds) */
  duration?: number;
  /** Volume 0-1 */
  volume: number;
  /** Custom audio URL */
  customAudioUrl?: string;
  /** Whether enabled */
  enabled: boolean;
}

export interface VFXConfig {
  /** Visual effect type */
  type: VFXType;
  /** Start timestamp (seconds) */
  startAt: number;
  /** End timestamp (seconds) */
  endAt: number;
  /** Effect intensity 0-1 */
  intensity: number;
  /** Effect-specific parameters */
  params?: Record<string, unknown>;
  /** Whether enabled */
  enabled: boolean;
}

export interface ReelPackage {
  /** Package ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Frame config */
  frame: FrameConfig;
  /** Default SFX mappings */
  sfxMappings: Partial<Record<SFXType, { enabled: boolean; volume: number }>>;
  /** Default VFX for moments */
  vfxMappings: Partial<Record<string, VFXConfig>>;
  /** Tags for filtering */
  tags: string[];
}

export interface SessionEffects {
  /** Session ID */
  sessionId: string;
  /** Applied frame config */
  frame: FrameConfig;
  /** SFX instances */
  sfx: SFXConfig[];
  /** VFX instances */
  vfx: VFXConfig[];
  /** Selected reel package ID (if any) */
  reelPackageId?: string;
  /** Last modified timestamp */
  updatedAt: number;
  /** Version for migration */
  version: number;
}

// ============= Constants =============

const STORAGE_KEY_PREFIX = "vantage:effects:";
const CURRENT_VERSION = 1;

export const DEFAULT_FRAME_CONFIG: FrameConfig = {
  style: "none",
  opacity: 1,
  facecamBorder: false,
};

// Built-in reel packages
export const REEL_PACKAGES: ReelPackage[] = [
  {
    id: "clean-pro",
    name: "Clean Pro",
    description: "Minimal, professional look with subtle effects",
    frame: { style: "clean-modern", opacity: 0.9, facecamBorder: true, facecamBorderColor: "#ffffff" },
    sfxMappings: {
      "kill-confirm": { enabled: true, volume: 0.5 },
      "highlight": { enabled: true, volume: 0.6 },
    },
    vfxMappings: {
      "highlight": { type: "slow-motion", startAt: 0, endAt: 2, intensity: 0.5, enabled: true },
    },
    tags: ["minimal", "professional", "esports"],
  },
  {
    id: "hype-beast",
    name: "Hype Beast",
    description: "Bold, energetic style with dramatic effects",
    frame: { style: "gaming-bold", opacity: 1, facecamBorder: true, facecamBorderColor: "#ff4444" },
    sfxMappings: {
      "kill-confirm": { enabled: true, volume: 0.8 },
      "multi-kill": { enabled: true, volume: 0.9 },
      "streak": { enabled: true, volume: 0.9 },
    },
    vfxMappings: {
      "kill": { type: "shake", startAt: 0, endAt: 0.5, intensity: 0.7, enabled: true },
      "highlight": { type: "zoom-in", startAt: 0, endAt: 1.5, intensity: 0.6, enabled: true },
    },
    tags: ["bold", "energetic", "streaming"],
  },
  {
    id: "retro-vibes",
    name: "Retro Vibes",
    description: "Nostalgic pixel art aesthetic",
    frame: { style: "retro-pixel", opacity: 1, facecamBorder: true, facecamBorderColor: "#00ff00" },
    sfxMappings: {
      "kill-confirm": { enabled: true, volume: 0.6 },
    },
    vfxMappings: {
      "highlight": { type: "color-grade", startAt: 0, endAt: 3, intensity: 0.4, enabled: true, params: { preset: "retro" } },
    },
    tags: ["retro", "nostalgic", "pixel"],
  },
  {
    id: "neon-nights",
    name: "Neon Nights",
    description: "Cyberpunk-inspired glow effects",
    frame: { style: "neon-glow", opacity: 0.95, facecamBorder: true, facecamBorderColor: "#ff00ff" },
    sfxMappings: {
      "kill-confirm": { enabled: true, volume: 0.7 },
      "headshot": { enabled: true, volume: 0.8 },
    },
    vfxMappings: {
      "kill": { type: "flash", startAt: 0, endAt: 0.3, intensity: 0.5, enabled: true },
      "highlight": { type: "vignette", startAt: 0, endAt: 3, intensity: 0.6, enabled: true },
    },
    tags: ["cyberpunk", "neon", "glow"],
  },
];

// ============= Storage Functions =============

/**
 * Get effects for a session
 */
export function getSessionEffects(sessionId: string): SessionEffects | null {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
    if (!stored) return null;
    
    const effects = JSON.parse(stored) as SessionEffects;
    
    // Migration if needed
    if (effects.version !== CURRENT_VERSION) {
      return migrateEffects(effects);
    }
    
    return effects;
  } catch {
    return null;
  }
}

/**
 * Save effects for a session
 */
export function saveSessionEffects(effects: SessionEffects): void {
  try {
    effects.updatedAt = Date.now();
    effects.version = CURRENT_VERSION;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${effects.sessionId}`, JSON.stringify(effects));
  } catch (e) {
    console.warn("[EffectStore] Failed to save effects:", e);
  }
}

/**
 * Create default effects for a new session
 */
export function createDefaultEffects(sessionId: string): SessionEffects {
  return {
    sessionId,
    frame: { ...DEFAULT_FRAME_CONFIG },
    sfx: [],
    vfx: [],
    updatedAt: Date.now(),
    version: CURRENT_VERSION,
  };
}

/**
 * Apply a reel package to session effects
 */
export function applyReelPackage(
  effects: SessionEffects,
  packageId: string,
  moments?: Array<{ type: string; timestampSeconds: number; endTimestampSeconds?: number }>
): SessionEffects {
  const pkg = REEL_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return effects;
  
  const updatedEffects: SessionEffects = {
    ...effects,
    frame: { ...pkg.frame },
    reelPackageId: packageId,
    sfx: [],
    vfx: [],
  };
  
  // Generate SFX instances from moments
  if (moments) {
    for (const moment of moments) {
      const sfxType = momentTypeToSFX(moment.type);
      if (sfxType && pkg.sfxMappings[sfxType]?.enabled) {
        updatedEffects.sfx.push({
          type: sfxType,
          triggerAt: moment.timestampSeconds,
          volume: pkg.sfxMappings[sfxType]?.volume ?? 0.7,
          enabled: true,
        });
      }
      
      // Generate VFX for moment type
      const vfxTemplate = pkg.vfxMappings[moment.type];
      if (vfxTemplate) {
        const duration = vfxTemplate.endAt - vfxTemplate.startAt;
        updatedEffects.vfx.push({
          ...vfxTemplate,
          startAt: moment.timestampSeconds + vfxTemplate.startAt,
          endAt: moment.timestampSeconds + duration,
        });
      }
    }
  }
  
  return updatedEffects;
}

/**
 * Delete effects for a session
 */
export function deleteSessionEffects(sessionId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
  } catch {
    // Ignore
  }
}

// ============= Helper Functions =============

function momentTypeToSFX(momentType: string): SFXType | null {
  switch (momentType) {
    case "kill":
      return "kill-confirm";
    case "death":
      return "death";
    case "highlight":
      return "highlight";
    default:
      return null;
  }
}

function migrateEffects(effects: SessionEffects): SessionEffects {
  // Future migrations go here
  return {
    ...effects,
    version: CURRENT_VERSION,
  };
}

// ============= Effect Preview Helpers =============

/**
 * Get CSS class for frame style preview
 */
export function getFramePreviewClass(style: FrameStyle): string {
  switch (style) {
    case "gaming-minimal":
      return "border-2 border-primary/50 rounded-lg";
    case "gaming-bold":
      return "border-4 border-primary rounded-xl shadow-lg shadow-primary/30";
    case "streamer-classic":
      return "border-2 border-white/80 rounded-md";
    case "retro-pixel":
      return "border-4 border-[#00ff00] rounded-none";
    case "neon-glow":
      return "border-2 border-[#ff00ff] rounded-lg shadow-lg shadow-[#ff00ff]/50";
    case "clean-modern":
      return "border border-white/20 rounded-2xl";
    default:
      return "";
  }
}

/**
 * Check if effects are empty (no modifications from default)
 */
export function hasEffects(effects: SessionEffects): boolean {
  return (
    effects.frame.style !== "none" ||
    effects.sfx.some((s) => s.enabled) ||
    effects.vfx.some((v) => v.enabled)
  );
}
