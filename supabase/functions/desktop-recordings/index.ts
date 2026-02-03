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
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
  sourceName?: string;
}

interface InitRecordingResponse {
  sessionId: string;
  storageKey: string;
  upload: {
    method: "PUT" | "POST";
    url: string;
    headers?: Record<string, string>;
    fields?: Record<string, string>;
  };
}

interface CompleteRecordingRequest {
  sessionId: string;
  storageKey: string;
}

interface CompleteRecordingResponse {
  sessionId: string;
  editorUrl: string;
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
    mimeType,
    sizeBytes,
    durationSeconds,
    sourceName,
  } = body;

  // Validate required fields
  if (!filename || !mimeType || typeof sizeBytes !== "number" || typeof durationSeconds !== "number") {
    return new Response(
      JSON.stringify({ error: "Missing required fields: filename, mimeType, sizeBytes, durationSeconds" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[desktop-recordings] Init request from user: ${userId}, file: ${filename}, source: ${sourceName}`);

  // Generate session ID and storage key
  const sessionId = crypto.randomUUID();
  const fileExt = mimeType.includes("mp4") ? "mp4" : "webm";
  const storageKey = `sessions/${userId}/${sessionId}/recording.${fileExt}`;

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
      duration_seconds: durationSeconds,
      metadata: {
        created_from: "desktop",
        source_name: sourceName || null,
        original_filename: filename,
        mime_type: mimeType,
        file_size_bytes: sizeBytes,
        storage_key: storageKey,
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
    .createSignedUploadUrl(storageKey);

  if (signedUrlError || !signedUrl) {
    console.error("[desktop-recordings] Failed to create signed URL:", signedUrlError);
    // Clean up the session
    await supabase.from("capture_sessions").delete().eq("id", sessionId);
    return new Response(
      JSON.stringify({ error: "Failed to generate upload URL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[desktop-recordings] Created session: ${sessionId}, storageKey: ${storageKey}`);

  // Return the new response format
  const response: InitRecordingResponse = {
    sessionId,
    storageKey,
    upload: {
      method: "PUT",
      url: signedUrl.signedUrl,
      headers: {
        "Content-Type": mimeType,
      },
    },
  };

  return new Response(
    JSON.stringify(response),
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
  const { sessionId, storageKey: inputStorageKey } = body;

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "Missing sessionId" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!inputStorageKey) {
    return new Response(
      JSON.stringify({ error: "Missing storageKey" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[desktop-recordings] Complete request for: ${sessionId}, storageKey: ${inputStorageKey}, user: ${userId}`);

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

  // Check if session is in uploading status
  if (session.status !== "uploading") {
    // Already completed - return success with editorUrl
    const response: CompleteRecordingResponse = {
      sessionId,
      editorUrl: `https://getvantage.lovable.app/session/${sessionId}`,
    };
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Use the provided storageKey (verify it matches what we have in metadata)
  const metadata = session.metadata as Record<string, unknown> || {};
  const expectedStorageKey = metadata.storage_key as string;
  
  if (expectedStorageKey && expectedStorageKey !== inputStorageKey) {
    console.warn(`[desktop-recordings] Storage key mismatch: expected ${expectedStorageKey}, got ${inputStorageKey}`);
    // Use the provided storageKey anyway - client knows what they uploaded
  }

  const storageKey = inputStorageKey;

  // Verify file exists in storage (best-effort)
  const storageFolderPath = storageKey.split("/").slice(0, -1).join("/");
  const storageFileName = storageKey.split("/").pop();
  
  const { data: fileData, error: fileError } = await supabaseAdmin.storage
    .from("video-assets")
    .list(storageFolderPath, {
      search: storageFileName,
    });

  const fileExists = fileData && fileData.length > 0;
  if (!fileExists) {
    console.error("[desktop-recordings] File not found in storage:", storageKey);
    return new Response(
      JSON.stringify({ error: "Recording file not found. Please upload the file first." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get file metadata
  const uploadedFile = fileData[0];
  const actualFileSize = uploadedFile.metadata?.size || metadata.file_size_bytes || 0;

  // Generate a stable signed URL for playback (long-lived, 7 days)
  const { data: videoUrlData } = await supabaseAdmin.storage
    .from("video-assets")
    .createSignedUrl(storageKey, 7 * 24 * 60 * 60); // 7 days

  const videoUrl = videoUrlData?.signedUrl || "";

  // Create video asset record
  const { data: videoAsset, error: assetError } = await supabase
    .from("video_assets")
    .insert({
      session_id: sessionId,
      user_id: userId,
      asset_type: "gameplay",
      storage_url: videoUrl,
      storage_path: storageKey,
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

  // Update session to ready with videoStorageKey and videoUrl
  const { error: updateError } = await supabase
    .from("capture_sessions")
    .update({
      status: "ready",
      video_url: videoUrl,
      metadata: {
        ...metadata,
        storage_key: storageKey,
        video_storage_key: storageKey,
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
      processRecordingAsync(supabaseAdmin, sessionId, storageKey, userId)
    );
  } catch (e) {
    console.log("[desktop-recordings] EdgeRuntime not available, skipping async processing");
  }

  // Return new response format
  const response: CompleteRecordingResponse = {
    sessionId,
    editorUrl: `https://getvantage.lovable.app/session/${sessionId}`,
  };

  return new Response(
    JSON.stringify(response),
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
  storageKey: string,
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
