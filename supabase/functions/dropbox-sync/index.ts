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
const DROPBOX_LIST_FOLDER_URL = "https://api.dropboxapi.com/2/files/list_folder";
const DROPBOX_MOVE_URL = "https://api.dropboxapi.com/2/files/move_v2";
const DROPBOX_DELETE_URL = "https://api.dropboxapi.com/2/files/delete_v2";
const DROPBOX_GET_METADATA_URL = "https://api.dropboxapi.com/2/files/get_metadata";

// Dropbox path constants
// NOTE: Dropbox "App folder" access roots at /Apps/Vantage/ in the Dropbox UI.
// All API paths are RELATIVE to this sandbox root - "/" in API = "/Apps/Vantage" in UI.
// NEVER prefix with "/Apps" or "/Vantage" - the sandbox handles this automatically.
const RECORDINGS_PATH = "/Recordings";
const VALIDATION_FILE_PATH = "/.vantage_connected.txt";
const TEST_SYNC_FILE_PATH = "/.vantage_sync_test.txt";

// Legacy incorrect paths from previous bugs - need to migrate files from these
const LEGACY_VANTAGE_PATH = "/Vantage";  // Was incorrectly prefixed
const LEGACY_NESTED_PATH = "/Vantage/Recordings";  // Old recordings folder
const LEGACY_DEEP_NESTED_PATH = "/Vantage/Apps/Vantage";  // Double-nested bug

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

interface FileValidationResult {
  valid: boolean;
  fileData?: ArrayBuffer;
  fileSize?: number;
  error?: string;
}

/**
 * Validate that a video file exists in storage and has content
 * This MUST be called server-side before any Dropbox upload attempt
 */
async function validateVideoFile(
  supabase: any,
  storagePath: string | null,
  storageUrl: string | null,
  fallbackUrl?: string | null
): Promise<FileValidationResult> {
  console.log(`[DropboxSync] Validating video file exists...`);
  
  // Check that we have at least one way to access the file
  if (!storagePath && !storageUrl && !fallbackUrl) {
    console.error(`[DropboxSync] No storage path or URL available for validation`);
    return {
      valid: false,
      error: "File not found: No storage path or URL available",
    };
  }
  
  try {
    let fileData: Blob | null = null;
    let downloadMethod = "";
    
    // Try storage path first (most reliable with service role)
    if (storagePath) {
      downloadMethod = "storage_path";
      console.log(`[DropboxSync] Checking file via storage path: ${storagePath}`);
      
      const { data, error } = await supabase.storage
        .from("video-assets")
        .download(storagePath);
      
      if (error) {
        console.error(`[DropboxSync] Storage path download failed:`, error);
        // Don't return yet - try fallback methods
      } else {
        fileData = data;
      }
    }
    
    // Fallback to storage URL
    if (!fileData && storageUrl) {
      downloadMethod = "storage_url";
      console.log(`[DropboxSync] Checking file via storage URL`);
      
      try {
        const response = await fetch(storageUrl);
        if (response.ok) {
          fileData = await response.blob();
        } else {
          console.warn(`[DropboxSync] Storage URL fetch failed: ${response.status}`);
        }
      } catch (fetchError) {
        console.warn(`[DropboxSync] Storage URL fetch error:`, fetchError);
      }
    }
    
    // Last resort: fallback URL (e.g., provided by caller)
    if (!fileData && fallbackUrl) {
      downloadMethod = "fallback_url";
      console.log(`[DropboxSync] Checking file via fallback URL`);
      
      try {
        const response = await fetch(fallbackUrl);
        if (response.ok) {
          fileData = await response.blob();
        } else {
          console.warn(`[DropboxSync] Fallback URL fetch failed: ${response.status}`);
        }
      } catch (fetchError) {
        console.warn(`[DropboxSync] Fallback URL fetch error:`, fetchError);
      }
    }
    
    // Final validation: file must exist
    if (!fileData) {
      console.error(`[DropboxSync] File not found after trying all methods`);
      return {
        valid: false,
        error: "File not found or empty at upload time",
      };
    }
    
    // Convert to ArrayBuffer and check size
    const arrayBuffer = await fileData.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    
    // Validation: file must have content (> 0 bytes)
    if (fileSize === 0) {
      console.error(`[DropboxSync] File exists but is empty (0 bytes)`);
      return {
        valid: false,
        error: "File is empty (0 bytes) at upload time",
      };
    }
    
    // Validation: file should be reasonably sized for a video (> 1KB minimum)
    if (fileSize < 1024) {
      console.warn(`[DropboxSync] File is suspiciously small: ${fileSize} bytes`);
      return {
        valid: false,
        error: `File too small to be a valid video (${fileSize} bytes)`,
      };
    }
    
    console.log(`[DropboxSync] File validation passed: ${fileSize} bytes via ${downloadMethod}`);
    
    return {
      valid: true,
      fileData: arrayBuffer,
      fileSize,
    };
    
  } catch (error) {
    console.error(`[DropboxSync] File validation error:`, error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown validation error",
    };
  }
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
 * Also handles migration from legacy incorrect folder structure
 */
async function provisionDropboxStorage(accessToken: string, userEmail?: string): Promise<ProvisioningResult> {
  console.log("[DropboxSync] Starting storage provisioning...");
  
  try {
    // Step 0: Check for and migrate legacy folder structure
    await migrateLegacyFolderStructure(accessToken);

    // Step 1: Create /Recordings folder (maps to /Apps/Vantage/Recordings in Dropbox UI)
    // Since we're in app sandbox, "/" is the root - no need for /Vantage prefix
    const recordingsFolder = await createDropboxFolder(accessToken, RECORDINGS_PATH);
    if (!recordingsFolder.success && !recordingsFolder.alreadyExists) {
      return { success: false, error: recordingsFolder.error || "Failed to create Recordings folder" };
    }
    console.log(`[DropboxSync] Created ${RECORDINGS_PATH} folder (appears as Apps/Vantage${RECORDINGS_PATH} in Dropbox)`);

    // Step 2: Upload validation file with user info at sandbox root
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
 * Migrate legacy folder structure to correct sandbox-relative paths
 * Handles files from:
 *   /Vantage/Recordings → /Recordings (single nested)
 *   /Vantage/Apps/Vantage → / (double nested)
 */
async function migrateLegacyFolderStructure(accessToken: string): Promise<void> {
  console.log("[DropboxSync] Checking for legacy folder structure...");
  
  try {
    // Check for various legacy paths and migrate files to correct location
    const legacyPaths = [
      { path: LEGACY_NESTED_PATH, desc: "single nested /Vantage/Recordings" },
      { path: LEGACY_DEEP_NESTED_PATH, desc: "double nested /Vantage/Apps/Vantage" },
    ];
    
    for (const legacy of legacyPaths) {
      const exists = await checkFolderExists(accessToken, legacy.path);
      
      if (!exists) {
        console.log(`[DropboxSync] No ${legacy.desc} found, skipping`);
        continue;
      }
      
      console.log(`[DropboxSync] Found ${legacy.desc}, migrating contents...`);
      
      // List all contents of the legacy folder
      const contents = await listFolderContents(accessToken, legacy.path);
      
      if (!contents || contents.length === 0) {
        console.log(`[DropboxSync] Legacy folder ${legacy.path} is empty, cleaning up...`);
        await deleteEmptyFolder(accessToken, legacy.path);
        continue;
      }
      
      console.log(`[DropboxSync] Found ${contents.length} items to migrate from ${legacy.path}`);
      
      // Move each item to the correct root-relative path
      let movedCount = 0;
      let skippedCount = 0;
      
      for (const entry of contents) {
        const sourcePath = entry.path_lower || entry.path_display;
        const fileName = entry.name;
        // If it's a Recordings folder, move to /Recordings
        // Otherwise move to root
        const destPath = entry.name === "Recordings" 
          ? RECORDINGS_PATH 
          : `/${fileName}`;
        
        // Check if destination already exists
        const destExists = await checkPathExists(accessToken, destPath);
        
        if (destExists) {
          console.log(`[DropboxSync] Skipping ${fileName} - already exists at destination`);
          skippedCount++;
          continue;
        }
        
        // Move the file/folder
        const moveResult = await moveDropboxItem(accessToken, sourcePath, destPath);
        
        if (moveResult.success) {
          console.log(`[DropboxSync] Migrated: ${sourcePath} → ${destPath}`);
          movedCount++;
        } else {
          console.warn(`[DropboxSync] Failed to migrate ${fileName}: ${moveResult.error}`);
        }
      }
      
      console.log(`[DropboxSync] Migration from ${legacy.path}: ${movedCount} moved, ${skippedCount} skipped`);
    }
    
    // Clean up empty legacy folders
    await cleanupLegacyFolders(accessToken);
    
  } catch (error) {
    // Migration errors should not block provisioning
    console.error("[DropboxSync] Migration error (non-blocking):", error);
  }
}

/**
 * Check if a folder exists in Dropbox
 */
async function checkFolderExists(accessToken: string, path: string): Promise<boolean> {
  try {
    const response = await fetch(DROPBOX_GET_METADATA_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return data[".tag"] === "folder";
    }
    
    // Consume response body to prevent resource leak
    await response.text();
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if a path (file or folder) exists in Dropbox
 */
async function checkPathExists(accessToken: string, path: string): Promise<boolean> {
  try {
    const response = await fetch(DROPBOX_GET_METADATA_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    });
    
    if (response.ok) {
      return true;
    }
    
    // Consume response body to prevent resource leak
    await response.text();
    return false;
  } catch {
    return false;
  }
}

/**
 * List contents of a Dropbox folder
 */
async function listFolderContents(accessToken: string, path: string): Promise<any[] | null> {
  try {
    const response = await fetch(DROPBOX_LIST_FOLDER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path,
        recursive: false,
        include_deleted: false,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.entries || [];
    }
    
    const errorText = await response.text();
    console.error(`[DropboxSync] List folder ${path} failed:`, errorText);
    return null;
  } catch (error) {
    console.error(`[DropboxSync] List folder ${path} error:`, error);
    return null;
  }
}

/**
 * Move a file or folder in Dropbox
 */
async function moveDropboxItem(
  accessToken: string,
  fromPath: string,
  toPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(DROPBOX_MOVE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_path: fromPath,
        to_path: toPath,
        autorename: false,
        allow_ownership_transfer: false,
      }),
    });
    
    if (response.ok) {
      return { success: true };
    }
    
    const errorData = await response.json();
    return {
      success: false,
      error: errorData?.error_summary || `Move failed: ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Delete an empty folder in Dropbox
 */
async function deleteEmptyFolder(accessToken: string, path: string): Promise<boolean> {
  try {
    // First check if folder is empty
    const contents = await listFolderContents(accessToken, path);
    
    if (contents && contents.length > 0) {
      console.log(`[DropboxSync] Cannot delete ${path} - folder is not empty`);
      return false;
    }
    
    const response = await fetch(DROPBOX_DELETE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    });
    
    if (response.ok) {
      console.log(`[DropboxSync] Deleted empty folder: ${path}`);
      return true;
    }
    
    const errorText = await response.text();
    console.warn(`[DropboxSync] Delete folder ${path} failed:`, errorText);
    return false;
  } catch (error) {
    console.warn(`[DropboxSync] Delete folder ${path} error:`, error);
    return false;
  }
}

/**
 * Clean up legacy folder structure after migration
 * Only deletes folders if they are empty
 */
async function cleanupLegacyFolders(accessToken: string): Promise<void> {
  console.log("[DropboxSync] Cleaning up legacy folders...");
  
  // Try to delete innermost folders first, then work outward
  // /Vantage/Apps/Vantage (deepest)
  await deleteEmptyFolder(accessToken, LEGACY_DEEP_NESTED_PATH);
  
  // /Vantage/Apps
  await deleteEmptyFolder(accessToken, "/Vantage/Apps");
  
  // /Vantage/Recordings
  await deleteEmptyFolder(accessToken, LEGACY_NESTED_PATH);
  
  // /Vantage (outermost legacy folder)
  await deleteEmptyFolder(accessToken, LEGACY_VANTAGE_PATH);
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
          path: VALIDATION_FILE_PATH,
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

    if (path === "/test" && req.method === "POST") {
      return handleTestSync(userId, supabase);
    }

    // Default route - show available endpoints
    return new Response(JSON.stringify({ 
      error: "Not found",
      availableRoutes: ["/oauth/start", "/oauth/callback", "/sync", "/sync/auto", "/status", "/disconnect", "/provision/retry", "/test"],
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

    // Get the video storage path from video_assets (NOT the signed URL which expires)
    const { data: asset, error: assetError } = await supabase
      .from("video_assets")
      .select("storage_path, storage_url, session_id")
      .eq("session_id", sessionId)
      .single();

    if (assetError || !asset) {
      console.warn(`[DropboxSync] No video asset found for session ${sessionId}:`, assetError);
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
    const dropboxPath = `${RECORDINGS_PATH}/${filename}.webm`;

    // CRITICAL: Validate file exists server-side before attempting upload
    // This prevents silent failures when the file is missing or empty
    console.log(`[DropboxSync] Validating video file for auto-sync...`);
    const validation = await validateVideoFile(
      supabase,
      asset.storage_path,
      asset.storage_url,
      null // no fallback URL for auto-sync
    );
    
    if (!validation.valid) {
      console.error(`[DropboxSync] Auto-sync aborted: ${validation.error}`);
      await updateSyncStatus(supabase, sessionId, "failed", validation.error || "File not found or empty at upload time");
      return;
    }
    
    const videoBlob = validation.fileData!;
    const fileSize = validation.fileSize!;
    console.log(`[DropboxSync] File validated: ${fileSize} bytes, proceeding with upload to: ${dropboxPath}`);

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

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "sessionId required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[DropboxSync] Manual sync for session ${sessionId}`);

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

  // Get session info and verify ownership
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

  // Get video asset with storage path
  const { data: asset, error: assetError } = await supabase
    .from("video_assets")
    .select("storage_path, storage_url")
    .eq("session_id", sessionId)
    .single();

  if (assetError || !asset) {
    console.error(`[DropboxSync] No video asset for session ${sessionId}:`, assetError);
    return new Response(JSON.stringify({ error: "No video found for session" }), {
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
  const dropboxPath = `${RECORDINGS_PATH}/${filename}.webm`;

  // CRITICAL: Validate file exists server-side before attempting upload
  // This prevents silent failures when the file is missing or empty
  console.log(`[DropboxSync] Validating video file for manual sync...`);
  const validation = await validateVideoFile(
    supabase,
    asset.storage_path,
    asset.storage_url,
    videoUrl // allow caller-provided URL as fallback
  );
  
  if (!validation.valid) {
    console.error(`[DropboxSync] Manual sync aborted: ${validation.error}`);
    
    // Update sync status to failed with specific error
    await supabase
      .from("dropbox_sync_status")
      .update({
        sync_status: "failed",
        error_message: validation.error || "File not found or empty at upload time",
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);
    
    return new Response(JSON.stringify({ 
      error: validation.error || "File not found or empty at upload time",
      success: false,
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  const videoBlob = validation.fileData!;
  const fileSize = validation.fileSize!;
  console.log(`[DropboxSync] File validated: ${fileSize} bytes, proceeding with upload to: ${dropboxPath}`);

  try {

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

/**
 * Test Dropbox sync by uploading a small test file
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTestSync(userId: string, supabase: any): Promise<Response> {
  console.log(`[DropboxSync] Testing sync for user ${userId}`);

  // Get valid access token
  const tokenResult = await getValidAccessToken(userId, supabase);
  if (!tokenResult.accessToken) {
    return new Response(
      JSON.stringify({ success: false, error: tokenResult.error || "No valid token" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const timestamp = new Date().toISOString();
    const content = `Vantage sync test: ${timestamp}`;
    const encoder = new TextEncoder();
    const body = encoder.encode(content);

    const response = await fetch(DROPBOX_UPLOAD_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: TEST_SYNC_FILE_PATH,
          mode: "overwrite",
          autorename: false,
          mute: true,
        }),
      },
      body,
    });

    if (response.ok) {
      console.log(`[DropboxSync] Test sync succeeded for user ${userId}`);
      return new Response(
        JSON.stringify({ success: true, timestamp }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errorText = await response.text();
    console.error("[DropboxSync] Test sync upload failed:", errorText);
    return new Response(
      JSON.stringify({ success: false, error: `Upload failed: ${response.status}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[DropboxSync] Test sync error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Network error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
