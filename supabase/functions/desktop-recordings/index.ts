/**
 * Desktop Recordings API
 * 
 * Handles video upload flow from Electron desktop app:
 * - POST /init: Create session, generate signed upload URL
 * - POST /complete: Mark upload complete, store asset URL
 * 
 * CORS: Allows all origins (desktop app uses deep links)
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

// CORS headers for desktop app (allows all origins)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-custom-path",
  "Access-Control-Max-Age": "86400",
};

// 15 minute upload window
const UPLOAD_URL_TTL_SECONDS = 900;
// 10GB max file size for desktop recordings
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 * 1024;

interface InitRecordingRequest {
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  sourceName?: string;
}

interface CompleteRecordingRequest {
  sessionId: string;
}

// Use any for Supabase client to avoid complex generic issues in Deno
type AnySupabaseClient = SupabaseClient<any, any, any>;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
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
      console.error("[desktop-recordings] Missing or invalid auth header");
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
      console.error("[desktop-recordings] Invalid token:", claimsError?.message);
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

    if (pathSegment === "init" || customPath === "init") {
      return await handleInit(req, supabase, supabaseAdmin, userId);
    } else if (pathSegment === "complete" || customPath === "complete") {
      return await handleComplete(req, supabase, supabaseAdmin, userId);
    } else {
      // Default routing based on body content
      const body = await req.json().catch(() => ({}));
      if ("sessionId" in body) {
        return await handleCompleteWithBody(body, supabase, supabaseAdmin, userId);
      } else {
        return await handleInitWithBody(body, supabase, supabaseAdmin, userId);
      }
    }
  } catch (error) {
    console.error("[desktop-recordings] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleInit(
  req: Request,
  supabase: AnySupabaseClient,
  supabaseAdmin: AnySupabaseClient,
  userId: string
) {
  const body: InitRecordingRequest = await req.json().catch(() => ({}));
  return handleInitWithBody(body, supabase, supabaseAdmin, userId);
}

async function handleInitWithBody(
  body: InitRecordingRequest,
  supabase: AnySupabaseClient,
  supabaseAdmin: AnySupabaseClient,
  userId: string
) {
  const {
    filename,
    mimeType = "video/webm",
    sizeBytes,
    durationSeconds,
    sourceName,
  } = body;

  console.log(`[desktop-recordings] Init request from user: ${userId}, source: ${sourceName}`);

  // Generate session ID and storage path
  const sessionId = crypto.randomUUID();
  const fileExt = mimeType.includes("mp4") ? "mp4" : "webm";
  const storagePath = `recordings/${userId}/${sessionId}.${fileExt}`;
  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000);

  // Create capture session with status="uploading"
  const sessionTitle = sourceName 
    ? `Desktop Recording - ${sourceName}` 
    : `Desktop Recording ${new Date().toLocaleString()}`;

  const { data: session, error: sessionError } = await supabase
    .from("capture_sessions")
    .insert({
      id: sessionId,
      user_id: userId,
      title: sessionTitle,
      status: "uploading",
      duration_seconds: durationSeconds || 0,
      metadata: {
        source: "desktop",
        client: "electron",
        source_name: sourceName,
        original_filename: filename,
        mime_type: mimeType,
        file_size_bytes: sizeBytes,
        storage_path: storagePath,
        upload_started_at: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (sessionError) {
    console.error("[desktop-recordings] Failed to create session:", sessionError);
    return new Response(
      JSON.stringify({ error: "Failed to create session" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Generate signed upload URL using service role
  const { data: signedUrl, error: signedUrlError } = await supabaseAdmin.storage
    .from("video-assets")
    .createSignedUploadUrl(storagePath);

  if (signedUrlError || !signedUrl) {
    console.error("[desktop-recordings] Failed to create signed URL:", signedUrlError);
    // Clean up the session
    await supabase.from("capture_sessions").delete().eq("id", sessionId);
    return new Response(
      JSON.stringify({ error: "Failed to generate upload URL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[desktop-recordings] Created session: ${sessionId}, path: ${storagePath}`);

  return new Response(
    JSON.stringify({
      sessionId,
      uploadUrl: signedUrl.signedUrl,
      uploadMethod: "PUT",
      uploadHeaders: {
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
  userId: string
) {
  const body: CompleteRecordingRequest = await req.json().catch(() => ({ sessionId: "" }));
  return handleCompleteWithBody(body, supabase, supabaseAdmin, userId);
}

async function handleCompleteWithBody(
  body: CompleteRecordingRequest,
  supabase: AnySupabaseClient,
  supabaseAdmin: AnySupabaseClient,
  userId: string
) {
  const { sessionId } = body;

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "Missing sessionId" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[desktop-recordings] Complete request for: ${sessionId}, user: ${userId}`);

  // Get session record
  const { data: session, error: fetchError } = await supabase
    .from("capture_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (fetchError || !session) {
    console.error("[desktop-recordings] Session not found:", sessionId);
    return new Response(
      JSON.stringify({ error: "Session not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify ownership
  if (session.user_id !== userId) {
    console.error("[desktop-recordings] Unauthorized access attempt:", { sessionId, userId });
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check if already completed
  if (session.status === "ready") {
    return new Response(
      JSON.stringify({
        sessionId,
        sessionUrl: `/session/${sessionId}`,
        status: "ready",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get storage path from metadata
  const metadata = session.metadata as Record<string, unknown> || {};
  const storagePath = metadata.storage_path as string;

  if (!storagePath) {
    console.error("[desktop-recordings] No storage path in session metadata:", sessionId);
    return new Response(
      JSON.stringify({ error: "Invalid session - missing storage path" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify file exists in storage
  const storageFolderPath = storagePath.split("/").slice(0, -1).join("/");
  const storageFileName = storagePath.split("/").pop();
  
  const { data: fileData, error: fileError } = await supabaseAdmin.storage
    .from("video-assets")
    .list(storageFolderPath, {
      search: storageFileName,
    });

  const fileExists = fileData && fileData.length > 0;
  if (!fileExists) {
    console.error("[desktop-recordings] File not found in storage:", storagePath);
    return new Response(
      JSON.stringify({ error: "Recording file not found. Please upload the file first." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get file metadata
  const uploadedFile = fileData[0];
  const actualFileSize = uploadedFile.metadata?.size || metadata.file_size_bytes || 0;

  // Generate signed URL for the video
  const { data: videoUrl } = await supabaseAdmin.storage
    .from("video-assets")
    .createSignedUrl(storagePath, 86400); // 24 hour URL

  // Create video asset record
  const { data: videoAsset, error: assetError } = await supabase
    .from("video_assets")
    .insert({
      session_id: sessionId,
      user_id: userId,
      asset_type: "gameplay",
      storage_url: videoUrl?.signedUrl || "",
      storage_path: storagePath,
      duration_ms: (session.duration_seconds || 0) * 1000,
      status: "ready",
      processing_progress: 100,
      mime_type: metadata.mime_type as string || "video/webm",
      file_size_bytes: actualFileSize,
    })
    .select()
    .single();

  if (assetError) {
    console.error("[desktop-recordings] Failed to create video asset:", assetError);
    // Don't fail - session can still be marked ready
  }

  // Update session to ready
  const { error: updateError } = await supabase
    .from("capture_sessions")
    .update({
      status: "ready",
      video_url: videoUrl?.signedUrl || null,
      metadata: {
        ...metadata,
        upload_completed_at: new Date().toISOString(),
        video_asset_id: videoAsset?.id,
      },
    })
    .eq("id", sessionId);

  if (updateError) {
    console.error("[desktop-recordings] Failed to update session:", updateError);
    return new Response(
      JSON.stringify({ error: "Failed to update session" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[desktop-recordings] Completed session: ${sessionId}, asset: ${videoAsset?.id}`);

  // Trigger optional async processing (thumbnails, Dropbox sync, etc.)
  try {
    EdgeRuntime.waitUntil(
      processRecordingAsync(supabaseAdmin, sessionId, storagePath, userId)
    );
  } catch (e) {
    console.log("[desktop-recordings] EdgeRuntime not available, skipping async processing");
  }

  return new Response(
    JSON.stringify({
      sessionId,
      sessionUrl: `/session/${sessionId}`,
      status: "ready",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Async processing handler - runs after response is sent
 * Handles optional background tasks like Dropbox sync
 */
async function processRecordingAsync(
  supabaseAdmin: AnySupabaseClient,
  sessionId: string,
  storagePath: string,
  userId: string
) {
  try {
    console.log(`[desktop-recordings] Starting async processing for session: ${sessionId}`);

    // Check if user has Dropbox connected for auto-sync
    const { data: dropboxAccount } = await supabaseAdmin
      .from("connected_accounts")
      .select("id, provisioning_status")
      .eq("user_id", userId)
      .eq("provider", "dropbox")
      .maybeSingle();

    if (dropboxAccount && dropboxAccount.provisioning_status === "active") {
      console.log(`[desktop-recordings] User has Dropbox, triggering sync for session: ${sessionId}`);
      
      // Create pending sync status
      await supabaseAdmin
        .from("dropbox_sync_status")
        .upsert({
          session_id: sessionId,
          user_id: userId,
          sync_status: "pending",
          attempt_count: 0,
        }, { onConflict: "session_id" });
    }

    console.log(`[desktop-recordings] Async processing complete for session: ${sessionId}`);
  } catch (error) {
    console.error("[desktop-recordings] Async processing error:", error);
  }
}
