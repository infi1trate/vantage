import { supabase } from "@/integrations/supabase/client";

// ==================== User & Profile ====================
export interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  // Recording defaults
  default_game: string | null;
  record_facecam: boolean;
  record_microphone: boolean;
  record_game_audio: boolean;
  // Playback preferences
  default_playback_speed: number;
  auto_skip_dead_time: boolean;
  show_ai_insights: boolean;
  // Privacy defaults
  default_session_visibility: "private" | "unlisted" | "public";
  allow_ai_analysis: boolean;
  // Notification settings
  notify_on_share: boolean;
  notify_on_comment: boolean;
  notify_on_analysis_complete: boolean;
  // UI preferences
  theme: string;
  sidebar_collapsed: boolean;
  timeline_zoom: number;
  created_at: string;
  updated_at: string;
}

// ==================== Session ====================
export interface CaptureSession {
  id: string;
  user_id: string;
  title: string;
  game_name: string | null;
  duration_seconds: number;
  thumbnail_url: string | null;
  video_url: string | null;
  status: "recording" | "processing" | "ready" | "failed";
  metadata: Record<string, any>;
  // Privacy
  is_private: boolean;
  visibility: "private" | "unlisted" | "public";
  // Timestamps
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ==================== Video Asset ====================
export interface VideoAsset {
  id: string;
  session_id: string;
  user_id: string;
  // Asset details
  asset_type: "gameplay" | "facecam" | "combined" | "clip";
  storage_url: string;
  storage_path: string | null;
  // Video metadata
  duration_ms: number;
  width: number | null;
  height: number | null;
  framerate: number | null;
  bitrate: number | null;
  codec: string | null;
  file_size_bytes: number | null;
  mime_type: string;
  // Processing state
  status: "uploading" | "processing" | "ready" | "failed" | "deleted";
  processing_progress: number;
  error_message: string | null;
  // Thumbnails
  thumbnail_url: string | null;
  thumbnail_sprite_url: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ==================== Audio Track ====================
export interface AudioTrack {
  id: string;
  session_id: string;
  user_id: string;
  video_asset_id: string | null;
  // Track details
  track_type: "game" | "voice_chat" | "microphone" | "desktop" | "mixed" | "voiceover";
  track_name: string | null;
  storage_url: string;
  storage_path: string | null;
  // Audio metadata
  duration_ms: number;
  sample_rate: number;
  channels: number;
  bitrate: number | null;
  codec: string | null;
  file_size_bytes: number | null;
  mime_type: string;
  // Track settings
  volume_level: number;
  is_muted: boolean;
  offset_ms: number;
  // Processing
  status: "uploading" | "processing" | "ready" | "failed";
  waveform_data: number[] | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ==================== Facecam Track ====================
export interface FacecamTrack {
  id: string;
  session_id: string;
  user_id: string;
  video_asset_id: string | null;
  // Track details
  storage_url: string;
  storage_path: string | null;
  // Video metadata
  duration_ms: number;
  width: number | null;
  height: number | null;
  framerate: number | null;
  file_size_bytes: number | null;
  // Overlay positioning (normalized 0-1)
  position_x: number;
  position_y: number;
  scale: number;
  border_radius: number;
  is_visible: boolean;
  opacity: number;
  // Sync
  offset_ms: number;
  // Processing
  status: "uploading" | "processing" | "ready" | "failed";
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ==================== Timeline Event ====================
export type TimelineEventType =
  | "kill" | "death" | "assist" | "headshot" | "multikill"
  | "ace" | "clutch" | "round_start" | "round_end" | "round_win" | "round_loss"
  | "plant" | "defuse" | "objective_capture" | "ultimate_used"
  | "damage_dealt" | "damage_taken" | "healing"
  | "match_start" | "match_end" | "half_time"
  | "custom";

export interface TimelineEvent {
  id: string;
  session_id: string;
  user_id: string;
  // Event details
  event_type: TimelineEventType;
  event_subtype: string | null;
  // Timing
  timestamp_ms: number;
  duration_ms: number | null;
  // Event data
  title: string | null;
  description: string | null;
  value: number | null;
  metadata: Record<string, any>;
  // Detection source
  source: "manual" | "ai_detected" | "game_api" | "ocr" | "audio_analysis";
  confidence: number | null;
  // Display
  importance: number; // 1-10
  color: string | null;
  icon: string | null;
  is_bookmarked: boolean;
  is_hidden: boolean;
  // Timestamps
  created_at: string;
}

// ==================== Annotation (marker/tag) ====================
export type AnnotationType = "marker" | "note" | "highlight" | "kill" | "death" | "objective";

export interface Annotation {
  id: string;
  session_id: string;
  user_id: string;
  timestamp_seconds: number;
  end_timestamp_seconds: number | null;
  annotation_type: AnnotationType;
  title: string | null;
  content: string | null;
  color: string;
  // Privacy
  is_private: boolean;
  visibility: "owner" | "shared" | "public";
  tags: string[];
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ==================== Draw Annotation (visual) ====================
export type DrawType = "arrow" | "circle" | "rectangle" | "line" | "freehand" | "text" | "spotlight" | "blur" | "zoom";
export type DrawAnimation = "none" | "fade" | "draw" | "pop" | "slide";

export interface DrawAnnotation {
  id: string;
  session_id: string;
  user_id: string;
  annotation_id: string | null;
  // Timing
  timestamp_ms: number;
  duration_ms: number;
  // Drawing type and data
  draw_type: DrawType;
  // Position and size (normalized 0-1)
  start_x: number;
  start_y: number;
  end_x: number | null;
  end_y: number | null;
  width: number | null;
  height: number | null;
  // For freehand drawings
  path_data: { x: number; y: number }[] | null;
  // Styling
  stroke_color: string;
  stroke_width: number;
  fill_color: string | null;
  opacity: number;
  // Text content
  text_content: string | null;
  font_size: number;
  font_family: string;
  // Animation
  animation: DrawAnimation;
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ==================== Voice Note ====================
export interface VoiceNote {
  id: string;
  session_id: string;
  user_id: string;
  annotation_id: string | null;
  timestamp_seconds: number;
  duration_seconds: number;
  audio_url: string;
  transcription: string | null;
  transcription_status: "pending" | "processing" | "completed" | "failed";
  language: string;
  is_private: boolean;
  waveform_data: number[] | null;
  created_at: string;
}

// ==================== Coach Analysis ====================
export type AnalysisType = "general" | "aim" | "positioning" | "decision" | "economy";

export interface AIInsight {
  type: "positive" | "warning" | "neutral";
  title: string;
  description: string;
  timestamp_ms?: number;
}

export interface AIRecommendation {
  text: string;
  priority: "high" | "medium" | "low";
  category?: string;
}

export interface AIAnalysis {
  id: string;
  session_id: string;
  analysis_type: AnalysisType;
  summary: string | null;
  insights: AIInsight[];
  recommendations: AIRecommendation[];
  score: number | null;
  // Processing
  status: "pending" | "processing" | "completed" | "failed";
  model_version: string | null;
  processing_time_ms: number | null;
  raw_output: Record<string, any> | null;
  frame_references: { timestamp_ms: number; description: string }[];
  confidence_scores: Record<string, number>;
  // Timestamps
  created_at: string;
}

// ==================== Social Comment ====================
export interface SocialComment {
  id: string;
  session_id: string;
  user_id: string;
  parent_id: string | null;
  timestamp_seconds: number | null;
  content: string;
  // Privacy
  is_private: boolean;
  is_resolved: boolean;
  // Reactions & mentions
  reaction_counts: Record<string, number>;
  mentioned_users: string[];
  attachments: { type: string; url: string; name?: string }[];
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type ReactionType = "like" | "helpful" | "agree" | "disagree" | "fire" | "thinking";

export interface CommentReaction {
  id: string;
  comment_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

// ==================== Session Share ====================
export interface SessionShare {
  id: string;
  session_id: string;
  shared_by: string;
  shared_with: string | null;
  share_token: string | null;
  permission: "view" | "annotate" | "edit";
  expires_at: string | null;
  created_at: string;
}

// ==================== API Functions ====================

// Session CRUD
export async function createCaptureSession(userId: string, title: string, gameName?: string) {
  const { data, error } = await supabase
    .from("capture_sessions")
    .insert({
      user_id: userId,
      title,
      game_name: gameName,
      status: "recording",
    })
    .select()
    .single();

  if (error) throw error;
  return data as CaptureSession;
}

export async function getCaptureSessions(userId: string) {
  const { data, error } = await supabase
    .from("capture_sessions")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as CaptureSession[];
}

export async function getCaptureSession(sessionId: string) {
  const { data, error } = await supabase
    .from("capture_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return data as CaptureSession;
}

export async function updateCaptureSession(sessionId: string, updates: Partial<CaptureSession>) {
  const { data, error } = await supabase
    .from("capture_sessions")
    .update(updates)
    .eq("id", sessionId)
    .select()
    .single();

  if (error) throw error;
  return data as CaptureSession;
}

export async function deleteCaptureSession(sessionId: string, softDelete = true) {
  if (softDelete) {
    const { error } = await supabase
      .from("capture_sessions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("capture_sessions")
      .delete()
      .eq("id", sessionId);
    if (error) throw error;
  }
}

// Permanent deletion - removes all associated data
export async function permanentlyDeleteSession(sessionId: string, userId: string) {
  // Delete storage files first
  const storageDeletions = [
    supabase.storage.from("video-assets").remove([`${userId}/${sessionId}/gameplay.webm`]),
    supabase.storage.from("audio-tracks").remove([`${userId}/${sessionId}/microphone.webm`]),
    supabase.storage.from("facecam-tracks").remove([`${userId}/${sessionId}/facecam.webm`]),
  ];

  // Delete voice note audio files
  const { data: voiceNotes } = await supabase
    .from("voice_notes")
    .select("audio_url")
    .eq("session_id", sessionId);

  if (voiceNotes) {
    const voiceNoteFiles = voiceNotes
      .map(vn => {
        try {
          const url = new URL(vn.audio_url);
          const path = url.pathname.split("/").slice(-3).join("/");
          return path;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as string[];

    if (voiceNoteFiles.length > 0) {
      storageDeletions.push(
        supabase.storage.from("voice-notes").remove(voiceNoteFiles)
      );
    }
  }

  // Run all storage deletions in parallel
  await Promise.allSettled(storageDeletions);

  // Delete database records (cascading from session)
  // First delete child records
  await Promise.all([
    supabase.from("annotations").delete().eq("session_id", sessionId),
    supabase.from("voice_notes").delete().eq("session_id", sessionId),
    supabase.from("draw_annotations").delete().eq("session_id", sessionId),
    supabase.from("timeline_events").delete().eq("session_id", sessionId),
    supabase.from("social_comments").delete().eq("session_id", sessionId),
    supabase.from("ai_analyses").delete().eq("session_id", sessionId),
    supabase.from("session_shares").delete().eq("session_id", sessionId),
    supabase.from("video_assets").delete().eq("session_id", sessionId),
    supabase.from("audio_tracks").delete().eq("session_id", sessionId),
    supabase.from("facecam_tracks").delete().eq("session_id", sessionId),
  ]);

  // Finally delete the session itself
  const { error } = await supabase
    .from("capture_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) throw error;
}

// Video Assets
export async function createVideoAsset(data: Omit<VideoAsset, "id" | "created_at" | "updated_at" | "deleted_at">) {
  const { data: asset, error } = await supabase
    .from("video_assets")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return asset as VideoAsset;
}

export async function getVideoAssets(sessionId: string) {
  const { data, error } = await supabase
    .from("video_assets")
    .select("*")
    .eq("session_id", sessionId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as VideoAsset[];
}

// Audio Tracks
export async function createAudioTrack(data: Omit<AudioTrack, "id" | "created_at" | "updated_at">) {
  const { data: track, error } = await supabase
    .from("audio_tracks")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return track as AudioTrack;
}

export async function getAudioTracks(sessionId: string) {
  const { data, error } = await supabase
    .from("audio_tracks")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as AudioTrack[];
}

// Facecam Tracks
export async function createFacecamTrack(data: Omit<FacecamTrack, "id" | "created_at" | "updated_at">) {
  const { data: track, error } = await supabase
    .from("facecam_tracks")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return track as FacecamTrack;
}

export async function getFacecamTracks(sessionId: string) {
  const { data, error } = await supabase
    .from("facecam_tracks")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as FacecamTrack[];
}

// Timeline Events
export async function createTimelineEvent(data: Omit<TimelineEvent, "id" | "created_at">) {
  const { data: event, error } = await supabase
    .from("timeline_events")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return event as TimelineEvent;
}

export async function getTimelineEvents(sessionId: string) {
  const { data, error } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("session_id", sessionId)
    .eq("is_hidden", false)
    .order("timestamp_ms", { ascending: true });

  if (error) throw error;
  return data as TimelineEvent[];
}

export async function updateTimelineEvent(eventId: string, updates: Partial<TimelineEvent>) {
  const { data, error } = await supabase
    .from("timeline_events")
    .update(updates)
    .eq("id", eventId)
    .select()
    .single();

  if (error) throw error;
  return data as TimelineEvent;
}

// Annotations
export async function createAnnotation(
  sessionId: string,
  userId: string,
  timestampSeconds: number,
  type: AnnotationType = "marker",
  title?: string,
  content?: string,
  tags?: string[],
  color?: string
) {
  const { data, error } = await supabase
    .from("annotations")
    .insert({
      session_id: sessionId,
      user_id: userId,
      timestamp_seconds: timestampSeconds,
      annotation_type: type,
      title,
      content,
      tags: tags || null,
      color: color || "#00E5FF",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Annotation;
}

export async function getAnnotations(sessionId: string) {
  const { data, error } = await supabase
    .from("annotations")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp_seconds", { ascending: true });

  if (error) throw error;
  return data as Annotation[];
}

export async function updateAnnotation(annotationId: string, updates: Partial<Annotation>) {
  const { data, error } = await supabase
    .from("annotations")
    .update(updates)
    .eq("id", annotationId)
    .select()
    .single();

  if (error) throw error;
  return data as Annotation;
}

export async function deleteAnnotation(annotationId: string) {
  const { error } = await supabase
    .from("annotations")
    .delete()
    .eq("id", annotationId);

  if (error) throw error;
}

// Draw Annotations
export async function createDrawAnnotation(data: Omit<DrawAnnotation, "id" | "created_at" | "updated_at">) {
  const { data: annotation, error } = await supabase
    .from("draw_annotations")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return annotation as DrawAnnotation;
}

export async function getDrawAnnotations(sessionId: string) {
  const { data, error } = await supabase
    .from("draw_annotations")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp_ms", { ascending: true });

  if (error) throw error;
  return data as DrawAnnotation[];
}

// Voice Notes
export async function createVoiceNote(
  sessionId: string,
  userId: string,
  timestampSeconds: number,
  durationSeconds: number,
  audioUrl: string,
  annotationId?: string
) {
  const { data, error } = await supabase
    .from("voice_notes")
    .insert({
      session_id: sessionId,
      user_id: userId,
      timestamp_seconds: timestampSeconds,
      duration_seconds: durationSeconds,
      audio_url: audioUrl,
      annotation_id: annotationId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as VoiceNote;
}

export async function getVoiceNotes(sessionId: string) {
  const { data, error } = await supabase
    .from("voice_notes")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp_seconds", { ascending: true });

  if (error) throw error;
  return data as VoiceNote[];
}

export async function uploadVoiceNote(userId: string, sessionId: string, audioBlob: Blob) {
  const fileName = `${userId}/${sessionId}/${Date.now()}.webm`;
  
  const { data, error } = await supabase.storage
    .from("voice-notes")
    .upload(fileName, audioBlob, {
      contentType: "audio/webm",
    });

  if (error) throw error;
  
  const { data: urlData } = supabase.storage
    .from("voice-notes")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

// AI Analysis
export async function createAIAnalysis(
  sessionId: string,
  analysisType: AnalysisType,
  summary: string,
  insights: AIInsight[],
  recommendations: AIRecommendation[],
  score?: number
) {
  const { data, error } = await supabase
    .from("ai_analyses")
    .insert({
      session_id: sessionId,
      analysis_type: analysisType,
      summary,
      insights: insights as unknown as Record<string, unknown>,
      recommendations: recommendations as unknown as Record<string, unknown>,
      score,
      status: "completed",
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as AIAnalysis;
}

export async function getAIAnalysis(sessionId: string) {
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as AIAnalysis[];
}

// Social Comments
export async function createSocialComment(
  sessionId: string,
  userId: string,
  content: string,
  timestampSeconds?: number,
  parentId?: string
) {
  const { data, error } = await supabase
    .from("social_comments")
    .insert({
      session_id: sessionId,
      user_id: userId,
      content,
      timestamp_seconds: timestampSeconds,
      parent_id: parentId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as SocialComment;
}

export async function getSocialComments(sessionId: string) {
  const { data, error } = await supabase
    .from("social_comments")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as SocialComment[];
}

// Comment Reactions
export async function addReaction(commentId: string, userId: string, reactionType: ReactionType) {
  const { data, error } = await supabase
    .from("comment_reactions")
    .insert({
      comment_id: commentId,
      user_id: userId,
      reaction_type: reactionType,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CommentReaction;
}

export async function removeReaction(commentId: string, userId: string, reactionType: ReactionType) {
  const { error } = await supabase
    .from("comment_reactions")
    .delete()
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .eq("reaction_type", reactionType);

  if (error) throw error;
}

// Session Sharing
export async function createSessionShare(
  sessionId: string,
  sharedBy: string,
  sharedWith?: string,
  permission: SessionShare["permission"] = "view",
  expiresAt?: string
) {
  const shareToken = sharedWith ? null : crypto.randomUUID();
  
  const { data, error } = await supabase
    .from("session_shares")
    .insert({
      session_id: sessionId,
      shared_by: sharedBy,
      shared_with: sharedWith,
      share_token: shareToken,
      permission,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  return data as SessionShare;
}

export async function getSessionShares(sessionId: string) {
  const { data, error } = await supabase
    .from("session_shares")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as SessionShare[];
}

// User Preferences
export async function getUserPreferences(userId: string) {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as UserPreferences | null;
}

export async function upsertUserPreferences(userId: string, prefs: Partial<UserPreferences>) {
  const { data, error } = await supabase
    .from("user_preferences")
    .upsert({
      user_id: userId,
      ...prefs,
    })
    .select()
    .single();

  if (error) throw error;
  return data as UserPreferences;
}
