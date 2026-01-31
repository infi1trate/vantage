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

interface ProvisioningResult {
  success: boolean;
  error?: string;
}

/**
 * Provision Dropbox storage by creating folder structure and validation file
 */
async function provisionDropboxStorage(accessToken: string): Promise<ProvisioningResult> {
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

    // Step 3: Upload validation file
    const validationFile = await uploadValidationFile(accessToken);
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
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const content = "Vantage connected successfully";
    const encoder = new TextEncoder();
    const body = encoder.encode(content);

    const response = await fetch(DROPBOX_UPLOAD_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: "/Apps/Vantage/.vantage_connected",
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
      availableRoutes: ["/oauth/start", "/oauth/callback", "/sync", "/status", "/disconnect", "/provision/retry"],
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

  // Store in connected_accounts with pending provisioning status
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
  const provisionResult = await provisionDropboxStorage(tokens.access_token);
  
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
  const body = await req.json();
  const { accessToken } = body;

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "accessToken required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify the user has a Dropbox connection
  const { data: account, error: accountError } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "dropbox")
    .single();

  if (accountError || !account) {
    return new Response(JSON.stringify({ error: "No Dropbox connection found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
 * Sync a video to Dropbox
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSync(
  req: Request,
  userId: string,
  supabase: any
): Promise<Response> {
  const body = await req.json();
  const { sessionId, videoUrl, fileName, accessToken } = body;

  if (!sessionId || !videoUrl) {
    return new Response(JSON.stringify({ error: "sessionId and videoUrl required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

  // Dropbox path: /Apps/Vantage/Recordings/{date}/{filename}
  const date = new Date().toISOString().split("T")[0];
  const sessionTitle = session?.title || "recording";
  const sanitizedTitle = (fileName || sessionTitle)
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .substring(0, 50);
  const dropboxPath = `/Apps/Vantage/Recordings/${date}/${sanitizedTitle}_${sessionId.substring(0, 8)}.webm`;

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
          autorename: true,
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
  // Remove from connected_accounts
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
