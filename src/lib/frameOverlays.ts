/**
 * Frame Overlays - Metadata Model
 * 
 * Frames are stored as metadata and applied during export/post-processing.
 * They are NOT composited during live capture to maintain performance.
 * 
 * Supports:
 * - Preset frames (built-in styles)
 * - AI-generated frames (via game/mood/playstyle prompts)
 * - Custom frames (user-uploaded assets)
 */

import { supabase } from "@/integrations/supabase/client";

// ============= Types =============

export type FrameType = "preset" | "ai" | "custom";
export type FrameShape = "circle" | "rounded" | "hex" | "square" | "pill";
export type PositionAnchor = 
  | "top-left" | "top-center" | "top-right"
  | "center-left" | "center" | "center-right"
  | "bottom-left" | "bottom-center" | "bottom-right";
export type ApplyScope = "sessionDefault" | "clipOnly" | "reelOnly";
export type AISource = "game" | "mood" | "playstyle" | "custom";

export interface FrameStyleParams {
  shape: FrameShape;
  strokeWidth: number;
  glowIntensity: number;        // 0-1
  shadowIntensity: number;       // 0-1
  nameplateEnabled: boolean;
  micRingEnabled: boolean;
  micRingSensitivity: number;    // 0-1
  colorTheme: string;            // Token key: 'primary', 'accent', 'neon-pink', etc.
}

export interface FrameLayoutParams {
  positionAnchor: PositionAnchor;
  offsetX: number;               // Pixels from anchor
  offsetY: number;
  sizeScale: number;             // 0.5 = S, 1.0 = M, 1.5 = L
  safeAreaSnapEnabled: boolean;
}

export interface AIInputs {
  gameName?: string;
  mood?: string;
  playstyle?: string;
  customPrompt?: string;
}

export interface FrameOverlay {
  id: string;
  user_id: string;
  session_id: string | null;
  type: FrameType;
  preset_key: string | null;
  name: string | null;
  style_params: FrameStyleParams;
  layout_params: FrameLayoutParams;
  apply_scope: ApplyScope;
  clip_id: string | null;
  ai_source: AISource | null;
  ai_inputs: AIInputs;
  ai_prompt_used: string | null;
  ai_variant_index: number;
  generation_model: string | null;
  asset_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

// Database row type (JSONB fields are unknown)
interface FrameOverlayRow {
  id: string;
  user_id: string;
  session_id: string | null;
  type: string;
  preset_key: string | null;
  name: string | null;
  style_params: unknown;
  layout_params: unknown;
  apply_scope: string;
  clip_id: string | null;
  ai_source: string | null;
  ai_inputs: unknown;
  ai_prompt_used: string | null;
  ai_variant_index: number;
  generation_model: string | null;
  asset_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

// ============= Defaults =============

export const DEFAULT_STYLE_PARAMS: FrameStyleParams = {
  shape: "rounded",
  strokeWidth: 2,
  glowIntensity: 0,
  shadowIntensity: 0.3,
  nameplateEnabled: false,
  micRingEnabled: false,
  micRingSensitivity: 0.5,
  colorTheme: "primary",
};

export const DEFAULT_LAYOUT_PARAMS: FrameLayoutParams = {
  positionAnchor: "bottom-right",
  offsetX: 24,
  offsetY: 24,
  sizeScale: 1.0,
  safeAreaSnapEnabled: true,
};

// ============= Preset Frames =============

export interface PresetFrame {
  key: string;
  name: string;
  description: string;
  category: "minimal" | "gaming" | "streamer" | "retro" | "neon";
  style: Partial<FrameStyleParams>;
  preview?: string; // Preview image URL
}

export const PRESET_FRAMES: PresetFrame[] = [
  {
    key: "clean-circle",
    name: "Clean Circle",
    description: "Simple circular frame with subtle shadow",
    category: "minimal",
    style: { shape: "circle", strokeWidth: 0, shadowIntensity: 0.4 },
  },
  {
    key: "rounded-glow",
    name: "Rounded Glow",
    description: "Soft rounded corners with gentle glow",
    category: "minimal",
    style: { shape: "rounded", strokeWidth: 2, glowIntensity: 0.3 },
  },
  {
    key: "gaming-bold",
    name: "Gaming Bold",
    description: "Thick border with primary color accent",
    category: "gaming",
    style: { shape: "rounded", strokeWidth: 4, glowIntensity: 0.5, colorTheme: "primary" },
  },
  {
    key: "gaming-hex",
    name: "Gaming Hex",
    description: "Hexagonal frame for tactical vibes",
    category: "gaming",
    style: { shape: "hex", strokeWidth: 3, glowIntensity: 0.4 },
  },
  {
    key: "streamer-classic",
    name: "Streamer Classic",
    description: "Classic streamer frame with nameplate",
    category: "streamer",
    style: { shape: "rounded", strokeWidth: 2, nameplateEnabled: true },
  },
  {
    key: "streamer-mic",
    name: "Streamer Mic Ring",
    description: "Reactive mic ring for voice activity",
    category: "streamer",
    style: { shape: "circle", micRingEnabled: true, micRingSensitivity: 0.6 },
  },
  {
    key: "retro-pixel",
    name: "Retro Pixel",
    description: "Pixelated border for nostalgic look",
    category: "retro",
    style: { shape: "square", strokeWidth: 4, colorTheme: "retro-green" },
  },
  {
    key: "neon-glow",
    name: "Neon Glow",
    description: "Intense neon glow effect",
    category: "neon",
    style: { shape: "rounded", strokeWidth: 2, glowIntensity: 0.8, colorTheme: "neon-pink" },
  },
  {
    key: "neon-pulse",
    name: "Neon Pulse",
    description: "Pulsing neon with mic reactivity",
    category: "neon",
    style: { shape: "circle", glowIntensity: 0.7, micRingEnabled: true, colorTheme: "neon-cyan" },
  },
];

// ============= Helper to convert DB row to typed object =============

function rowToFrameOverlay(row: FrameOverlayRow): FrameOverlay {
  return {
    ...row,
    type: row.type as FrameType,
    style_params: (row.style_params as FrameStyleParams) || DEFAULT_STYLE_PARAMS,
    layout_params: (row.layout_params as FrameLayoutParams) || DEFAULT_LAYOUT_PARAMS,
    apply_scope: row.apply_scope as ApplyScope,
    ai_source: row.ai_source as AISource | null,
    ai_inputs: (row.ai_inputs as AIInputs) || {},
  };
}

// ============= API Functions =============

/**
 * Create a new frame overlay
 */
export async function createFrameOverlay(
  userId: string,
  options: Partial<Omit<FrameOverlay, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<FrameOverlay | null> {
  const insertData = {
    user_id: userId,
    type: options.type || "preset",
    preset_key: options.preset_key || null,
    name: options.name || null,
    session_id: options.session_id || null,
    style_params: options.style_params || DEFAULT_STYLE_PARAMS,
    layout_params: options.layout_params || DEFAULT_LAYOUT_PARAMS,
    apply_scope: options.apply_scope || "sessionDefault",
    clip_id: options.clip_id || null,
    ai_source: options.ai_source || null,
    ai_inputs: options.ai_inputs || {},
    ai_prompt_used: options.ai_prompt_used || null,
    ai_variant_index: options.ai_variant_index || 0,
    generation_model: options.generation_model || null,
    asset_url: options.asset_url || null,
    thumbnail_url: options.thumbnail_url || null,
  };

  const { data, error } = await supabase
    .from("frame_overlays" as any)
    .insert(insertData as any)
    .select()
    .single();

  if (error) {
    console.error("[FrameOverlays] Create error:", error);
    return null;
  }

  return rowToFrameOverlay(data as unknown as FrameOverlayRow);
}

/**
 * Create a frame overlay from a preset
 */
export async function createFromPreset(
  userId: string,
  presetKey: string,
  sessionId?: string,
  overrides?: Partial<FrameStyleParams>
): Promise<FrameOverlay | null> {
  const preset = PRESET_FRAMES.find((p) => p.key === presetKey);
  if (!preset) {
    console.error("[FrameOverlays] Preset not found:", presetKey);
    return null;
  }

  const styleParams: FrameStyleParams = {
    ...DEFAULT_STYLE_PARAMS,
    ...preset.style,
    ...overrides,
  };

  return createFrameOverlay(userId, {
    type: "preset",
    preset_key: presetKey,
    name: preset.name,
    session_id: sessionId,
    style_params: styleParams,
  });
}

/**
 * Get frame overlays for a user
 */
export async function getUserFrameOverlays(userId: string): Promise<FrameOverlay[]> {
  const { data, error } = await supabase
    .from("frame_overlays" as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[FrameOverlays] Fetch error:", error);
    return [];
  }

  return (data as unknown as FrameOverlayRow[]).map(rowToFrameOverlay);
}

/**
 * Get frame overlays for a session
 */
export async function getSessionFrameOverlays(sessionId: string): Promise<FrameOverlay[]> {
  const { data, error } = await supabase
    .from("frame_overlays" as any)
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[FrameOverlays] Session fetch error:", error);
    return [];
  }

  return (data as unknown as FrameOverlayRow[]).map(rowToFrameOverlay);
}

/**
 * Get a single frame overlay by ID
 */
export async function getFrameOverlay(frameId: string): Promise<FrameOverlay | null> {
  const { data, error } = await supabase
    .from("frame_overlays" as any)
    .select("*")
    .eq("id", frameId)
    .single();

  if (error) {
    console.error("[FrameOverlays] Get error:", error);
    return null;
  }

  return rowToFrameOverlay(data as unknown as FrameOverlayRow);
}

/**
 * Update a frame overlay
 */
export async function updateFrameOverlay(
  frameId: string,
  updates: Partial<Omit<FrameOverlay, "id" | "user_id" | "created_at">>
): Promise<FrameOverlay | null> {
  const { data, error } = await supabase
    .from("frame_overlays" as any)
    .update(updates as any)
    .eq("id", frameId)
    .select()
    .single();

  if (error) {
    console.error("[FrameOverlays] Update error:", error);
    return null;
  }

  return rowToFrameOverlay(data as unknown as FrameOverlayRow);
}

/**
 * Delete a frame overlay
 */
export async function deleteFrameOverlay(frameId: string): Promise<boolean> {
  const { error } = await supabase
    .from("frame_overlays" as any)
    .delete()
    .eq("id", frameId);

  if (error) {
    console.error("[FrameOverlays] Delete error:", error);
    return false;
  }

  return true;
}

/**
 * Set a frame as the signature frame for a session
 */
export async function setSignatureFrame(
  sessionId: string,
  frameId: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from("capture_sessions")
    .update({ signature_frame_id: frameId } as any)
    .eq("id", sessionId);

  if (error) {
    console.error("[FrameOverlays] Set signature error:", error);
    return false;
  }

  return true;
}

/**
 * Set user's default frame for new sessions
 */
export async function setDefaultFrame(
  userId: string,
  frameId: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from("user_preferences")
    .update({ default_frame_id: frameId } as any)
    .eq("user_id", userId);

  if (error) {
    console.error("[FrameOverlays] Set default error:", error);
    return false;
  }

  return true;
}

/**
 * Duplicate a frame overlay (for creating variants)
 */
export async function duplicateFrameOverlay(
  frameId: string,
  overrides?: Partial<FrameOverlay>
): Promise<FrameOverlay | null> {
  const original = await getFrameOverlay(frameId);
  if (!original) return null;

  return createFrameOverlay(original.user_id, {
    type: original.type,
    preset_key: original.preset_key,
    name: overrides?.name || `${original.name || "Frame"} (Copy)`,
    session_id: overrides?.session_id ?? original.session_id,
    style_params: overrides?.style_params || original.style_params,
    layout_params: overrides?.layout_params || original.layout_params,
    apply_scope: overrides?.apply_scope || original.apply_scope,
    ai_source: original.ai_source,
    ai_inputs: original.ai_inputs,
    ai_variant_index: (original.ai_variant_index || 0) + 1,
    generation_model: original.generation_model,
    asset_url: original.asset_url,
    thumbnail_url: original.thumbnail_url,
  });
}

// ============= CSS Generation =============

/**
 * Generate CSS classes for a frame overlay (for live preview)
 * These styles are applied as a CSS overlay, not composited into the video
 */
export function generateFrameCSS(style: FrameStyleParams): string {
  const classes: string[] = [];

  // Shape
  switch (style.shape) {
    case "circle":
      classes.push("rounded-full");
      break;
    case "rounded":
      classes.push("rounded-xl");
      break;
    case "hex":
      classes.push("clip-path-hex");
      break;
    case "pill":
      classes.push("rounded-full aspect-[2/1]");
      break;
    case "square":
    default:
      classes.push("rounded-none");
  }

  // Stroke
  if (style.strokeWidth > 0) {
    classes.push(`ring-${Math.min(style.strokeWidth, 4)}`);
    classes.push(`ring-${style.colorTheme}`);
  }

  // Shadow
  if (style.shadowIntensity > 0.5) {
    classes.push("shadow-2xl");
  } else if (style.shadowIntensity > 0.2) {
    classes.push("shadow-lg");
  } else if (style.shadowIntensity > 0) {
    classes.push("shadow-md");
  }

  return classes.join(" ");
}

/**
 * Generate inline styles for glow effect
 */
export function generateGlowStyle(style: FrameStyleParams): React.CSSProperties {
  if (style.glowIntensity <= 0) return {};

  const glowColor = getThemeColor(style.colorTheme);
  const blurRadius = Math.round(style.glowIntensity * 20);
  const spreadRadius = Math.round(style.glowIntensity * 10);

  return {
    boxShadow: `0 0 ${blurRadius}px ${spreadRadius}px ${glowColor}`,
  };
}

/**
 * Get color value from theme token
 */
function getThemeColor(theme: string): string {
  const colorMap: Record<string, string> = {
    primary: "hsl(var(--primary))",
    accent: "hsl(var(--accent))",
    destructive: "hsl(var(--destructive))",
    "neon-pink": "#ff00ff",
    "neon-cyan": "#00ffff",
    "neon-green": "#00ff00",
    "retro-green": "#00ff00",
    white: "#ffffff",
  };

  return colorMap[theme] || colorMap.primary;
}
