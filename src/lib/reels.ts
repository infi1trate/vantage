/**
 * Reels Data Layer
 * 
 * Functions for managing Reel entities - first-class objects
 * that represent edited clips with effects, frames, and packages.
 */

import { supabase } from "@/integrations/supabase/client";

export type ReelStatus = "compiling" | "draft" | "rendering" | "ready" | "failed";
export type AspectRatio = "16:9" | "9:16" | "1:1";
export type AssemblyStep = 
  | "collecting_clips"
  | "stitching_sequence"
  | "rendering_preview"
  | "finalizing_manifest"
  | "ready"
  | "failed";
export type PlaybackMode = "preview" | "manifest";

/**
 * Manifest clip entry - ordered clip list with timing info
 */
export interface ManifestClip {
  momentId: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  order: number;
}

/**
 * Reel manifest - complete playback specification
 */
export interface ReelManifest {
  clips: ManifestClip[];
  totalDurationMs: number;
  aspectRatio: AspectRatio;
  createdAt: string;
}

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
  // Assembly instrumentation
  assembly_step: AssemblyStep | null;
  step_started_at: string | null;
  step_completed_at: string | null;
  // Manifest and playback
  manifest: ReelManifest | null;
  preview_ref: string | null;
  playback_mode: PlaybackMode;
  total_duration_ms: number | null;
  // Retry tracking
  attempt_count: number;
  job_id: string | null;
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
 * Convert raw Supabase row to typed Reel
 * Handles JSON -> typed object conversion for manifest
 */
function toReel(row: unknown): Reel {
  const r = row as Record<string, unknown>;
  return {
    ...r,
    manifest: r.manifest as ReelManifest | null,
    playback_mode: (r.playback_mode as PlaybackMode) || "preview",
  } as Reel;
}

function toReelArray(rows: unknown[]): Reel[] {
  return rows.map(toReel);
}

/**
 * Create a new reel from selected moments
 * 
 * Reels are first-class persistent objects that exist independently
 * of Session Detail and are always edited via the Reel Editor.
 */
export async function createReel(input: CreateReelInput): Promise<Reel> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Create with "compiling" status and initial assembly step
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("reels")
    .insert({
      user_id: user.id,
      session_id: input.sessionId,
      title: input.title || "Untitled Reel",
      aspect_ratio: input.aspectRatio,
      source_moment_ids: input.momentIds,
      status: "compiling",
      assembly_step: "collecting_clips",
      step_started_at: now,
    })
    .select()
    .single();

  if (error) throw error;
  
  // Transition to draft once assembly completes
  // (Currently instant for metadata-only reels; future: async clip assembly)
  const { data: updatedData, error: updateError } = await supabase
    .from("reels")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", data.id)
    .select()
    .single();

  if (updateError) throw updateError;
  return toReel(updatedData);
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
  return data ? toReel(data) : null;
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
  return toReelArray(data || []);
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
  return toReelArray(data || []);
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
  return toReel(data);
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
  return toReel(data);
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
  return toReel(data);
}

/**
 * Update assembly step with timestamp instrumentation
 * Used for debugging to identify exactly where stalls occur
 */
export async function updateAssemblyStep(
  reelId: string,
  step: AssemblyStep,
  options?: { completesPrevious?: boolean }
): Promise<void> {
  const now = new Date().toISOString();
  
  const updates: Record<string, unknown> = {
    assembly_step: step,
    step_started_at: now,
    updated_at: now,
  };
  
  // If this step completes the previous one, also record completion time
  if (options?.completesPrevious) {
    updates.step_completed_at = now;
  } else {
    updates.step_completed_at = null;
  }
  
  const { error } = await supabase
    .from("reels")
    .update(updates)
    .eq("id", reelId);

  if (error) {
    console.error("[Reels] Failed to update assembly step:", error);
  } else {
    console.log(`[Reels] Assembly step updated: ${step}`);
  }
}

/**
 * Mark assembly step as completed
 */
export async function completeAssemblyStep(reelId: string): Promise<void> {
  const { error } = await supabase
    .from("reels")
    .update({
      step_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reelId);

  if (error) {
    console.error("[Reels] Failed to complete assembly step:", error);
  }
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
  return toReel(data);
}

/**
 * Generate a unique job ID for assembly tracking
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Retry reel assembly with clean state reset
 * 
 * This function:
 * 1. Clears any partial preview data
 * 2. Resets all in-progress flags
 * 3. Sets status back to "compiling" with "collecting_clips" step
 * 4. Increments attempt count
 * 5. Generates a new job_id to prevent duplicate concurrent jobs
 * 
 * @returns The new job_id that should be used to track this assembly attempt
 */
export async function retryAssembly(reelId: string): Promise<{ reel: Reel; jobId: string }> {
  const now = new Date().toISOString();
  const newJobId = generateJobId();
  
  console.log(`[Reels] Retrying assembly for ${reelId} with job ${newJobId}`);
  
  // Get current attempt count
  const currentReel = await getReel(reelId);
  const newAttemptCount = (currentReel?.attempt_count || 0) + 1;
  
  const { data, error } = await supabase
    .from("reels")
    .update({
      // Reset status
      status: "compiling",
      // Reset assembly step to beginning
      assembly_step: "collecting_clips",
      step_started_at: now,
      step_completed_at: null,
      // Clear partial preview data
      preview_ref: null,
      preview_url: null,
      playback_mode: "preview", // Reset to default, will be set appropriately during assembly
      // Clear error state
      render_error: null,
      render_started_at: null,
      render_completed_at: null,
      // Increment attempt count and set new job ID
      attempt_count: newAttemptCount,
      job_id: newJobId,
      updated_at: now,
    })
    .eq("id", reelId)
    .select()
    .single();

  if (error) throw error;
  
  console.log(`[Reels] Assembly retry initiated, attempt ${newAttemptCount}, job ${newJobId}`);
  
  return { reel: toReel(data), jobId: newJobId };
}

/**
 * Check if a job ID is still the active one for a reel
 * Used to prevent duplicate/stale jobs from completing
 */
export async function isJobActive(reelId: string, jobId: string): Promise<boolean> {
  const reel = await getReel(reelId);
  return reel?.job_id === jobId;
}

/**
 * Cancel any in-progress assembly by clearing the job_id
 * The assembly process should check isJobActive before completing
 */
export async function cancelAssemblyJob(reelId: string): Promise<void> {
  const { error } = await supabase
    .from("reels")
    .update({
      job_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reelId);

  if (error) {
    console.error("[Reels] Failed to cancel assembly job:", error);
  } else {
    console.log(`[Reels] Cancelled assembly job for ${reelId}`);
  }
}

/**
 * Deterministic assembly result
 */
export interface AssemblyResult {
  success: boolean;
  reel: Reel | null;
  error?: string;
  previewAvailable: boolean;
}

/**
 * Execute deterministic reel assembly
 * 
 * CRITICAL: This function ALWAYS ends with reel.status = "ready" or "failed"
 * It wraps all steps in try/catch and ensures terminal state is set.
 * 
 * If preview rendering fails but manifest exists, we still mark ready with
 * playback_mode = "manifest" to allow export to work.
 */
export async function executeAssembly(
  reelId: string,
  momentDurations: { momentId: string; durationMs: number }[]
): Promise<AssemblyResult> {
  const now = () => new Date().toISOString();
  let previewAvailable = false;
  
  try {
    console.log(`[Reels] Starting deterministic assembly for ${reelId}`);
    
    // STEP 1: Collecting clips
    await updateAssemblyStep(reelId, "collecting_clips");
    
    // Build the manifest from moments
    const clips: ManifestClip[] = momentDurations.map((m, index) => ({
      momentId: m.momentId,
      startMs: 0, // TODO: Calculate from annotation timestamps
      endMs: m.durationMs,
      durationMs: m.durationMs,
      order: index,
    }));
    
    const totalDurationMs = clips.reduce((sum, c) => sum + c.durationMs, 0);
    
    await completeAssemblyStep(reelId);
    
    // STEP 2: Stitching sequence
    await updateAssemblyStep(reelId, "stitching_sequence", { completesPrevious: true });
    
    // Get current reel for aspect ratio
    const currentReel = await getReel(reelId);
    if (!currentReel) {
      throw new Error("Reel not found during assembly");
    }
    
    const manifest: ReelManifest = {
      clips,
      totalDurationMs,
      aspectRatio: currentReel.aspect_ratio,
      createdAt: now(),
    };
    
    // Save manifest (serialize to JSON for Supabase)
    await supabase
      .from("reels")
      .update({
        manifest: JSON.parse(JSON.stringify(manifest)),
        total_duration_ms: totalDurationMs,
        duration_seconds: Math.round(totalDurationMs / 1000),
        updated_at: now(),
      })
      .eq("id", reelId);
    
    await completeAssemblyStep(reelId);
    
    // STEP 3: Rendering preview
    await updateAssemblyStep(reelId, "rendering_preview", { completesPrevious: true });
    
    // Attempt preview render (this may fail, which is recoverable)
    try {
      // TODO: Actual preview rendering logic
      // For now, simulate with the session video as preview
      if (currentReel.session_id) {
        const { data: session } = await supabase
          .from("capture_sessions")
          .select("video_url")
          .eq("id", currentReel.session_id)
          .maybeSingle();
        
        if (session?.video_url) {
          await supabase
            .from("reels")
            .update({
              preview_ref: session.video_url,
              preview_url: session.video_url, // Use session video as preview for now
              playback_mode: "preview",
              updated_at: now(),
            })
            .eq("id", reelId);
          
          previewAvailable = true;
        }
      }
      
      await completeAssemblyStep(reelId);
    } catch (previewError) {
      // Preview failed, but we can continue with manifest mode
      console.warn(`[Reels] Preview render failed, falling back to manifest mode:`, previewError);
      
      await supabase
        .from("reels")
        .update({
          preview_ref: null,
          playback_mode: "manifest",
          updated_at: now(),
        })
        .eq("id", reelId);
      
      previewAvailable = false;
    }
    
    // STEP 4: Finalizing manifest
    await updateAssemblyStep(reelId, "finalizing_manifest", { completesPrevious: true });
    
    // Validate required fields before marking ready
    const finalReel = await getReel(reelId);
    if (!finalReel?.manifest) {
      throw new Error("Manifest is required but missing");
    }
    if (!finalReel.total_duration_ms || finalReel.total_duration_ms <= 0) {
      throw new Error("Total duration is required but invalid");
    }
    
    await completeAssemblyStep(reelId);
    
    // TERMINAL STATE: Ready
    await updateAssemblyStep(reelId, "ready", { completesPrevious: true });
    
    const { data: readyReel, error: readyError } = await supabase
      .from("reels")
      .update({
        status: "draft", // draft = ready for editing
        assembly_step: "ready",
        render_error: previewAvailable ? null : "Preview unavailable (export will still work)",
        updated_at: now(),
      })
      .eq("id", reelId)
      .select()
      .single();
    
    if (readyError) throw readyError;
    
    console.log(`[Reels] Assembly complete for ${reelId}, preview: ${previewAvailable}`);
    
    return {
      success: true,
      reel: toReel(readyReel),
      previewAvailable,
    };
    
  } catch (error) {
    // TERMINAL STATE: Failed
    console.error(`[Reels] Assembly failed for ${reelId}:`, error);
    
    const errorMessage = error instanceof Error ? error.message : "Assembly failed unexpectedly";
    
    try {
      await updateAssemblyStep(reelId, "failed");
      
      const { data: failedReel } = await supabase
        .from("reels")
        .update({
          status: "failed",
          assembly_step: "failed",
          render_error: errorMessage,
          updated_at: now(),
        })
        .eq("id", reelId)
        .select()
        .single();
      
      return {
        success: false,
        reel: failedReel ? toReel(failedReel) : null,
        error: errorMessage,
        previewAvailable: false,
      };
    } catch (updateError) {
      console.error(`[Reels] Failed to update failure state:`, updateError);
      return {
        success: false,
        reel: null,
        error: errorMessage,
        previewAvailable: false,
      };
    }
  }
}
