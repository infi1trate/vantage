import { supabase } from "@/integrations/supabase/client";

/**
 * Permanently delete a capture session and ALL associated data
 * This includes: video assets, audio tracks, facecam tracks, annotations, 
 * draw annotations, voice notes, timeline events, AI analyses, comments, shares
 */
export async function deleteSessionPermanently(sessionId: string): Promise<void> {
  // Get the session to verify ownership and get storage paths
  const { data: session, error: sessionError } = await supabase
    .from("capture_sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error("Session not found or access denied");
  }

  const userId = session.user_id;

  // Get all storage file paths for cleanup
  const [videoAssets, audioTracks, facecamTracks, voiceNotes] = await Promise.all([
    supabase.from("video_assets").select("storage_path").eq("session_id", sessionId),
    supabase.from("audio_tracks").select("storage_path").eq("session_id", sessionId),
    supabase.from("facecam_tracks").select("storage_path").eq("session_id", sessionId),
    supabase.from("voice_notes").select("audio_url").eq("session_id", sessionId),
  ]);

  // Delete files from storage buckets
  const deletePromises: Promise<any>[] = [];

  // Delete video assets from storage
  if (videoAssets.data) {
    const paths = videoAssets.data.filter(v => v.storage_path).map(v => v.storage_path!);
    if (paths.length > 0) {
      deletePromises.push(supabase.storage.from("video-assets").remove(paths));
    }
  }

  // Delete audio tracks from storage
  if (audioTracks.data) {
    const paths = audioTracks.data.filter(a => a.storage_path).map(a => a.storage_path!);
    if (paths.length > 0) {
      deletePromises.push(supabase.storage.from("audio-tracks").remove(paths));
    }
  }

  // Delete facecam tracks from storage
  if (facecamTracks.data) {
    const paths = facecamTracks.data.filter(f => f.storage_path).map(f => f.storage_path!);
    if (paths.length > 0) {
      deletePromises.push(supabase.storage.from("facecam-tracks").remove(paths));
    }
  }

  // Delete voice notes from storage
  if (voiceNotes.data) {
    const paths = voiceNotes.data
      .filter(v => v.audio_url)
      .map(v => {
        // Extract path from URL
        const url = v.audio_url;
        const match = url.match(/voice-notes\/(.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];
    
    if (paths.length > 0) {
      deletePromises.push(supabase.storage.from("voice-notes").remove(paths));
    }
  }

  // Wait for storage deletions (but don't fail if storage cleanup fails)
  await Promise.allSettled(deletePromises);

  // Delete all associated database records (cascade should handle most, but be explicit)
  // First get comment IDs for reactions deletion
  const { data: comments } = await supabase
    .from("social_comments")
    .select("id")
    .eq("session_id", sessionId);
  
  if (comments && comments.length > 0) {
    const commentIds = comments.map(c => c.id);
    await supabase.from("comment_reactions").delete().in("comment_id", commentIds);
  }

  await Promise.all([
    supabase.from("social_comments").delete().eq("session_id", sessionId),
    supabase.from("draw_annotations").delete().eq("session_id", sessionId),
    supabase.from("voice_notes").delete().eq("session_id", sessionId),
    supabase.from("annotations").delete().eq("session_id", sessionId),
    supabase.from("timeline_events").delete().eq("session_id", sessionId),
    supabase.from("ai_analyses").delete().eq("session_id", sessionId),
    supabase.from("session_shares").delete().eq("session_id", sessionId),
    supabase.from("video_assets").delete().eq("session_id", sessionId),
    supabase.from("audio_tracks").delete().eq("session_id", sessionId),
    supabase.from("facecam_tracks").delete().eq("session_id", sessionId),
  ]);

  // Finally, delete the session itself
  const { error: deleteError } = await supabase
    .from("capture_sessions")
    .delete()
    .eq("id", sessionId);

  if (deleteError) {
    throw new Error("Failed to delete session: " + deleteError.message);
  }
}

/**
 * Get session with its associated asset counts for library display
 */
export interface SessionWithAssets {
  id: string;
  user_id: string;
  title: string;
  game_name: string | null;
  duration_seconds: number;
  thumbnail_url: string | null;
  status: "recording" | "processing" | "ready" | "failed";
  is_private: boolean;
  visibility: "private" | "unlisted" | "public";
  created_at: string;
  updated_at: string;
  // Asset counts
  has_video: boolean;
  has_microphone: boolean;
  has_facecam: boolean;
  annotation_count: number;
  voice_note_count: number;
  // Video URL (for thumbnail backfill when thumbnail is missing)
  video_url: string | null;
  // Dropbox sync status
  dropbox_sync_status: "pending" | "synced" | "failed" | null;
  dropbox_synced_at: string | null;
}

export async function getSessionsWithAssets(userId: string): Promise<SessionWithAssets[]> {
  // Get sessions
  const { data: sessions, error } = await supabase
    .from("capture_sessions")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s.id);

  // Get asset counts in parallel (including Dropbox sync status)
  // Include dropbox_file_id to verify file was actually uploaded
  const [videoAssets, audioTracks, facecamTracks, annotations, voiceNotes, dropboxSyncs] = await Promise.all([
    supabase.from("video_assets").select("session_id").in("session_id", sessionIds),
    supabase.from("audio_tracks").select("session_id, track_type").in("session_id", sessionIds),
    supabase.from("facecam_tracks").select("session_id").in("session_id", sessionIds),
    supabase.from("annotations").select("session_id").in("session_id", sessionIds),
    supabase.from("voice_notes").select("session_id").in("session_id", sessionIds),
    supabase.from("dropbox_sync_status").select("session_id, sync_status, completed_at, dropbox_file_id, dropbox_path").in("session_id", sessionIds),
  ]);

  // Build lookup maps
  const videoSessionIds = new Set(videoAssets.data?.map(v => v.session_id) || []);
  const micSessionIds = new Set(
    audioTracks.data?.filter(a => a.track_type === "microphone").map(a => a.session_id) || []
  );
  const facecamSessionIds = new Set(facecamTracks.data?.map(f => f.session_id) || []);
  
  // Build Dropbox sync status lookup map
  const dropboxStatusMap: Record<string, { 
    status: "pending" | "synced" | "failed"; 
    syncedAt: string | null;
  }> = {};
  
  dropboxSyncs.data?.forEach(d => {
    let status: "pending" | "synced" | "failed";
    // Only mark as "synced" if status is completed AND file was actually uploaded
    // (verified by presence of dropbox_file_id or dropbox_path)
    if (d.sync_status === "completed" && (d.dropbox_file_id || d.dropbox_path)) {
      status = "synced";
    } else if (d.sync_status === "failed") {
      status = "failed";
    } else if (d.sync_status === "completed" && !d.dropbox_file_id && !d.dropbox_path) {
      // Completed but no file ID = treat as failed (upload didn't actually happen)
      status = "failed";
    } else {
      status = "pending";
    }
    dropboxStatusMap[d.session_id] = {
      status,
      syncedAt: d.completed_at || null,
    };
  });
  
  const annotationCounts: Record<string, number> = {};
  annotations.data?.forEach(a => {
    annotationCounts[a.session_id] = (annotationCounts[a.session_id] || 0) + 1;
  });
  
  const voiceNoteCounts: Record<string, number> = {};
  voiceNotes.data?.forEach(v => {
    voiceNoteCounts[v.session_id] = (voiceNoteCounts[v.session_id] || 0) + 1;
  });

  // Map sessions with asset info
  return sessions.map(session => ({
    id: session.id,
    user_id: session.user_id,
    title: session.title,
    game_name: session.game_name,
    duration_seconds: session.duration_seconds || 0,
    thumbnail_url: session.thumbnail_url,
    status: session.status as SessionWithAssets["status"],
    is_private: session.is_private ?? true,
    visibility: (session.visibility || "private") as SessionWithAssets["visibility"],
    created_at: session.created_at,
    updated_at: session.updated_at,
    has_video: videoSessionIds.has(session.id),
    has_microphone: micSessionIds.has(session.id),
    has_facecam: facecamSessionIds.has(session.id),
    annotation_count: annotationCounts[session.id] || 0,
    voice_note_count: voiceNoteCounts[session.id] || 0,
    video_url: session.video_url || null,
    dropbox_sync_status: dropboxStatusMap[session.id]?.status || null,
    dropbox_synced_at: dropboxStatusMap[session.id]?.syncedAt || null,
  }));
}
