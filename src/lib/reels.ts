/**
 * Reels Data Layer
 * 
 * Functions for managing Reel entities - first-class objects
 * that represent edited clips with effects, frames, and packages.
 */

import { supabase } from "@/integrations/supabase/client";

export type ReelStatus = "draft" | "rendering" | "ready" | "failed";
export type AspectRatio = "16:9" | "9:16" | "1:1";

export interface Reel {
  id: string;
  user_id: string;
  session_id: string | null;
  title: string;
  aspect_ratio: AspectRatio;
  status: ReelStatus;
  source_moment_ids: string[];
  duration_seconds: number | null;
  thumbnail_url: string | null;
  preview_url: string | null;
  output_url: string | null;
  output_file_size_bytes: number | null;
  render_started_at: string | null;
  render_completed_at: string | null;
  render_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReelInput {
  sessionId: string;
  title?: string;
  aspectRatio: AspectRatio;
  momentIds: string[];
}

/**
 * Create a new reel from selected moments
 */
export async function createReel(input: CreateReelInput): Promise<Reel> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("reels")
    .insert({
      user_id: user.id,
      session_id: input.sessionId,
      title: input.title || "Untitled Reel",
      aspect_ratio: input.aspectRatio,
      source_moment_ids: input.momentIds,
      status: "draft",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Reel;
}

/**
 * Get a single reel by ID
 */
export async function getReel(reelId: string): Promise<Reel | null> {
  const { data, error } = await supabase
    .from("reels")
    .select("*")
    .eq("id", reelId)
    .maybeSingle();

  if (error) throw error;
  return data as Reel | null;
}

/**
 * Get all reels for a session
 */
export async function getReelsForSession(sessionId: string): Promise<Reel[]> {
  const { data, error } = await supabase
    .from("reels")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Reel[];
}

/**
 * Get all reels for current user
 */
export async function getUserReels(): Promise<Reel[]> {
  const { data, error } = await supabase
    .from("reels")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Reel[];
}

/**
 * Update reel properties
 */
export async function updateReel(
  reelId: string,
  updates: Partial<Pick<Reel, "title" | "aspect_ratio" | "source_moment_ids" | "status">>
): Promise<Reel> {
  const { data, error } = await supabase
    .from("reels")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reelId)
    .select()
    .single();

  if (error) throw error;
  return data as Reel;
}

/**
 * Delete a reel
 */
export async function deleteReel(reelId: string): Promise<void> {
  const { error } = await supabase
    .from("reels")
    .delete()
    .eq("id", reelId);

  if (error) throw error;
}

/**
 * Start rendering a reel (updates status)
 */
export async function startReelRender(reelId: string): Promise<Reel> {
  const { data, error } = await supabase
    .from("reels")
    .update({
      status: "rendering",
      render_started_at: new Date().toISOString(),
      render_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reelId)
    .select()
    .single();

  if (error) throw error;
  return data as Reel;
}

/**
 * Complete reel render successfully
 */
export async function completeReelRender(
  reelId: string,
  outputUrl: string,
  fileSizeBytes?: number
): Promise<Reel> {
  const { data, error } = await supabase
    .from("reels")
    .update({
      status: "ready",
      output_url: outputUrl,
      output_file_size_bytes: fileSizeBytes || null,
      render_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reelId)
    .select()
    .single();

  if (error) throw error;
  return data as Reel;
}

/**
 * Mark reel render as failed
 */
export async function failReelRender(reelId: string, errorMessage: string): Promise<Reel> {
  const { data, error } = await supabase
    .from("reels")
    .update({
      status: "failed",
      render_error: errorMessage,
      render_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reelId)
    .select()
    .single();

  if (error) throw error;
  return data as Reel;
}
