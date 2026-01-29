import { supabase } from "@/integrations/supabase/client";

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
  created_at: string;
  updated_at: string;
}

export interface Annotation {
  id: string;
  session_id: string;
  user_id: string;
  timestamp_seconds: number;
  end_timestamp_seconds: number | null;
  annotation_type: "marker" | "note" | "highlight" | "kill" | "death" | "objective";
  title: string | null;
  content: string | null;
  color: string;
  created_at: string;
}

export interface VoiceNote {
  id: string;
  session_id: string;
  user_id: string;
  annotation_id: string | null;
  timestamp_seconds: number;
  duration_seconds: number;
  audio_url: string;
  transcription: string | null;
  created_at: string;
}

export interface AIAnalysis {
  id: string;
  session_id: string;
  analysis_type: "general" | "aim" | "positioning" | "decision" | "economy";
  summary: string | null;
  insights: any[];
  recommendations: any[];
  score: number | null;
  created_at: string;
}

// Create a new capture session
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

// Get all capture sessions for a user
export async function getCaptureSessions(userId: string) {
  const { data, error } = await supabase
    .from("capture_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as CaptureSession[];
}

// Get a single capture session
export async function getCaptureSession(sessionId: string) {
  const { data, error } = await supabase
    .from("capture_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return data as CaptureSession;
}

// Update a capture session
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

// Delete a capture session
export async function deleteCaptureSession(sessionId: string) {
  const { error } = await supabase
    .from("capture_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) throw error;
}

// Create an annotation
export async function createAnnotation(
  sessionId: string,
  userId: string,
  timestampSeconds: number,
  type: Annotation["annotation_type"] = "marker",
  title?: string,
  content?: string,
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
      color: color || "#00E5FF",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Annotation;
}

// Get annotations for a session
export async function getAnnotations(sessionId: string) {
  const { data, error } = await supabase
    .from("annotations")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp_seconds", { ascending: true });

  if (error) throw error;
  return data as Annotation[];
}

// Delete an annotation
export async function deleteAnnotation(annotationId: string) {
  const { error } = await supabase
    .from("annotations")
    .delete()
    .eq("id", annotationId);

  if (error) throw error;
}

// Create a voice note
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

// Get voice notes for a session
export async function getVoiceNotes(sessionId: string) {
  const { data, error } = await supabase
    .from("voice_notes")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp_seconds", { ascending: true });

  if (error) throw error;
  return data as VoiceNote[];
}

// Upload audio file to storage
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

// Get AI analysis for a session
export async function getAIAnalysis(sessionId: string) {
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as AIAnalysis[];
}

// Create AI analysis
export async function createAIAnalysis(
  sessionId: string,
  analysisType: AIAnalysis["analysis_type"],
  summary: string,
  insights: any[],
  recommendations: any[],
  score?: number
) {
  const { data, error } = await supabase
    .from("ai_analyses")
    .insert({
      session_id: sessionId,
      analysis_type: analysisType,
      summary,
      insights,
      recommendations,
      score,
    })
    .select()
    .single();

  if (error) throw error;
  return data as AIAnalysis;
}
