/**
 * Dropbox Sync Client
 * 
 * Handles background sync of recordings to Dropbox as a redundancy/backup destination.
 * This is NOT a primary storage - recordings remain in the main Library.
 */

import { supabase } from "@/integrations/supabase/client";

export interface DropboxSyncStatus {
  id: string;
  user_id: string;
  session_id: string;
  dropbox_path: string | null;
  dropbox_file_id: string | null;
  sync_status: "pending" | "syncing" | "completed" | "failed";
  file_size_bytes: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Check if user has Dropbox connected
 */
export async function isDropboxConnected(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("connected_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "dropbox")
    .single();

  return !error && !!data;
}

/**
 * Get Dropbox connection info
 */
export async function getDropboxConnection(): Promise<{
  connected: boolean;
  email?: string;
  connectedAt?: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { connected: false };

  const { data, error } = await supabase
    .from("connected_accounts")
    .select("provider_email, connected_at")
    .eq("user_id", user.id)
    .eq("provider", "dropbox")
    .single();

  if (error || !data) {
    return { connected: false };
  }

  return {
    connected: true,
    email: data.provider_email || undefined,
    connectedAt: data.connected_at,
  };
}

/**
 * Get sync status for a session
 */
export async function getSessionSyncStatus(sessionId: string): Promise<DropboxSyncStatus | null> {
  const { data, error } = await supabase
    .from("dropbox_sync_status")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (error || !data) return null;
  return data as DropboxSyncStatus;
}

/**
 * Queue a session for Dropbox sync and trigger background upload
 * This is called after successful cloud upload in the ProcessingManager
 */
export async function queueDropboxSync(
  sessionId: string,
  videoUrl: string,
  fileName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Dropbox is connected
    const connected = await isDropboxConnected();
    if (!connected) {
      console.log("[DropboxSync] Skipping - Dropbox not connected");
      return { success: true }; // Not an error, just skip
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn("[DropboxSync] No auth session");
      return { success: false, error: "Not authenticated" };
    }

    console.log(`[DropboxSync] Queueing sync for session ${sessionId}`);

    // Create pending sync status
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error: insertError } = await supabase
      .from("dropbox_sync_status")
      .upsert({
        user_id: user.id,
        session_id: sessionId,
        sync_status: "pending",
      }, {
        onConflict: "session_id",
      });

    if (insertError) {
      console.error("[DropboxSync] Failed to queue sync:", insertError);
      return { success: false, error: insertError.message };
    }

    // Trigger background sync (fire-and-forget)
    triggerAutoSync(sessionId).catch(err => {
      console.warn("[DropboxSync] Auto-sync trigger failed:", err);
    });

    return { success: true };
  } catch (error) {
    console.error("[DropboxSync] Queue error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Trigger background auto-sync via edge function
 * This is fire-and-forget - errors are logged but not propagated
 */
export async function triggerAutoSync(sessionId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.log("[DropboxSync] No auth session for auto-sync");
      return;
    }

    console.log(`[DropboxSync] Triggering auto-sync for session ${sessionId}`);

    // Fire-and-forget call to edge function
    const response = await supabase.functions.invoke("dropbox-sync", {
      body: { sessionId },
      headers: {
        "x-custom-path": "/sync/auto",
      },
    });

    if (response.error) {
      console.warn("[DropboxSync] Auto-sync invoke error:", response.error);
    } else {
      console.log("[DropboxSync] Auto-sync triggered successfully");
    }
  } catch (error) {
    // Silently log - this is background work
    console.warn("[DropboxSync] Auto-sync trigger error:", error);
  }
}

/**
 * Trigger sync for a pending session (called from UI or background job)
 */
export async function triggerDropboxSync(
  sessionId: string,
  videoUrl: string,
  accessToken: string,
  fileName?: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, error: "Not authenticated" };
    }

    const response = await supabase.functions.invoke("dropbox-sync/sync", {
      body: {
        sessionId,
        videoUrl,
        accessToken,
        fileName,
      },
    });

    if (response.error) {
      console.error("[DropboxSync] Sync invoke error:", response.error);
      return { success: false, error: response.error.message };
    }

    return {
      success: response.data?.success || false,
      path: response.data?.path,
      error: response.data?.error,
    };
  } catch (error) {
    console.error("[DropboxSync] Trigger error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all pending syncs for current user
 */
export async function getPendingSyncs(): Promise<DropboxSyncStatus[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("dropbox_sync_status")
    .select("*")
    .eq("user_id", user.id)
    .in("sync_status", ["pending", "syncing"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[DropboxSync] Failed to get pending syncs:", error);
    return [];
  }

  return (data || []) as DropboxSyncStatus[];
}

/**
 * Get sync history for current user
 */
export async function getSyncHistory(limit = 20): Promise<DropboxSyncStatus[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("dropbox_sync_status")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[DropboxSync] Failed to get sync history:", error);
    return [];
  }

  return (data || []) as DropboxSyncStatus[];
}
