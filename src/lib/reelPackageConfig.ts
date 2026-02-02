/**
 * Reel Package Configuration Types & Constants
 * 
 * Defines the data model for AI-generated intro/outro/transitions.
 * Supports post-processing generation with progressive preview.
 */

// ============= Types =============

export type StyleKey = 
  | "auto" 
  | "minimalPro" 
  | "cinematic" 
  | "meme" 
  | "neon" 
  | "retro" 
  | "hype";

export type AudioMode = "gameAudioOnly" | "musicBed" | "hybrid";

export type BeatSource = "music" | "gameAudio";

export type GenerationStatus = "idle" | "pending" | "generating" | "ready" | "failed";

export interface EnergyProfile {
  /** Pace score 0-100: how fast are cuts/action */
  paceScore: number;
  /** Loudness score 0-100: audio intensity */
  loudnessScore: number;
  /** Cut score 0-100: frequency of scene changes */
  cutScore: number;
}

export interface GenerationMetadata {
  prompt?: string;
  model?: string;
  createdAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface ReelPackageConfig {
  id: string;
  userId: string;
  sessionId?: string;
  reelId?: string;
  
  // Feature toggles
  enabledIntro: boolean;
  enabledOutro: boolean;
  enabledTransitions: boolean;
  
  // Style
  styleKey: StyleKey;
  
  // Audio
  audioMode: AudioMode;
  beatSource: BeatSource;
  
  // Energy profile
  energyProfile: EnergyProfile;
  
  // Stats
  statOverlayEnabled: boolean;
  
  // Generated assets
  introAssetId?: string;
  outroAssetId?: string;
  transitionAssetIds: string[];
  
  // Generation
  generationMetadata: GenerationMetadata;
  generationStatus: GenerationStatus;
  generationProgress: number;
  generationError?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============= Style Definitions =============

export interface StyleDefinition {
  key: StyleKey;
  name: string;
  description: string;
  icon: string;
  previewColors: string[];
  tags: string[];
}

export const STYLE_DEFINITIONS: StyleDefinition[] = [
  {
    key: "auto",
    name: "Auto (Recommended)",
    description: "AI selects the best style based on your content",
    icon: "Sparkles",
    previewColors: ["hsl(var(--primary))", "hsl(var(--accent))"],
    tags: ["smart", "adaptive"],
  },
  {
    key: "minimalPro",
    name: "Minimal Pro",
    description: "Clean, professional look for competitive content",
    icon: "Minimize2",
    previewColors: ["#ffffff", "#e5e5e5"],
    tags: ["esports", "professional"],
  },
  {
    key: "cinematic",
    name: "Cinematic",
    description: "Dramatic letterboxing and smooth transitions",
    icon: "Film",
    previewColors: ["#1a1a2e", "#16213e"],
    tags: ["dramatic", "movie"],
  },
  {
    key: "meme",
    name: "Meme",
    description: "Quick cuts, bass drops, and viral energy",
    icon: "Laugh",
    previewColors: ["#ff6b6b", "#feca57"],
    tags: ["funny", "viral"],
  },
  {
    key: "neon",
    name: "Neon",
    description: "Cyberpunk-inspired glow and synthwave vibes",
    icon: "Zap",
    previewColors: ["#ff00ff", "#00ffff"],
    tags: ["cyber", "glow"],
  },
  {
    key: "retro",
    name: "Retro",
    description: "VHS-style effects and nostalgic aesthetics",
    icon: "Tv2",
    previewColors: ["#00ff00", "#ff00ff"],
    tags: ["80s", "vintage"],
  },
  {
    key: "hype",
    name: "Hype",
    description: "Maximum energy with zoom punches and screen shakes",
    icon: "Flame",
    previewColors: ["#ff4444", "#ffaa00"],
    tags: ["energetic", "streaming"],
  },
];

export function getStyleDefinition(key: StyleKey): StyleDefinition | undefined {
  return STYLE_DEFINITIONS.find(s => s.key === key);
}

// ============= Audio Mode Definitions =============

export interface AudioModeDefinition {
  key: AudioMode;
  name: string;
  description: string;
  icon: string;
}

export const AUDIO_MODE_DEFINITIONS: AudioModeDefinition[] = [
  {
    key: "gameAudioOnly",
    name: "Game Audio Only",
    description: "Keep original game sounds",
    icon: "Gamepad2",
  },
  {
    key: "musicBed",
    name: "Music Bed",
    description: "Add background music track",
    icon: "Music",
  },
  {
    key: "hybrid",
    name: "Hybrid",
    description: "Blend game audio with music",
    icon: "Layers",
  },
];

// ============= Default Values =============

export const DEFAULT_ENERGY_PROFILE: EnergyProfile = {
  paceScore: 50,
  loudnessScore: 50,
  cutScore: 50,
};

export function createDefaultReelPackageConfig(
  userId: string,
  sessionId?: string
): Omit<ReelPackageConfig, "id" | "createdAt" | "updatedAt"> {
  return {
    userId,
    sessionId,
    enabledIntro: false,
    enabledOutro: false,
    enabledTransitions: false,
    styleKey: "auto",
    audioMode: "gameAudioOnly",
    beatSource: "gameAudio",
    energyProfile: { ...DEFAULT_ENERGY_PROFILE },
    statOverlayEnabled: true,
    transitionAssetIds: [],
    generationMetadata: {},
    generationStatus: "idle",
    generationProgress: 0,
  };
}

// ============= Database Mapping =============

export function mapDbToReelPackageConfig(row: Record<string, unknown>): ReelPackageConfig {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    sessionId: row.session_id as string | undefined,
    reelId: row.reel_id as string | undefined,
    enabledIntro: row.enabled_intro as boolean,
    enabledOutro: row.enabled_outro as boolean,
    enabledTransitions: row.enabled_transitions as boolean,
    styleKey: row.style_key as StyleKey,
    audioMode: row.audio_mode as AudioMode,
    beatSource: row.beat_source as BeatSource,
    energyProfile: row.energy_profile as EnergyProfile,
    statOverlayEnabled: row.stat_overlay_enabled as boolean,
    introAssetId: row.intro_asset_id as string | undefined,
    outroAssetId: row.outro_asset_id as string | undefined,
    transitionAssetIds: (row.transition_asset_ids as string[]) || [],
    generationMetadata: row.generation_metadata as GenerationMetadata,
    generationStatus: row.generation_status as GenerationStatus,
    generationProgress: row.generation_progress as number,
    generationError: row.generation_error as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapReelPackageConfigToDb(config: Partial<ReelPackageConfig>): Record<string, unknown> {
  const dbRow: Record<string, unknown> = {};
  
  if (config.userId !== undefined) dbRow.user_id = config.userId;
  if (config.sessionId !== undefined) dbRow.session_id = config.sessionId;
  if (config.reelId !== undefined) dbRow.reel_id = config.reelId;
  if (config.enabledIntro !== undefined) dbRow.enabled_intro = config.enabledIntro;
  if (config.enabledOutro !== undefined) dbRow.enabled_outro = config.enabledOutro;
  if (config.enabledTransitions !== undefined) dbRow.enabled_transitions = config.enabledTransitions;
  if (config.styleKey !== undefined) dbRow.style_key = config.styleKey;
  if (config.audioMode !== undefined) dbRow.audio_mode = config.audioMode;
  if (config.beatSource !== undefined) dbRow.beat_source = config.beatSource;
  if (config.energyProfile !== undefined) dbRow.energy_profile = config.energyProfile;
  if (config.statOverlayEnabled !== undefined) dbRow.stat_overlay_enabled = config.statOverlayEnabled;
  if (config.introAssetId !== undefined) dbRow.intro_asset_id = config.introAssetId;
  if (config.outroAssetId !== undefined) dbRow.outro_asset_id = config.outroAssetId;
  if (config.transitionAssetIds !== undefined) dbRow.transition_asset_ids = config.transitionAssetIds;
  if (config.generationMetadata !== undefined) dbRow.generation_metadata = config.generationMetadata;
  if (config.generationStatus !== undefined) dbRow.generation_status = config.generationStatus;
  if (config.generationProgress !== undefined) dbRow.generation_progress = config.generationProgress;
  if (config.generationError !== undefined) dbRow.generation_error = config.generationError;
  
  return dbRow;
}
