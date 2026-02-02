/**
 * Effect Events - VFX/SFX Timeline Metadata
 * 
 * Effects are stored as timeline metadata events that are:
 * - Rendered as lightweight overlays during preview
 * - Baked/composited during post-processing/export
 * - NEVER processed during live capture (performance-safe)
 */

import { supabase } from "@/integrations/supabase/client";

// ============= Types =============

export type EffectType = "vfx" | "sfx";
export type EffectIntensity = "low" | "med" | "high";
export type ApplyScope = "clip" | "reel" | "session";
export type SnapSource = "moment" | "audioPeak" | "manual";

export interface EffectEvent {
  id: string;
  user_id: string;
  session_id: string;
  type: EffectType;
  key: string;
  start_time_ms: number;
  duration_ms: number;
  intensity: EffectIntensity | null;
  volume: number | null;
  params: Record<string, unknown>;
  apply_scope: ApplyScope;
  clip_id: string | null;
  reel_id: string | null;
  snap_source: SnapSource | null;
  snapped_to_id: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Database row type
interface EffectEventRow {
  id: string;
  user_id: string;
  session_id: string;
  type: string;
  key: string;
  start_time_ms: number;
  duration_ms: number;
  intensity: string | null;
  volume: number | null;
  params: unknown;
  apply_scope: string;
  clip_id: string | null;
  reel_id: string | null;
  snap_source: string | null;
  snapped_to_id: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============= Effect Catalog =============

export interface VFXDefinition {
  key: string;
  name: string;
  description: string;
  category: "impact" | "transition" | "emphasis" | "timing";
  defaultDurationMs: number;
  defaultIntensity: EffectIntensity;
  icon: string; // Lucide icon name
}

export interface SFXDefinition {
  key: string;
  name: string;
  description: string;
  category: "impact" | "comedic" | "hype" | "ambient";
  defaultDurationMs: number;
  defaultVolume: number;
  icon: string;
}

export const VFX_CATALOG: VFXDefinition[] = [
  // Impact
  { key: "screenShake", name: "Screen Shake", description: "Camera shake on impact", category: "impact", defaultDurationMs: 300, defaultIntensity: "med", icon: "Vibrate" },
  { key: "zoomPunch", name: "Zoom Punch", description: "Quick zoom in/out punch", category: "impact", defaultDurationMs: 400, defaultIntensity: "med", icon: "ZoomIn" },
  { key: "hitmarker", name: "Hitmarker", description: "Classic hitmarker overlay", category: "impact", defaultDurationMs: 200, defaultIntensity: "high", icon: "Crosshair" },
  { key: "flashBang", name: "Flash", description: "White flash overlay", category: "impact", defaultDurationMs: 150, defaultIntensity: "low", icon: "Zap" },
  
  // Transition
  { key: "whipPan", name: "Whip Pan", description: "Fast blur transition", category: "transition", defaultDurationMs: 300, defaultIntensity: "med", icon: "ArrowRightLeft" },
  { key: "glitchCut", name: "Glitch Cut", description: "Digital glitch effect", category: "transition", defaultDurationMs: 250, defaultIntensity: "med", icon: "Tv2" },
  
  // Emphasis  
  { key: "vignette", name: "Vignette Pulse", description: "Darkened edges pulse", category: "emphasis", defaultDurationMs: 500, defaultIntensity: "low", icon: "Circle" },
  { key: "colorPop", name: "Color Pop", description: "Saturation boost", category: "emphasis", defaultDurationMs: 400, defaultIntensity: "med", icon: "Palette" },
  { key: "slowZoom", name: "Slow Zoom", description: "Gradual zoom emphasis", category: "emphasis", defaultDurationMs: 1000, defaultIntensity: "low", icon: "Search" },
  
  // Timing
  { key: "freezeFrame", name: "Freeze Frame", description: "Pause on moment", category: "timing", defaultDurationMs: 1500, defaultIntensity: "high", icon: "Pause" },
  { key: "speedRamp", name: "Speed Ramp", description: "Slow-mo to fast cut", category: "timing", defaultDurationMs: 800, defaultIntensity: "med", icon: "Gauge" },
];

export const SFX_CATALOG: SFXDefinition[] = [
  // Impact
  { key: "bassDrop", name: "Bass Drop", description: "Deep bass hit", category: "impact", defaultDurationMs: 600, defaultVolume: 80, icon: "Activity" },
  { key: "boom", name: "Boom", description: "Cinematic boom", category: "impact", defaultDurationMs: 400, defaultVolume: 75, icon: "Bomb" },
  { key: "punch", name: "Punch", description: "Impact punch sound", category: "impact", defaultDurationMs: 200, defaultVolume: 70, icon: "Hammer" },
  { key: "hitmarkerSfx", name: "Hitmarker", description: "Classic hitmarker ding", category: "impact", defaultDurationMs: 150, defaultVolume: 65, icon: "Crosshair" },
  
  // Comedic
  { key: "vine_boom", name: "Vine Boom", description: "The classic boom", category: "comedic", defaultDurationMs: 500, defaultVolume: 85, icon: "Laugh" },
  { key: "bruh", name: "Bruh", description: "Bruh sound effect", category: "comedic", defaultDurationMs: 400, defaultVolume: 70, icon: "Meh" },
  { key: "oof", name: "Oof", description: "Oof sound", category: "comedic", defaultDurationMs: 300, defaultVolume: 65, icon: "Frown" },
  { key: "airhorn", name: "Air Horn", description: "MLG air horn", category: "comedic", defaultDurationMs: 800, defaultVolume: 75, icon: "Volume2" },
  
  // Hype
  { key: "riseFx", name: "Rise", description: "Building tension riser", category: "hype", defaultDurationMs: 2000, defaultVolume: 60, icon: "TrendingUp" },
  { key: "whoosh", name: "Whoosh", description: "Fast whoosh sweep", category: "hype", defaultDurationMs: 300, defaultVolume: 55, icon: "Wind" },
  { key: "reverseHit", name: "Reverse Hit", description: "Reversed impact", category: "hype", defaultDurationMs: 400, defaultVolume: 65, icon: "Undo2" },
  
  // Ambient
  { key: "crowdCheer", name: "Crowd Cheer", description: "Victory crowd", category: "ambient", defaultDurationMs: 2500, defaultVolume: 50, icon: "Users" },
  { key: "suspense", name: "Suspense", description: "Tension drone", category: "ambient", defaultDurationMs: 3000, defaultVolume: 45, icon: "AlertTriangle" },
];

// ============= Helper Functions =============

function rowToEffectEvent(row: EffectEventRow): EffectEvent {
  return {
    ...row,
    type: row.type as EffectType,
    intensity: row.intensity as EffectIntensity | null,
    apply_scope: row.apply_scope as ApplyScope,
    snap_source: row.snap_source as SnapSource | null,
    params: (row.params as Record<string, unknown>) || {},
  };
}

export function getVFXDefinition(key: string): VFXDefinition | undefined {
  return VFX_CATALOG.find((v) => v.key === key);
}

export function getSFXDefinition(key: string): SFXDefinition | undefined {
  return SFX_CATALOG.find((s) => s.key === key);
}

export function getDefaultDuration(type: EffectType, key: string): number {
  if (type === "vfx") {
    return getVFXDefinition(key)?.defaultDurationMs || 500;
  }
  return getSFXDefinition(key)?.defaultDurationMs || 500;
}

export function getDefaultIntensity(key: string): EffectIntensity {
  return getVFXDefinition(key)?.defaultIntensity || "med";
}

export function getDefaultVolume(key: string): number {
  return getSFXDefinition(key)?.defaultVolume || 70;
}

// ============= API Functions =============

/**
 * Create a new effect event
 */
export async function createEffectEvent(
  userId: string,
  sessionId: string,
  options: {
    type: EffectType;
    key: string;
    startTimeMs: number;
    durationMs?: number;
    intensity?: EffectIntensity;
    volume?: number;
    params?: Record<string, unknown>;
    applyScope?: ApplyScope;
    clipId?: string;
    reelId?: string;
    snapSource?: SnapSource;
    snappedToId?: string;
  }
): Promise<EffectEvent | null> {
  const insertData = {
    user_id: userId,
    session_id: sessionId,
    type: options.type,
    key: options.key,
    start_time_ms: options.startTimeMs,
    duration_ms: options.durationMs || getDefaultDuration(options.type, options.key),
    intensity: options.type === "vfx" ? (options.intensity || getDefaultIntensity(options.key)) : null,
    volume: options.type === "sfx" ? (options.volume ?? getDefaultVolume(options.key)) : null,
    params: options.params || {},
    apply_scope: options.applyScope || "session",
    clip_id: options.clipId || null,
    reel_id: options.reelId || null,
    snap_source: options.snapSource || "manual",
    snapped_to_id: options.snappedToId || null,
    is_enabled: true,
  };

  const { data, error } = await supabase
    .from("effect_events" as any)
    .insert(insertData as any)
    .select()
    .single();

  if (error) {
    console.error("[EffectEvents] Create error:", error);
    return null;
  }

  return rowToEffectEvent(data as unknown as EffectEventRow);
}

/**
 * Get all effect events for a session
 */
export async function getSessionEffectEvents(sessionId: string): Promise<EffectEvent[]> {
  const { data, error } = await supabase
    .from("effect_events" as any)
    .select("*")
    .eq("session_id", sessionId)
    .order("start_time_ms", { ascending: true });

  if (error) {
    console.error("[EffectEvents] Fetch error:", error);
    return [];
  }

  return (data as unknown as EffectEventRow[]).map(rowToEffectEvent);
}

/**
 * Get effect events in a time range (for preview/export)
 */
export async function getEffectEventsInRange(
  sessionId: string,
  startMs: number,
  endMs: number
): Promise<EffectEvent[]> {
  const { data, error } = await supabase
    .from("effect_events" as any)
    .select("*")
    .eq("session_id", sessionId)
    .eq("is_enabled", true)
    .gte("start_time_ms", startMs)
    .lte("start_time_ms", endMs)
    .order("start_time_ms", { ascending: true });

  if (error) {
    console.error("[EffectEvents] Range fetch error:", error);
    return [];
  }

  return (data as unknown as EffectEventRow[]).map(rowToEffectEvent);
}

/**
 * Update an effect event
 */
export async function updateEffectEvent(
  eventId: string,
  updates: Partial<Omit<EffectEvent, "id" | "user_id" | "session_id" | "created_at">>
): Promise<EffectEvent | null> {
  const { data, error } = await supabase
    .from("effect_events" as any)
    .update(updates as any)
    .eq("id", eventId)
    .select()
    .single();

  if (error) {
    console.error("[EffectEvents] Update error:", error);
    return null;
  }

  return rowToEffectEvent(data as unknown as EffectEventRow);
}

/**
 * Delete an effect event
 */
export async function deleteEffectEvent(eventId: string): Promise<boolean> {
  const { error } = await supabase
    .from("effect_events" as any)
    .delete()
    .eq("id", eventId);

  if (error) {
    console.error("[EffectEvents] Delete error:", error);
    return false;
  }

  return true;
}

/**
 * Toggle effect enabled state
 */
export async function toggleEffectEnabled(eventId: string, enabled: boolean): Promise<boolean> {
  const result = await updateEffectEvent(eventId, { is_enabled: enabled });
  return result !== null;
}

/**
 * Duplicate an effect event (for copy/paste)
 */
export async function duplicateEffectEvent(
  eventId: string,
  newStartTimeMs: number
): Promise<EffectEvent | null> {
  // First fetch the original
  const { data: original, error: fetchError } = await supabase
    .from("effect_events" as any)
    .select("*")
    .eq("id", eventId)
    .single();

  if (fetchError || !original) {
    console.error("[EffectEvents] Duplicate fetch error:", fetchError);
    return null;
  }

  const row = original as unknown as EffectEventRow;

  // Create a copy with new start time
  return createEffectEvent(row.user_id, row.session_id, {
    type: row.type as EffectType,
    key: row.key,
    startTimeMs: newStartTimeMs,
    durationMs: row.duration_ms,
    intensity: row.intensity as EffectIntensity | undefined,
    volume: row.volume ?? undefined,
    params: row.params as Record<string, unknown>,
    applyScope: row.apply_scope as ApplyScope,
    clipId: row.clip_id ?? undefined,
    reelId: row.reel_id ?? undefined,
    snapSource: "manual", // Duplicates are manual placement
  });
}

/**
 * Batch create effects (for applying reel packages)
 */
export async function batchCreateEffects(
  userId: string,
  sessionId: string,
  effects: Array<{
    type: EffectType;
    key: string;
    startTimeMs: number;
    durationMs?: number;
    intensity?: EffectIntensity;
    volume?: number;
    snapSource?: SnapSource;
    snappedToId?: string;
  }>
): Promise<EffectEvent[]> {
  const insertData = effects.map((e) => ({
    user_id: userId,
    session_id: sessionId,
    type: e.type,
    key: e.key,
    start_time_ms: e.startTimeMs,
    duration_ms: e.durationMs || getDefaultDuration(e.type, e.key),
    intensity: e.type === "vfx" ? (e.intensity || getDefaultIntensity(e.key)) : null,
    volume: e.type === "sfx" ? (e.volume ?? getDefaultVolume(e.key)) : null,
    params: {},
    apply_scope: "session",
    snap_source: e.snapSource || "manual",
    snapped_to_id: e.snappedToId || null,
    is_enabled: true,
  }));

  const { data, error } = await supabase
    .from("effect_events" as any)
    .insert(insertData as any)
    .select();

  if (error) {
    console.error("[EffectEvents] Batch create error:", error);
    return [];
  }

  return (data as unknown as EffectEventRow[]).map(rowToEffectEvent);
}

/**
 * Delete all effects for a session
 */
export async function clearSessionEffects(sessionId: string): Promise<boolean> {
  const { error } = await supabase
    .from("effect_events" as any)
    .delete()
    .eq("session_id", sessionId);

  if (error) {
    console.error("[EffectEvents] Clear error:", error);
    return false;
  }

  return true;
}

// ============= Export Renderer Helpers =============

/**
 * Get all effects sorted and grouped for export rendering
 */
export interface EffectRenderGroup {
  timeMs: number;
  vfx: EffectEvent[];
  sfx: EffectEvent[];
}

export async function getEffectsForExport(sessionId: string): Promise<EffectRenderGroup[]> {
  const events = await getSessionEffectEvents(sessionId);
  const enabled = events.filter((e) => e.is_enabled);

  // Group by start time
  const groups = new Map<number, EffectRenderGroup>();

  for (const event of enabled) {
    const timeKey = event.start_time_ms;
    if (!groups.has(timeKey)) {
      groups.set(timeKey, { timeMs: timeKey, vfx: [], sfx: [] });
    }
    const group = groups.get(timeKey)!;
    if (event.type === "vfx") {
      group.vfx.push(event);
    } else {
      group.sfx.push(event);
    }
  }

  // Sort by time
  return Array.from(groups.values()).sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * Check if any effects exist for a session (for UI indicators)
 */
export async function hasSessionEffects(sessionId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("effect_events" as any)
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("is_enabled", true);

  if (error) return false;
  return (count || 0) > 0;
}
