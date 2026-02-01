/**
 * Extension Recordings API
 * 
 * Handles video upload flow from Chrome extension:
 * - POST /create: Generate signed upload URL
 * - POST /complete: Mark upload complete, trigger processing
 * 
 * CORS: Only allows chrome-extension:// origins
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

/**
 * Extension CORS Configuration
 * 
 * Configurable allowlist of extension IDs. Set to empty array to allow all chrome-extension:// origins.
 * To restrict to specific extensions, add their IDs:
 * const ALLOWED_EXTENSION_IDS = ["abcdefghijklmnop", "qrstuvwxyz123456"];
 */
const ALLOWED_EXTENSION_IDS: string[] = [];

/**
 * Validates if the origin is an allowed Chrome extension
 */
function isAllowedExtensionOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Must be a chrome-extension:// origin
  if (!origin.startsWith("chrome-extension://")) {
    return false;
  }
  
  // If no specific IDs configured, allow all chrome extensions
  if (ALLOWED_EXTENSION_IDS.length === 0) {
    return true;
  }
  
  // Extract extension ID from origin (chrome-extension://EXTENSION_ID)
  const extensionId = origin.replace("chrome-extension://", "");
  return ALLOWED_EXTENSION_IDS.includes(extensionId);
}

/**
 * Gets CORS headers for the request
 * Only returns Access-Control-Allow-Origin for valid extension origins
 */
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, x-custom-path",
    "Access-Control-Max-Age": "86400",
  };
  
  // Only set Allow-Origin for valid extension origins
  if (isAllowedExtensionOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin!;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  
  return headers;
}

// 15 minute upload window
const UPLOAD_URL_TTL_SECONDS = 900;
// 5GB max file size
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024;

interface CreateRecordingRequest {
  mimeType?: string;
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
  hasMic?: boolean;
  hasCam?: boolean;
  captureSource?: string;
  client?: string;
  fileSizeBytes?: number;
}

interface CompleteRecordingRequest {
  recordingId: string;
}

// Use any for Supabase client to avoid complex generic issues in Deno
type AnySupabaseClient = SupabaseClient<any, any, any>;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Verify origin for non-preflight requests
  const origin = req.headers.get("Origin");
  if (!isAllowedExtensionOrigin(origin)) {
    console.warn(`[extension-recordings] Rejected origin: ${origin}`);
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[extension-recordings] Missing or invalid auth header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client for RLS
    const supabase: AnySupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for signed URLs
    const supabaseAdmin: AnySupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Validate token
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claims?.claims?.sub) {
      console.error("[extension-recordings] Invalid token:", claimsError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub as string;

    // Route based on x-custom-path header or URL path
    const customPath = req.headers.get("x-custom-path") || "";
    const url = new URL(req.url);
    const pathSegment = url.pathname.split("/").pop() || customPath;

    if (pathSegment === "create" || customPath === "create") {
      return await handleCreate(req, supabase, supabaseAdmin, userId, corsHeaders);
    } else if (pathSegment === "complete" || customPath === "complete") {
      return await handleComplete(req, supabase, supabaseAdmin, userId, corsHeaders);
    } else {
      // Default to create if no path specified
      const body = await req.json().catch(() => ({}));
      if ("recordingId" in body) {
        return await handleCompleteWithBody(body, supabase, supabaseAdmin, userId, corsHeaders);
      } else {
        return await handleCreateWithBody(body, supabase, supabaseAdmin, userId, corsHeaders);
      }
    }
  } catch (error) {
    console.error("[extension-recordings] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleCreate(
  req: Request,
  supabase: AnySupabaseClient,
  supabaseAdmin: AnySupabaseClient,
  userId: string,
  corsHeaders: Record<string, string>
) {
  const body: CreateRecordingRequest = await req.json().catch(() => ({}));
  return handleCreateWithBody(body, supabase, supabaseAdmin, userId, corsHeaders);
}

async function handleCreateWithBody(
  body: CreateRecordingRequest,
  supabase: AnySupabaseClient,
  supabaseAdmin: AnySupabaseClient,
  userId: string,
  corsHeaders: Record<string, string>
) {
  const {
    mimeType = "video/webm",
    container = "webm",
    videoCodec,
    audioCodec,
    hasMic = false,
    hasCam = false,
    captureSource,
    client = "chrome_extension",
    fileSizeBytes,
  } = body;

  console.log(`[extension-recordings] Create request from user: ${userId}, client: ${client}`);

  // Generate recording ID and storage path
  const recordingId = crypto.randomUUID();
  const fileExt = container === "mp4" ? "mp4" : "webm";
  const storagePath = `recordings/${userId}/${recordingId}.${fileExt}`;
  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000);

  // Create recording record
  const { data: recording, error: insertError } = await supabase
    .from("extension_recordings")
    .insert({
      id: recordingId,
      user_id: userId,
      mime_type: mimeType,
      container,
      video_codec: videoCodec,
      audio_codec: audioCodec,
      has_mic: hasMic,
      has_cam: hasCam,
      capture_source: captureSource,
      client,
      file_size_bytes: fileSizeBytes,
      storage_path: storagePath,
      upload_url_expires_at: expiresAt.toISOString(),
      max_size_bytes: MAX_FILE_SIZE_BYTES,
      status: "pending_upload",
    })
    .select()
    .single();

  if (insertError) {
    console.error("[extension-recordings] Failed to create recording:", insertError);
    return new Response(
      JSON.stringify({ error: "Failed to create recording" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Generate signed upload URL using service role
  const { data: signedUrl, error: signedUrlError } = await supabaseAdmin.storage
    .from("video-assets")
    .createSignedUploadUrl(storagePath);

  if (signedUrlError || !signedUrl) {
    console.error("[extension-recordings] Failed to create signed URL:", signedUrlError);
    // Clean up the record
    await supabase.from("extension_recordings").delete().eq("id", recordingId);
    return new Response(
      JSON.stringify({ error: "Failed to generate upload URL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[extension-recordings] Created recording: ${recordingId}, path: ${storagePath}`);

  return new Response(
    JSON.stringify({
      recordingId,
      uploadUrl: signedUrl.signedUrl,
      uploadMethod: "PUT",
      requiredHeaders: {
        "Content-Type": mimeType,
      },
      expiresAt: expiresAt.toISOString(),
      maxSizeBytes: MAX_FILE_SIZE_BYTES,
      token: signedUrl.token,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleComplete(
  req: Request,
  supabase: AnySupabaseClient,
  supabaseAdmin: AnySupabaseClient,
  userId: string,
  corsHeaders: Record<string, string>
) {
  const body: CompleteRecordingRequest = await req.json().catch(() => ({ recordingId: "" }));
  return handleCompleteWithBody(body, supabase, supabaseAdmin, userId, corsHeaders);
}

async function handleCompleteWithBody(
  body: CompleteRecordingRequest,
  supabase: AnySupabaseClient,
  supabaseAdmin: AnySupabaseClient,
  userId: string,
  corsHeaders: Record<string, string>
) {
  const { recordingId } = body;

  if (!recordingId) {
    return new Response(
      JSON.stringify({ error: "Missing recordingId" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[extension-recordings] Complete request for: ${recordingId}, user: ${userId}`);

  // Get recording record
  const { data: recording, error: fetchError } = await supabase
    .from("extension_recordings")
    .select("*")
    .eq("id", recordingId)
    .single();

  if (fetchError || !recording) {
    console.error("[extension-recordings] Recording not found:", recordingId);
    return new Response(
      JSON.stringify({ error: "Recording not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify ownership
  if (recording.user_id !== userId) {
    console.error("[extension-recordings] Unauthorized access attempt:", { recordingId, userId });
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check if already processed
  if (recording.status === "completed" && recording.session_id) {
    return new Response(
      JSON.stringify({
        sessionId: recording.session_id,
        sessionUrl: `/session/${recording.session_id}`,
        processingState: "completed",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check upload URL expiry
  if (new Date(recording.upload_url_expires_at) < new Date()) {
    console.error("[extension-recordings] Upload URL expired:", recordingId);
    await supabase
      .from("extension_recordings")
      .update({ status: "expired", error_message: "Upload URL expired" })
      .eq("id", recordingId);
    return new Response(
      JSON.stringify({ error: "Upload URL has expired. Please create a new recording." }),
      { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify file exists in storage
  const storageFolderPath = recording.storage_path.split("/").slice(0, -1).join("/");
  const storageFileName = recording.storage_path.split("/").pop();
  
  const { data: fileData, error: fileError } = await supabaseAdmin.storage
    .from("video-assets")
    .list(storageFolderPath, {
      search: storageFileName,
    });

  const fileExists = fileData && fileData.length > 0;
  if (!fileExists) {
    console.error("[extension-recordings] File not found in storage:", recording.storage_path);
    return new Response(
      JSON.stringify({ error: "Recording file not found. Please upload the file first." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get file metadata
  const uploadedFile = fileData[0];
  const actualFileSize = uploadedFile.metadata?.size || recording.file_size_bytes || 0;

  // Create capture session
  const sessionTitle = `Extension Recording ${new Date().toLocaleString()}`;
  const { data: session, error: sessionError } = await supabase
    .from("capture_sessions")
    .insert({
      user_id: userId,
      title: sessionTitle,
      status: "processing",
      metadata: {
        source: "extension",
        recording_id: recordingId,
        client: recording.client,
        capture_source: recording.capture_source,
        video_codec: recording.video_codec,
        audio_codec: recording.audio_codec,
      },
    })
    .select()
    .single();

  if (sessionError || !session) {
    console.error("[extension-recordings] Failed to create session:", sessionError);
    return new Response(
      JSON.stringify({ error: "Failed to create session" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Generate signed URL for the video
  const { data: videoUrl } = await supabaseAdmin.storage
    .from("video-assets")
    .createSignedUrl(recording.storage_path, 86400); // 24 hour URL

  // Create video asset record
  const { data: videoAsset, error: assetError } = await supabase
    .from("video_assets")
    .insert({
      session_id: session.id,
      user_id: userId,
      asset_type: "gameplay",
      storage_url: videoUrl?.signedUrl || "",
      storage_path: recording.storage_path,
      duration_ms: 0, // Will be updated during processing
      status: "processing",
      processing_progress: 0,
      mime_type: recording.mime_type,
      file_size_bytes: actualFileSize,
    })
    .select()
    .single();

  if (assetError) {
    console.error("[extension-recordings] Failed to create video asset:", assetError);
    // Don't fail - session is created, asset can be retried
  }

  // Update recording with session reference
  await supabase
    .from("extension_recordings")
    .update({
      status: "completed",
      uploaded_at: new Date().toISOString(),
      session_id: session.id,
      file_size_bytes: actualFileSize,
    })
    .eq("id", recordingId);

  console.log(`[extension-recordings] Completed recording: ${recordingId}, session: ${session.id}`);

  // Trigger async processing (fire and forget)
  try {
    EdgeRuntime.waitUntil(
      processRecordingAsync(supabaseAdmin, session.id, videoAsset?.id, recording.storage_path)
    );
  } catch (e) {
    // EdgeRuntime may not be available in all environments, run sync as fallback
    console.log("[extension-recordings] EdgeRuntime not available, processing synchronously");
    processRecordingAsync(supabaseAdmin, session.id, videoAsset?.id, recording.storage_path)
      .catch(err => console.error("[extension-recordings] Async processing error:", err));
  }

  return new Response(
    JSON.stringify({
      sessionId: session.id,
      sessionUrl: `/session/${session.id}`,
      processingState: "queued",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Async processing handler - runs after response is sent
 */
async function processRecordingAsync(
  supabaseAdmin: AnySupabaseClient,
  sessionId: string,
  videoAssetId: string | undefined,
  storagePath: string
) {
  try {
    console.log(`[extension-recordings] Starting async processing for session: ${sessionId}`);

    // Simulate processing time (in production, this would trigger transcoding)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Update session to ready
    await supabaseAdmin
      .from("capture_sessions")
      .update({ status: "ready" })
      .eq("id", sessionId);

    // Update video asset to ready
    if (videoAssetId) {
      await supabaseAdmin
        .from("video_assets")
        .update({
          status: "ready",
          processing_progress: 100,
        })
        .eq("id", videoAssetId);
    }

    console.log(`[extension-recordings] Async processing complete for session: ${sessionId}`);
  } catch (error) {
    console.error(`[extension-recordings] Async processing failed for session: ${sessionId}`, error);
    
    // Mark as failed
    await supabaseAdmin
      .from("capture_sessions")
      .update({ status: "failed" })
      .eq("id", sessionId);

    if (videoAssetId) {
      await supabaseAdmin
        .from("video_assets")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Processing failed",
        })
        .eq("id", videoAssetId);
    }
  }
}
