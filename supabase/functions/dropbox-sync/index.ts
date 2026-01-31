import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-custom-path",
};

const DROPBOX_APP_KEY = Deno.env.get("DROPBOX_APP_KEY");
const DROPBOX_APP_SECRET = Deno.env.get("DROPBOX_APP_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Encryption key for token storage - in production this would come from vault
// Using a deterministic key derived from service role key for simplicity
const ENCRYPTION_KEY = SUPABASE_SERVICE_ROLE_KEY?.substring(0, 32) || "default-encryption-key-32-chars!";

// Dropbox API endpoints
const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DROPBOX_UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload";
const DROPBOX_CREATE_FOLDER_URL = "https://api.dropboxapi.com/2/files/create_folder_v2";

interface DropboxTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  account_id?: string;
  uid?: string;
}

/**
 * Sanitize a session title for use as a Dropbox filename
 * - Removes invalid characters (<>:"/\|?*)
 * - Replaces spaces with underscores
 * - Limits length to 80 characters
 * - Appends short session ID for uniqueness
 */
function sanitizeFilename(title: string, sessionId: string): string {
  const sanitized = title
    .replace(/[<>:"/\\|?*]/g, "")  // Remove invalid filename characters
    .replace(/\s+/g, "_")          // Replace spaces with underscores
    .replace(/_+/g, "_")           // Collapse multiple underscores
    .replace(/^_|_$/g, "")         // Remove leading/trailing underscores
    .slice(0, 80);                 // Limit length
  
  // Use first 8 chars of UUID for uniqueness
  const shortId = sessionId.split("-")[0];
  
  // Fallback if title becomes empty after sanitization
  const finalTitle = sanitized || "Recording";
  
  return `${finalTitle}_${shortId}`;
}

interface ProvisioningResult {
  success: boolean;
  error?: string;
}

/**
 * Simple XOR-based encryption for tokens
 * In production, you'd use proper AES encryption with vault secrets
 */
function encryptToken(token: string): string {
  const encoder = new TextEncoder();
  const tokenBytes = encoder.encode(token);
  const keyBytes = encoder.encode(ENCRYPTION_KEY);
  
  const encrypted = new Uint8Array(tokenBytes.length);
  for (let i = 0; i < tokenBytes.length; i++) {
    encrypted[i] = tokenBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  // Encode as base64
  return btoa(String.fromCharCode(...encrypted));
}

/**
 * Decrypt token
 */
function decryptToken(encryptedToken: string): string {
  try {
    // Decode from base64
    const encryptedStr = atob(encryptedToken);
    const encryptedBytes = new Uint8Array(encryptedStr.length);
    for (let i = 0; i < encryptedStr.length; i++) {
      encryptedBytes[i] = encryptedStr.charCodeAt(i);
    }
    
    const keyBytes = new TextEncoder().encode(ENCRYPTION_KEY);
    const decrypted = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("[DropboxSync] Token decryption failed:", error);
    throw new Error("Failed to decrypt token");
  }
}

/**
 * Refresh Dropbox access token using refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  try {
    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: DROPBOX_APP_KEY!,
        client_secret: DROPBOX_APP_SECRET!,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[DropboxSync] Token refresh failed:", errorText);
      return null;
    }

    const tokens: DropboxTokenResponse = await response.json();
    return {
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
    };
  } catch (error) {
    console.error("[DropboxSync] Token refresh error:", error);
    return null;
  }
}

/**
 * Get valid access token for a user, refreshing if needed
 */
async function getValidAccessToken(
  userId: string,
  supabase: any
): Promise<{ accessToken: string; error?: string } | { accessToken: null; error: string }> {
  // Get stored tokens
  const { data: account, error: accountError } = await supabase
    .from("connected_accounts")
    .select("encrypted_access_token, encrypted_refresh_token, token_expires_at, provisioning_status")
    .eq("user_id", userId)
    .eq("provider", "dropbox")
    .single();

  if (accountError || !account) {
    return { accessToken: null, error: "Dropbox not connected" };
  }

  if (!account.encrypted_access_token || !account.encrypted_refresh_token) {
    return { accessToken: null, error: "No stored tokens - reconnect required" };
  }

  try {
    const accessToken = decryptToken(account.encrypted_access_token);
    const refreshToken = decryptToken(account.encrypted_refresh_token);
    
    // Check if token is expired (with 5 minute buffer)
    const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
    const now = new Date();
    const isExpired = !expiresAt || (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000);

    if (isExpired) {
      console.log("[DropboxSync] Access token expired, refreshing...");
      
      const refreshResult = await refreshAccessToken(refreshToken);
      if (!refreshResult) {
        // Update account to indicate token issue
        await supabase
          .from("connected_accounts")
          .update({ provisioning_status: "token_expired" })
          .eq("user_id", userId)
          .eq("provider", "dropbox");
        
        return { accessToken: null, error: "Token refresh failed - reconnect required" };
      }

      // Store new access token
      const newExpiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000);
      await supabase
        .from("connected_accounts")
        .update({
          encrypted_access_token: encryptToken(refreshResult.accessToken),
          token_expires_at: newExpiresAt.toISOString(),
        })
        .eq("user_id", userId)
        .eq("provider", "dropbox");

      return { accessToken: refreshResult.accessToken };
    }

    return { accessToken };
  } catch (error) {
    console.error("[DropboxSync] Token retrieval error:", error);
    return { accessToken: null, error: "Failed to retrieve tokens" };
  }
}

/**
 * Provision Dropbox storage by creating folder structure and validation file
 */
async function provisionDropboxStorage(accessToken: string, userEmail?: string): Promise<ProvisioningResult> {
  console.log("[DropboxSync] Starting storage provisioning...");
  
  try {
    // Step 1: Create /Apps/Vantage folder
    const vantageFolder = await createDropboxFolder(accessToken, "/Apps/Vantage");
    if (!vantageFolder.success && !vantageFolder.alreadyExists) {
      return { success: false, error: vantageFolder.error || "Failed to create Vantage folder" };
    }
    console.log("[DropboxSync] Created /Apps/Vantage folder");

    // Step 2: Create /Apps/Vantage/Recordings subfolder
    const recordingsFolder = await createDropboxFolder(accessToken, "/Apps/Vantage/Recordings");
    if (!recordingsFolder.success && !recordingsFolder.alreadyExists) {
      return { success: false, error: recordingsFolder.error || "Failed to create Recordings folder" };
    }
    console.log("[DropboxSync] Created /Apps/Vantage/Recordings folder");

    // Step 3: Upload validation file with user info
    const validationFile = await uploadValidationFile(accessToken, userEmail);
    if (!validationFile.success) {
      return { success: false, error: validationFile.error || "Failed to upload validation file" };
    }
    console.log("[DropboxSync] Uploaded validation file");

    return { success: true };
  } catch (error) {
    console.error("[DropboxSync] Provisioning error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown provisioning error" 
    };
  }
}

/**
 * Create a folder in Dropbox
 */
async function createDropboxFolder(
  accessToken: string, 
  path: string
): Promise<{ success: boolean; alreadyExists?: boolean; error?: string }> {
  try {
    const response = await fetch(DROPBOX_CREATE_FOLDER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path,
        autorename: false,
      }),
    });

    if (response.ok) {
      return { success: true };
    }

    const errorData = await response.json();
    
    // Handle "folder already exists" case (conflict error)
    if (errorData?.error?.path?.[".tag"] === "conflict") {
      console.log(`[DropboxSync] Folder ${path} already exists (idempotent)`);
      return { success: true, alreadyExists: true };
    }

    console.error(`[DropboxSync] Create folder ${path} failed:`, errorData);
    return { 
      success: false, 
      error: errorData?.error_summary || `Failed to create folder: ${response.status}` 
    };
  } catch (error) {
    console.error(`[DropboxSync] Create folder ${path} error:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Network error" 
    };
  }
}

/**
 * Upload the validation file to confirm write permissions
 */
async function uploadValidationFile(
  accessToken: string,
  userEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const timestamp = new Date().toISOString();
    const content = `Vantage connected: ${userEmail || "unknown"} at ${timestamp}`;
    const encoder = new TextEncoder();
    const body = encoder.encode(content);

    const response = await fetch(DROPBOX_UPLOAD_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: "/Apps/Vantage/.vantage_connected.txt",
          mode: "overwrite",
          autorename: false,
          mute: true,
        }),
      },
      body,
    });

    if (response.ok) {
      return { success: true };
    }

    const errorText = await response.text();
    console.error("[DropboxSync] Upload validation file failed:", errorText);
    return { 
      success: false, 
      error: `Failed to upload validation file: ${response.status}` 
    };
  } catch (error) {
    console.error("[DropboxSync] Upload validation file error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Network error" 
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate environment
    if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET) {
      throw new Error("Dropbox credentials not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    // Get path from custom header (since Supabase functions don't support subpaths well)
    const customPath = req.headers.get("x-custom-path") || "";
    const url = new URL(req.url);
    const urlPath = url.pathname.replace("/dropbox-sync", "");
    const path = customPath || urlPath || "";

    console.log(`[DropboxSync] Request: ${req.method} ${path}`);

    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) as any;
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData.user) {
      console.error("[DropboxSync] Auth error:", claimsError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;

    // Route handling
    if (path === "/oauth/start" && req.method === "POST") {
      return handleOAuthStart(req, userId);
    }

    if (path === "/oauth/callback" && req.method === "POST") {
      return handleOAuthCallback(req, userId, supabase);
    }

    if (path === "/sync" && req.method === "POST") {
      return handleSync(req, userId, supabase);
    }

    if (path === "/sync/auto" && req.method === "POST") {
      return handleAutoSync(req, userId, supabase);
    }

    if (path === "/status" && req.method === "GET") {
      return handleGetStatus(url, userId, supabase);
    }

    if ((path === "/disconnect" && req.method === "DELETE") || 
        (path === "/disconnect" && req.method === "POST")) {
      return handleDisconnect(userId, supabase);
    }

    if (path === "/provision/retry" && req.method === "POST") {
      return handleRetryProvisioning(req, userId, supabase);
    }

    // Default route - show available endpoints
    return new Response(JSON.stringify({ 
      error: "Not found",
      availableRoutes: ["/oauth/start", "/oauth/callback", "/sync", "/sync/auto", "/status", "/disconnect", "/provision/retry"],
      receivedPath: path,
    }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[DropboxSync] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Generate OAuth authorization URL for Dropbox
 */
async function handleOAuthStart(req: Request, userId: string): Promise<Response> {
  const body = await req.json();
  const redirectUri = body.redirectUri;

  if (!redirectUri) {
    return new Response(JSON.stringify({ error: "redirectUri required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  const authUrl = new URL("https://www.dropbox.com/oauth2/authorize");
  authUrl.searchParams.set("client_id", DROPBOX_APP_KEY!);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("token_access_type", "offline");
  authUrl.searchParams.set("state", state);

  console.log(`[DropboxSync] OAuth start for user ${userId}`);

  return new Response(
    JSON.stringify({ authUrl: authUrl.toString(), state }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Exchange OAuth code for tokens, save to connected_accounts, and provision storage
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOAuthCallback(
  req: Request,
  userId: string,
  supabase: any
): Promise<Response> {
  const body = await req.json();
  const { code, redirectUri } = body;

  if (!code || !redirectUri) {
    return new Response(JSON.stringify({ error: "code and redirectUri required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Exchange code for tokens
  const tokenResponse = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: DROPBOX_APP_KEY!,
      client_secret: DROPBOX_APP_SECRET!,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("[DropboxSync] Token exchange failed:", errorText);
    return new Response(JSON.stringify({ error: "Failed to exchange code for tokens" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tokens: DropboxTokenResponse = await tokenResponse.json();

  // Get Dropbox account info
  const accountResponse = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  let accountEmail = "";
  let accountId = tokens.account_id || "";

  if (accountResponse.ok) {
    const accountData = await accountResponse.json();
    accountEmail = accountData.email || "";
    accountId = accountData.account_id || accountId;
  }

  // Encrypt tokens for secure storage
  const encryptedAccessToken = encryptToken(tokens.access_token);
  const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
  const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in || 14400) * 1000);

  // Store in connected_accounts with tokens and pending provisioning status
  const { error: upsertError } = await supabase
    .from("connected_accounts")
    .upsert({
      user_id: userId,
      provider: "dropbox",
      provider_account_id: accountId,
      provider_email: accountEmail,
      display_handle: accountEmail,
      connected_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
      provisioning_status: "pending",
      encrypted_access_token: encryptedAccessToken,
      encrypted_refresh_token: encryptedRefreshToken,
      token_expires_at: tokenExpiresAt.toISOString(),
    }, {
      onConflict: "user_id,provider",
    });

  if (upsertError) {
    console.error("[DropboxSync] Failed to save account:", upsertError);
    return new Response(JSON.stringify({ error: "Failed to save connection" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[DropboxSync] Connected Dropbox for user ${userId}: ${accountEmail}`);

  // Provision Dropbox storage (non-blocking on failure)
  const provisionResult = await provisionDropboxStorage(tokens.access_token, accountEmail);
  
  // Update provisioning status based on result
  const provisioningStatus = provisionResult.success ? "completed" : "failed";
  
  const { error: updateError } = await supabase
    .from("connected_accounts")
    .update({ provisioning_status: provisioningStatus })
    .eq("user_id", userId)
    .eq("provider", "dropbox");

  if (updateError) {
    console.error("[DropboxSync] Failed to update provisioning status:", updateError);
  }

  if (!provisionResult.success) {
    console.warn(`[DropboxSync] Provisioning failed for user ${userId}: ${provisionResult.error}`);
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      email: accountEmail,
      accountId,
      provisioned: provisionResult.success,
      provisioningError: provisionResult.error,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Retry provisioning for a failed Dropbox connection
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRetryProvisioning(
  req: Request,
  userId: string,
  supabase: any
): Promise<Response> {
  // Try to get stored access token first
  const tokenResult = await getValidAccessToken(userId, supabase);
  
  let accessToken: string;
  
  if (tokenResult.accessToken) {
    accessToken = tokenResult.accessToken;
  } else {
    // Fall back to provided accessToken in request body
    const body = await req.json();
    if (!body.accessToken) {
      return new Response(JSON.stringify({ error: tokenResult.error || "No access token available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    accessToken = body.accessToken;
  }

  // Update status to pending before retrying
  await supabase
    .from("connected_accounts")
    .update({ provisioning_status: "pending" })
    .eq("user_id", userId)
    .eq("provider", "dropbox");

  // Attempt provisioning
  const provisionResult = await provisionDropboxStorage(accessToken);
  
  // Update status based on result
  const provisioningStatus = provisionResult.success ? "completed" : "failed";
  
  await supabase
    .from("connected_accounts")
    .update({ provisioning_status: provisioningStatus })
    .eq("user_id", userId)
    .eq("provider", "dropbox");

  console.log(`[DropboxSync] Retry provisioning for user ${userId}: ${provisioningStatus}`);

  return new Response(
    JSON.stringify({ 
      success: provisionResult.success,
      error: provisionResult.error,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Auto-sync a video to Dropbox (background, fire-and-forget)
 * Called after cloud upload completes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAutoSync(
  req: Request,
  userId: string,
  supabase: any
): Promise<Response> {
  const body = await req.json();
  const { sessionId } = body;

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "sessionId required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[DropboxSync] Auto-sync requested for session ${sessionId}`);

  // Return immediately, process in background
  // @ts-ignore - EdgeRuntime is available in Supabase edge functions
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(executeAutoSync(sessionId, userId, supabase));
  } else {
    // Fallback: execute inline but don't await
    executeAutoSync(sessionId, userId, supabase).catch(err => {
      console.error("[DropboxSync] Auto-sync background error:", err);
    });
  }

  return new Response(
    JSON.stringify({ success: true, message: "Sync started in background" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Execute the auto-sync operation (runs in background)
 */
async function executeAutoSync(
  sessionId: string,
  userId: string,
  supabase: any
): Promise<void> {
  try {
    console.log(`[DropboxSync] Starting background auto-sync for session ${sessionId}`);

    // Get valid access token
    const tokenResult = await getValidAccessToken(userId, supabase);
    if (!tokenResult.accessToken) {
      console.warn(`[DropboxSync] Auto-sync skipped: ${tokenResult.error}`);
      await updateSyncStatus(supabase, sessionId, "failed", tokenResult.error);
      return;
    }

    // Get the video URL from video_assets
    const { data: asset, error: assetError } = await supabase
      .from("video_assets")
      .select("storage_url, session_id")
      .eq("session_id", sessionId)
      .single();

    if (assetError || !asset?.storage_url) {
      console.warn(`[DropboxSync] No video asset found for session ${sessionId}`);
      await updateSyncStatus(supabase, sessionId, "failed", "No video found");
      return;
    }

    // Get session info
    const { data: session } = await supabase
      .from("capture_sessions")
      .select("title")
      .eq("id", sessionId)
      .single();

    // Update sync status to syncing
    await supabase
      .from("dropbox_sync_status")
      .upsert({
        user_id: userId,
        session_id: sessionId,
        sync_status: "syncing",
        started_at: new Date().toISOString(),
        error_message: null,
      }, {
        onConflict: "session_id",
      });

    // Build Dropbox path with human-readable filename
    const filename = sanitizeFilename(session?.title || "Recording", sessionId);
    const dropboxPath = `/Apps/Vantage/Recordings/${filename}.webm`;

    // Download video from storage
    console.log(`[DropboxSync] Downloading video for auto-sync`);
    
    const videoResponse = await fetch(asset.storage_url);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }
    
    const videoBlob = await videoResponse.arrayBuffer();
    const fileSize = videoBlob.byteLength;

    console.log(`[DropboxSync] Uploading ${fileSize} bytes to Dropbox: ${dropboxPath}`);

    // Upload to Dropbox
    const uploadResponse = await fetch(DROPBOX_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: dropboxPath,
          mode: "overwrite",
          autorename: false,
          mute: true,
        }),
      },
      body: videoBlob,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("[DropboxSync] Auto-sync upload failed:", errorText);
      await updateSyncStatus(supabase, sessionId, "failed", `Upload failed: ${uploadResponse.status}`);
      return;
    }

    const uploadResult = await uploadResponse.json();

    // Update sync status to completed
    await supabase
      .from("dropbox_sync_status")
      .update({
        sync_status: "completed",
        dropbox_path: uploadResult.path_display || dropboxPath,
        dropbox_file_id: uploadResult.id,
        file_size_bytes: fileSize,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("session_id", sessionId);

    // Update last_used_at for the Dropbox connection
    await supabase
      .from("connected_accounts")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("provider", "dropbox");

    console.log(`[DropboxSync] Auto-sync completed for session ${sessionId} to ${dropboxPath}`);

  } catch (error) {
    console.error("[DropboxSync] Auto-sync error:", error);
    await updateSyncStatus(
      supabase, 
      sessionId, 
      "failed", 
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Helper to update sync status
 */
async function updateSyncStatus(
  supabase: any,
  sessionId: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  await supabase
    .from("dropbox_sync_status")
    .update({
      sync_status: status,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString(),
      ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("session_id", sessionId);
}

/**
 * Sync a video to Dropbox (manual trigger with provided token)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSync(
  req: Request,
  userId: string,
  supabase: any
): Promise<Response> {
  const body = await req.json();
  const { sessionId, videoUrl, fileName, accessToken: providedToken } = body;

  if (!sessionId || !videoUrl) {
    return new Response(JSON.stringify({ error: "sessionId and videoUrl required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get access token - use provided or retrieve stored
  let accessToken: string;
  
  if (providedToken) {
    accessToken = providedToken;
  } else {
    const tokenResult = await getValidAccessToken(userId, supabase);
    if (!tokenResult.accessToken) {
      return new Response(JSON.stringify({ error: tokenResult.error || "No access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    accessToken = tokenResult.accessToken;
  }

  // Verify session ownership
  const { data: session, error: sessionError } = await supabase
    .from("capture_sessions")
    .select("id, title, user_id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (sessionError || !session) {
    return new Response(JSON.stringify({ error: "Session not found or access denied" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create or update sync status
  await supabase
    .from("dropbox_sync_status")
    .upsert({
      user_id: userId,
      session_id: sessionId,
      sync_status: "syncing",
      started_at: new Date().toISOString(),
      error_message: null,
    }, {
      onConflict: "session_id",
    });

  // Build Dropbox path with human-readable filename
  const filename = sanitizeFilename(session?.title || "Recording", sessionId);
  const dropboxPath = `/Apps/Vantage/Recordings/${filename}.webm`;

  try {
    // Download video from storage
    console.log(`[DropboxSync] Downloading video for session ${sessionId}`);
    
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }
    
    const videoBlob = await videoResponse.arrayBuffer();
    const fileSize = videoBlob.byteLength;

    console.log(`[DropboxSync] Uploading ${fileSize} bytes to Dropbox: ${dropboxPath}`);

    // Upload to Dropbox
    const uploadResponse = await fetch(DROPBOX_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: dropboxPath,
          mode: "overwrite",
          autorename: false,
          mute: true,
        }),
      },
      body: videoBlob,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("[DropboxSync] Upload failed:", errorText);
      
      // Update sync status to failed
      await supabase
        .from("dropbox_sync_status")
        .update({
          sync_status: "failed",
          error_message: `Upload failed: ${uploadResponse.status}`,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId);

      throw new Error(`Dropbox upload failed: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();

    // Update sync status to completed
    await supabase
      .from("dropbox_sync_status")
      .update({
        sync_status: "completed",
        dropbox_path: uploadResult.path_display || dropboxPath,
        dropbox_file_id: uploadResult.id,
        file_size_bytes: fileSize,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("session_id", sessionId);

    // Update last_used_at for the Dropbox connection
    await supabase
      .from("connected_accounts")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("provider", "dropbox");

    console.log(`[DropboxSync] Successfully synced session ${sessionId} to ${dropboxPath}`);

    return new Response(
      JSON.stringify({
        success: true,
        path: uploadResult.path_display,
        fileId: uploadResult.id,
        size: fileSize,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[DropboxSync] Sync error:", error);

    // Update sync status to failed
    await supabase
      .from("dropbox_sync_status")
      .update({
        sync_status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Sync failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Get sync status for a session
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleGetStatus(
  url: URL,
  userId: string,
  supabase: any
): Promise<Response> {
  const sessionId = url.searchParams.get("sessionId");

  if (sessionId) {
    // Get status for specific session
    const { data, error } = await supabase
      .from("dropbox_sync_status")
      .select("*")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[DropboxSync] Status query error:", error);
    }

    return new Response(
      JSON.stringify({ status: data || null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get all sync statuses for user
  const { data, error } = await supabase
    .from("dropbox_sync_status")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[DropboxSync] Status query error:", error);
  }

  return new Response(
    JSON.stringify({ statuses: data || [] }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Disconnect Dropbox account
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleDisconnect(
  userId: string,
  supabase: any
): Promise<Response> {
  // Remove from connected_accounts (including tokens)
  const { error } = await supabase
    .from("connected_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "dropbox");

  if (error) {
    console.error("[DropboxSync] Disconnect error:", error);
    return new Response(JSON.stringify({ error: "Failed to disconnect" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[DropboxSync] Disconnected Dropbox for user ${userId}`);

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
