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

// Dropbox upload session endpoints (for large files)
const DROPBOX_UPLOAD_SESSION_START_URL = "https://content.dropboxapi.com/2/files/upload_session/start";
const DROPBOX_UPLOAD_SESSION_APPEND_URL = "https://content.dropboxapi.com/2/files/upload_session/append_v2";
const DROPBOX_UPLOAD_SESSION_FINISH_URL = "https://content.dropboxapi.com/2/files/upload_session/finish";

// Upload size thresholds
const SIMPLE_UPLOAD_MAX_SIZE = 150 * 1024 * 1024; // 150MB - Dropbox limit for simple upload
const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks for session uploads (must be multiple of 4MB)

// Retry configuration for transient failures
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 5000; // 5 seconds
const RETRY_MAX_DELAY_MS = 120000; // 2 minutes max

/**
 * Check if an error is transient (retryable)
 * Transient errors include: timeouts, 429 rate limits, 5xx server errors
 */
function isTransientError(error: string | Error | null): boolean {
  if (!error) return false;
  const errorStr = typeof error === "string" ? error : error.message;
  const lowerError = errorStr.toLowerCase();
  
  // Timeout errors
  if (lowerError.includes("timeout") || 
      lowerError.includes("timed out") ||
      lowerError.includes("deadline exceeded")) {
    return true;
  }
  
  // Rate limiting
  if (lowerError.includes("429") || 
      lowerError.includes("rate limit") ||
      lowerError.includes("too many requests")) {
    return true;
  }
  
  // Server errors (5xx)
  if (lowerError.includes("500") || 
      lowerError.includes("502") || 
      lowerError.includes("503") || 
      lowerError.includes("504") ||
      lowerError.includes("internal server error") ||
      lowerError.includes("service unavailable") ||
      lowerError.includes("gateway")) {
    return true;
  }
  
  // Network errors
  if (lowerError.includes("network") ||
      lowerError.includes("connection") ||
      lowerError.includes("econnrefused") ||
      lowerError.includes("enotfound")) {
    return true;
  }
  
  return false;
}

/**
 * Calculate exponential backoff delay for retry
 */
function calculateRetryDelay(attemptCount: number): number {
  // Exponential backoff: 5s, 15s, 45s, 90s, 120s (capped)
  const delay = RETRY_BASE_DELAY_MS * Math.pow(3, attemptCount - 1);
  return Math.min(delay, RETRY_MAX_DELAY_MS);
}

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

    if (path === "/list-recordings" && (req.method === "GET" || req.method === "POST")) {
      return handleListRecordings(userId, supabase);
    }

    // Default route - show available endpoints
    return new Response(JSON.stringify({ 
      error: "Not found",
      availableRoutes: ["/oauth/start", "/oauth/callback", "/sync", "/sync/auto", "/status", "/disconnect", "/provision/retry", "/test", "/list-recordings"],
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
 * Verify uploaded file exists in Dropbox via metadata API
 * Returns file metadata if found, null if not found
 */
async function verifyDropboxUpload(
  accessToken: string,
  dropboxPath: string
): Promise<{ verified: boolean; fileId?: string; size?: number; rev?: string; error?: string }> {
  console.log(`[DropboxSync] Verifying upload at path: ${dropboxPath}`);
  
  try {
    const response = await fetch(DROPBOX_GET_METADATA_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: dropboxPath }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DropboxSync] Verification failed - metadata request error:`, errorText);
      return { 
        verified: false, 
        error: `Metadata request failed: ${response.status}` 
      };
    }
    
    const metadata = await response.json();
    console.log(`[DropboxSync] Verification response:`, JSON.stringify(metadata));
    
    // Verify it's a file (not a folder)
    if (metadata[".tag"] !== "file") {
      console.error(`[DropboxSync] Verification failed - path is not a file:`, metadata[".tag"]);
      return { 
        verified: false, 
        error: `Path is not a file: ${metadata[".tag"]}` 
      };
    }
    
    // Verify file has content
    if (!metadata.size || metadata.size === 0) {
      console.error(`[DropboxSync] Verification failed - file is empty`);
      return { 
        verified: false, 
        error: "Uploaded file is empty (0 bytes)" 
      };
    }
    
    console.log(`[DropboxSync] Verification SUCCESS: file_id=${metadata.id}, size=${metadata.size}, rev=${metadata.rev}`);
    
    return {
      verified: true,
      fileId: metadata.id,
      size: metadata.size,
      rev: metadata.rev,
    };
    
  } catch (error) {
    console.error(`[DropboxSync] Verification error:`, error);
    return { 
      verified: false, 
      error: error instanceof Error ? error.message : "Verification network error" 
    };
  }
}

/**
 * Dropbox upload session expiry time (48 hours according to Dropbox docs)
 * We use a conservative 24 hours to be safe
 */
const UPLOAD_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Check if a Dropbox upload session is still valid
 * Sessions expire after 48h but we use 24h to be safe
 */
function isUploadSessionValid(sessionStartedAt: string | null): boolean {
  if (!sessionStartedAt) return false;
  const startedAt = new Date(sessionStartedAt).getTime();
  const age = Date.now() - startedAt;
  return age < UPLOAD_SESSION_MAX_AGE_MS;
}

/**
 * Update upload session state in database
 */
async function updateUploadSessionState(
  supabase: any,
  sessionId: string,
  uploadSessionId: string | null,
  offset: number,
  totalBytes: number,
  sessionStartedAt: string | null
): Promise<void> {
  await supabase
    .from("dropbox_sync_status")
    .update({
      upload_session_id: uploadSessionId,
      upload_offset: offset,
      upload_total_bytes: totalBytes,
      upload_session_started_at: sessionStartedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);
}

/**
 * Clear upload session state after completion or failure
 */
async function clearUploadSessionState(supabase: any, sessionId: string): Promise<void> {
  await supabase
    .from("dropbox_sync_status")
    .update({
      upload_session_id: null,
      upload_offset: 0,
      upload_total_bytes: null,
      upload_session_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);
}

/**
 * Stream upload a file to Dropbox using chunked upload sessions
 * Fetches chunks from a signed URL and uploads directly to avoid memory issues
 * 
 * This is the preferred method for large files (>8MB) as it:
 * - Never loads the entire file into memory
 * - Fetches one chunk at a time using Range requests
 * - Uploads each chunk immediately then frees memory
 * - RESUMABLE: Stores session state in DB and can resume from last successful chunk
 */
async function streamUploadToDropbox(
  accessToken: string,
  signedUrl: string,
  totalSize: number,
  dropboxPath: string,
  supabase?: any,
  captureSessionId?: string,
  existingSessionState?: {
    upload_session_id: string | null;
    upload_offset: number | null;
    upload_session_started_at: string | null;
  }
): Promise<{ success: boolean; uploadResult?: any; error?: string; method?: string; resumed?: boolean }> {
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
  const canPersist = supabase && captureSessionId;
  
  let dropboxSessionId: string | null = null;
  let offset = 0;
  let chunkIndex = 0;
  let resumed = false;
  
  console.log(`[DropboxSync] Starting streaming upload: ${totalSize} bytes, ${totalChunks} chunks of ${CHUNK_SIZE} bytes`);
  
  try {
    // ===== CHECK FOR RESUMABLE SESSION =====
    if (existingSessionState?.upload_session_id && 
        isUploadSessionValid(existingSessionState.upload_session_started_at) &&
        existingSessionState.upload_offset !== null &&
        existingSessionState.upload_offset > 0) {
      
      // We have an existing session - try to resume
      dropboxSessionId = existingSessionState.upload_session_id;
      offset = existingSessionState.upload_offset;
      chunkIndex = Math.floor(offset / CHUNK_SIZE);
      resumed = true;
      
      console.log(`[DropboxSync] RESUMING upload session ${dropboxSessionId} from offset ${offset} (chunk ${chunkIndex + 1}/${totalChunks})`);
      
      // Verify the session is still valid by checking with Dropbox
      // We do this by attempting a 0-byte append at the current offset
      try {
        const verifyResponse = await fetch(DROPBOX_UPLOAD_SESSION_APPEND_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({
              cursor: {
                session_id: dropboxSessionId,
                offset: offset,
              },
              close: false,
            }),
          },
          body: new Uint8Array(0),
        });
        
        if (!verifyResponse.ok) {
          const errorText = await verifyResponse.text();
          console.warn(`[DropboxSync] Existing session invalid or expired: ${errorText}`);
          // Session expired or invalid - start fresh
          dropboxSessionId = null;
          offset = 0;
          chunkIndex = 0;
          resumed = false;
          
          if (canPersist) {
            await clearUploadSessionState(supabase, captureSessionId);
          }
        } else {
          console.log(`[DropboxSync] Session verified, resuming from offset ${offset}`);
        }
      } catch (verifyError) {
        console.warn(`[DropboxSync] Session verification failed:`, verifyError);
        dropboxSessionId = null;
        offset = 0;
        chunkIndex = 0;
        resumed = false;
      }
    }
    // ===== END RESUMABLE SESSION CHECK =====
    
    // ===== START NEW SESSION IF NEEDED =====
    if (!dropboxSessionId) {
      console.log(`[DropboxSync] Fetching chunk 1/${totalChunks}...`);
      const firstChunkEnd = Math.min(CHUNK_SIZE, totalSize) - 1;
      
      const firstChunkResponse = await fetch(signedUrl, {
        headers: { "Range": `bytes=0-${firstChunkEnd}` }
      });
      
      if (!firstChunkResponse.ok && firstChunkResponse.status !== 206) {
        return { success: false, error: `Failed to fetch first chunk: ${firstChunkResponse.status}` };
      }
      
      const firstChunk = await firstChunkResponse.arrayBuffer();
      const isLastChunk = totalSize <= CHUNK_SIZE;
      
      console.log(`[DropboxSync] Starting upload session with ${firstChunk.byteLength} bytes...`);
      const startResponse = await fetch(DROPBOX_UPLOAD_SESSION_START_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            close: isLastChunk,
          }),
        },
        body: firstChunk,
      });
      
      if (!startResponse.ok) {
        const errorText = await startResponse.text();
        console.error(`[DropboxSync] Session start failed:`, errorText);
        return { success: false, error: `Session start failed: ${startResponse.status} - ${errorText}` };
      }
      
      const startResult = await startResponse.json();
      dropboxSessionId = startResult.session_id;
      offset = firstChunk.byteLength;
      chunkIndex = 1;
      
      console.log(`[DropboxSync] Upload session started: ${dropboxSessionId}`);
      
      // Persist session state after first chunk
      if (canPersist) {
        await updateUploadSessionState(
          supabase,
          captureSessionId,
          dropboxSessionId,
          offset,
          totalSize,
          new Date().toISOString()
        );
        console.log(`[DropboxSync] Session state persisted: offset=${offset}`);
      }
    }
    // ===== END START NEW SESSION =====
    
    // ===== UPLOAD REMAINING CHUNKS =====
    while (offset < totalSize) {
      const chunkEnd = Math.min(offset + CHUNK_SIZE, totalSize) - 1;
      const isLast = chunkEnd >= totalSize - 1;
      
      console.log(`[DropboxSync] Fetching chunk ${chunkIndex + 1}/${totalChunks} (bytes ${offset}-${chunkEnd})...`);
      
      const chunkResponse = await fetch(signedUrl, {
        headers: { "Range": `bytes=${offset}-${chunkEnd}` }
      });
      
      if (!chunkResponse.ok && chunkResponse.status !== 206) {
        // Don't clear session state on fetch failure - can retry
        return { success: false, error: `Failed to fetch chunk ${chunkIndex + 1}: ${chunkResponse.status}`, resumed };
      }
      
      const chunk = await chunkResponse.arrayBuffer();
      
      console.log(`[DropboxSync] Uploading chunk ${chunkIndex + 1}/${totalChunks}: ${chunk.byteLength} bytes, isLast=${isLast}`);
      
      const appendResponse = await fetch(DROPBOX_UPLOAD_SESSION_APPEND_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            cursor: {
              session_id: dropboxSessionId,
              offset: offset,
            },
            close: isLast,
          }),
        },
        body: chunk,
      });
      
      if (!appendResponse.ok) {
        const errorText = await appendResponse.text();
        console.error(`[DropboxSync] Chunk append failed at offset ${offset}:`, errorText);
        // Check if it's an offset mismatch - might be able to recover
        if (errorText.includes("incorrect_offset")) {
          console.warn(`[DropboxSync] Offset mismatch detected - session state may be stale`);
        }
        // Don't clear session on append failure - Dropbox session might still be valid
        return { success: false, error: `Chunk ${chunkIndex + 1} failed: ${appendResponse.status} - ${errorText}`, resumed };
      }
      
      // Consume response body to free resources
      await appendResponse.text();
      
      offset += chunk.byteLength;
      chunkIndex++;
      
      // Persist updated offset after each successful chunk
      if (canPersist && !isLast) {
        await updateUploadSessionState(
          supabase,
          captureSessionId,
          dropboxSessionId,
          offset,
          totalSize,
          existingSessionState?.upload_session_started_at || new Date().toISOString()
        );
        console.log(`[DropboxSync] Progress persisted: ${offset}/${totalSize} bytes (${Math.round(offset/totalSize*100)}%)`);
      }
    }
    // ===== END UPLOAD REMAINING CHUNKS =====
    
    // ===== FINISH UPLOAD SESSION =====
    console.log(`[DropboxSync] Finishing upload session...`);
    const finishResponse = await fetch(DROPBOX_UPLOAD_SESSION_FINISH_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          cursor: {
            session_id: dropboxSessionId,
            offset: totalSize,
          },
          commit: {
            path: dropboxPath,
            mode: "overwrite",
            autorename: false,
            mute: true,
          },
        }),
      },
      body: new Uint8Array(0),
    });
    
    if (!finishResponse.ok) {
      const errorText = await finishResponse.text();
      console.error(`[DropboxSync] Session finish failed:`, errorText);
      // Clear session state on finish failure - session is now unusable
      if (canPersist) {
        await clearUploadSessionState(supabase, captureSessionId);
      }
      return { success: false, error: `Session finish failed: ${finishResponse.status} - ${errorText}`, resumed };
    }
    
    const uploadResult = await finishResponse.json();
    console.log(`[DropboxSync] Streaming upload completed:`, JSON.stringify(uploadResult));
    
    // Clear session state on success
    if (canPersist) {
      await clearUploadSessionState(supabase, captureSessionId);
    }
    
    return { 
      success: true, 
      uploadResult, 
      method: resumed ? "streaming_session_resumed" : "streaming_session",
      resumed 
    };
    
  } catch (error) {
    console.error(`[DropboxSync] Streaming upload error:`, error);
    // Don't clear session state on network error - might be able to resume
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Streaming upload network error",
      resumed
    };
  }
}

/**
 * Simple upload for small files (< 8MB)
 * Downloads entire file and uploads in one request
 */
async function simpleUploadToDropbox(
  accessToken: string,
  signedUrl: string,
  dropboxPath: string
): Promise<{ success: boolean; uploadResult?: any; error?: string; method?: string }> {
  console.log(`[DropboxSync] Using simple upload for small file`);
  
  try {
    // Download file
    const downloadResponse = await fetch(signedUrl);
    if (!downloadResponse.ok) {
      return { success: false, error: `Failed to download file: ${downloadResponse.status}` };
    }
    
    const fileData = await downloadResponse.arrayBuffer();
    console.log(`[DropboxSync] Downloaded ${fileData.byteLength} bytes for simple upload`);
    
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
      body: fileData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("[DropboxSync] Simple upload failed:", errorText);
      return { success: false, error: `Upload failed: ${uploadResponse.status} - ${errorText}` };
    }

    const uploadResult = await uploadResponse.json();
    console.log(`[DropboxSync] Simple upload completed:`, JSON.stringify(uploadResult));
    return { success: true, uploadResult, method: "simple_upload" };
    
  } catch (error) {
    console.error(`[DropboxSync] Simple upload error:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Simple upload network error" 
    };
  }
}

/**
 * Get a signed URL for a storage path with specified expiry
 */
async function getSignedUrl(
  supabase: any,
  storagePath: string,
  expiresIn = 3600
): Promise<{ signedUrl: string | null; error?: string }> {
  const { data, error } = await supabase.storage
    .from("video-assets")
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    console.error("[DropboxSync] Failed to create signed URL:", error);
    return { signedUrl: null, error: error?.message || "Failed to create signed URL" };
  }

  return { signedUrl: data.signedUrl };
}

/**
 * Upload a file to Dropbox using streaming - automatically chooses method based on file size
 * Uses signed URL and Range requests to avoid loading entire file into memory
 * Supports resumable uploads by persisting session state in the database
 */
async function uploadToDropboxStreaming(
  accessToken: string,
  signedUrl: string,
  fileSize: number,
  dropboxPath: string,
  supabase?: any,
  captureSessionId?: string,
  existingSessionState?: {
    upload_session_id: string | null;
    upload_offset: number | null;
    upload_session_started_at: string | null;
  }
): Promise<{ success: boolean; uploadResult?: any; error?: string; method?: string; resumed?: boolean }> {
  // Use streaming for files > 8MB (one chunk), simple for smaller files
  const useStreaming = fileSize > CHUNK_SIZE;
  
  if (useStreaming) {
    console.log(`[DropboxSync] Using streaming upload for ${fileSize} bytes (> ${CHUNK_SIZE / 1024 / 1024}MB)`);
    return streamUploadToDropbox(
      accessToken, 
      signedUrl, 
      fileSize, 
      dropboxPath,
      supabase,
      captureSessionId,
      existingSessionState
    );
  }
  
  console.log(`[DropboxSync] Using simple upload for ${fileSize} bytes`);
  return simpleUploadToDropbox(accessToken, signedUrl, dropboxPath);
}

/**
 * Execute the auto-sync operation (runs in background)
 * Uses streaming upload to avoid memory issues with large files
 */
async function executeAutoSync(
  sessionId: string,
  userId: string,
  supabase: any
): Promise<void> {
  // Track attempt count at function scope for error handling
  let currentAttemptCount = 1;
  
  try {
    console.log(`[DropboxSync] Starting background auto-sync for session ${sessionId}`);

    // ===== IDEMPOTENCY CHECK FOR AUTO-SYNC =====
    const { data: existingStatus, error: statusError } = await supabase
      .from("dropbox_sync_status")
      .select("sync_status, dropbox_file_id, started_at, attempt_count, upload_session_id, upload_offset, upload_session_started_at, next_retry_at")
      .eq("session_id", sessionId)
      .single();

    if (!statusError && existingStatus) {
      // Already synced - skip
      if (existingStatus.sync_status === "completed" && existingStatus.dropbox_file_id) {
        console.log(`[DropboxSync] Auto-sync skipped - session ${sessionId} already synced`);
        return;
      }

      // Check if this is a pending retry that's not ready yet
      if (existingStatus.sync_status === "pending" && existingStatus.next_retry_at) {
        const retryAt = new Date(existingStatus.next_retry_at).getTime();
        if (Date.now() < retryAt) {
          const waitSecs = Math.round((retryAt - Date.now()) / 1000);
          console.log(`[DropboxSync] Auto-sync skipped - retry scheduled in ${waitSecs}s`);
          return;
        }
        // Retry time has passed, proceed with sync
        console.log(`[DropboxSync] Retry time reached, proceeding with attempt ${(existingStatus.attempt_count || 0) + 1}`);
      }

      // Check for active upload (not stale) - but allow if it's resumable
      if (existingStatus.sync_status === "syncing" && existingStatus.started_at) {
        const startedAt = new Date(existingStatus.started_at).getTime();
        const elapsedMs = Date.now() - startedAt;
        const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

        // If we have a resumable session, allow continuing even if "syncing"
        const hasResumableSession = existingStatus.upload_session_id && 
          existingStatus.upload_offset > 0 &&
          isUploadSessionValid(existingStatus.upload_session_started_at);

        if (elapsedMs < STALE_THRESHOLD_MS && !hasResumableSession) {
          console.log(`[DropboxSync] Auto-sync skipped - session ${sessionId} has active upload`);
          return;
        }
        
        if (hasResumableSession) {
          console.log(`[DropboxSync] Found resumable session for ${sessionId} - will attempt to resume`);
        }
      }
      
      // Capture attempt count for use in error handling
      currentAttemptCount = existingStatus.attempt_count || 1;
    }
    // ===== END IDEMPOTENCY CHECK =====

    // Get valid access token
    const tokenResult = await getValidAccessToken(userId, supabase);
    if (!tokenResult.accessToken) {
      console.warn(`[DropboxSync] Auto-sync skipped: ${tokenResult.error}`);
      await updateSyncStatus(supabase, sessionId, "failed", tokenResult.error);
      return;
    }

    // Get the video storage path from video_assets
    const { data: asset, error: assetError } = await supabase
      .from("video_assets")
      .select("storage_path, storage_url, file_size_bytes, session_id")
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

    // ===== ATOMIC LOCK: Acquire sync lock =====
    const { error: lockError } = await supabase
      .from("dropbox_sync_status")
      .upsert({
        user_id: userId,
        session_id: sessionId,
        sync_status: "syncing",
        started_at: new Date().toISOString(),
        error_message: null,
        attempt_count: (existingStatus?.attempt_count || 0) + 1,
        last_attempt_at: new Date().toISOString(),
      }, {
        onConflict: "session_id",
      });

    if (lockError) {
      console.error(`[DropboxSync] Auto-sync failed to acquire lock for session ${sessionId}:`, lockError);
      return;
    }

    // Build Dropbox path with human-readable filename
    const filename = sanitizeFilename(session?.title || "Recording", sessionId);
    const dropboxPath = `${RECORDINGS_PATH}/${filename}.webm`;

    // Get file size - prefer stored value, fall back to estimating
    const fileSize = asset.file_size_bytes || 0;
    if (!fileSize || fileSize < 1024) {
      console.error(`[DropboxSync] Invalid file size: ${fileSize} bytes`);
      await updateSyncStatus(supabase, sessionId, "failed", `Invalid file size: ${fileSize} bytes`);
      return;
    }

    // Get a signed URL for streaming upload
    console.log(`[DropboxSync] Getting signed URL for: ${asset.storage_path}`);
    const { signedUrl, error: signedUrlError } = await getSignedUrl(supabase, asset.storage_path);
    
    if (!signedUrl) {
      console.error(`[DropboxSync] Failed to get signed URL:`, signedUrlError);
      await updateSyncStatus(supabase, sessionId, "failed", signedUrlError || "Failed to get signed URL");
      return;
    }

    console.log(`[DropboxSync] Streaming ${fileSize} bytes to Dropbox: ${dropboxPath}`);

    // Upload to Dropbox using streaming (never loads full file into memory)
    // Pass existing session state for resumable uploads
    const uploadResult = await uploadToDropboxStreaming(
      tokenResult.accessToken, 
      signedUrl, 
      fileSize, 
      dropboxPath,
      supabase,
      sessionId,
      existingStatus ? {
        upload_session_id: existingStatus.upload_session_id,
        upload_offset: existingStatus.upload_offset,
        upload_session_started_at: existingStatus.upload_session_started_at,
      } : undefined
    );
    
    if (uploadResult.resumed) {
      console.log(`[DropboxSync] Upload was RESUMED from previous attempt`);
    }
    
    if (!uploadResult.success) {
      console.error(`[DropboxSync] Upload failed: ${uploadResult.error}`);
      const { retryScheduled, nextRetryAt } = await updateSyncStatus(
        supabase, 
        sessionId, 
        "failed", 
        uploadResult.error || "Upload failed",
        currentAttemptCount
      );
      if (retryScheduled && nextRetryAt) {
        console.log(`[DropboxSync] Retry scheduled for ${nextRetryAt.toISOString()}`);
      }
      return;
    }

    // CRITICAL: Verify the file actually exists in Dropbox
    const verification = await verifyDropboxUpload(tokenResult.accessToken, dropboxPath);
    
    if (!verification.verified) {
      console.error(`[DropboxSync] Post-upload verification FAILED: ${verification.error}`);
      const { retryScheduled, nextRetryAt } = await updateSyncStatus(
        supabase, 
        sessionId, 
        "failed", 
        `Verification failed: ${verification.error}`,
        currentAttemptCount
      );
      if (retryScheduled && nextRetryAt) {
        console.log(`[DropboxSync] Retry scheduled for ${nextRetryAt.toISOString()}`);
      }
      return;
    }

    // File verified! Update sync status to completed with confirmed metadata
    console.log(`[DropboxSync] Upload verified! Updating status...`);
    await supabase
      .from("dropbox_sync_status")
      .update({
        sync_status: "completed",
        dropbox_path: uploadResult.uploadResult?.path_display || dropboxPath,
        dropbox_file_id: verification.fileId || uploadResult.uploadResult?.id,
        file_size_bytes: verification.size || fileSize,
        completed_at: new Date().toISOString(),
        error_message: null,
        method_used: uploadResult.method || "streaming",
      })
      .eq("session_id", sessionId);

    // Update last_used_at for the Dropbox connection
    await supabase
      .from("connected_accounts")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("provider", "dropbox");

    console.log(`[DropboxSync] Auto-sync COMPLETED and VERIFIED for session ${sessionId} at ${dropboxPath} using ${uploadResult.method}`);

  } catch (error) {
    console.error("[DropboxSync] Auto-sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const { retryScheduled, nextRetryAt } = await updateSyncStatus(
      supabase, 
      sessionId, 
      "failed", 
      errorMessage,
      currentAttemptCount
    );
    if (retryScheduled && nextRetryAt) {
      console.log(`[DropboxSync] Retry scheduled for ${nextRetryAt.toISOString()}`);
    }
  }
}

/**
 * Helper to update sync status with retry logic for transient failures
 * Returns true if a retry was scheduled
 */
async function updateSyncStatus(
  supabase: any,
  sessionId: string,
  status: string,
  errorMessage?: string,
  attemptCount?: number
): Promise<{ retryScheduled: boolean; nextRetryAt?: Date }> {
  // If status is "failed", check if this is a transient error that should be retried
  if (status === "failed" && errorMessage && attemptCount !== undefined) {
    const currentAttempt = attemptCount || 1;
    
    // Check if error is transient and we haven't exceeded max retries
    if (isTransientError(errorMessage) && currentAttempt < MAX_RETRY_ATTEMPTS) {
      const delayMs = calculateRetryDelay(currentAttempt);
      const nextRetryAt = new Date(Date.now() + delayMs);
      
      console.log(`[DropboxSync] Transient error, scheduling retry ${currentAttempt + 1}/${MAX_RETRY_ATTEMPTS} in ${delayMs / 1000}s`);
      
      // Keep status as "pending" for retry, not "failed"
      await supabase
        .from("dropbox_sync_status")
        .update({
          sync_status: "pending",
          error_message: `Retry ${currentAttempt}/${MAX_RETRY_ATTEMPTS}: ${errorMessage}`,
          next_retry_at: nextRetryAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId);
      
      return { retryScheduled: true, nextRetryAt };
    }
  }
  
  // Normal status update (completed, or failed after max retries)
  await supabase
    .from("dropbox_sync_status")
    .update({
      sync_status: status,
      error_message: errorMessage || null,
      next_retry_at: null, // Clear retry scheduling
      updated_at: new Date().toISOString(),
      ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("session_id", sessionId);
  
  return { retryScheduled: false };
}

/**
 * Sync a video to Dropbox (manual trigger with provided token)
 * Uses streaming upload to avoid memory issues with large files
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

  // ===== IDEMPOTENCY CHECK =====
  // Check current sync status BEFORE doing anything else
  // Also fetch upload session state for resumable uploads
  const { data: existingStatus, error: statusError } = await supabase
    .from("dropbox_sync_status")
    .select("sync_status, dropbox_file_id, dropbox_path, completed_at, started_at, attempt_count, upload_session_id, upload_offset, upload_session_started_at")
    .eq("session_id", sessionId)
    .single();

  if (!statusError && existingStatus) {
    // Case 1: Already synced AND verified (has dropbox_file_id) => return immediately
    if (existingStatus.sync_status === "completed" && existingStatus.dropbox_file_id) {
      console.log(`[DropboxSync] Session ${sessionId} already synced - returning cached result`);
      return new Response(
        JSON.stringify({
          success: true,
          already_synced: true,
          method_used: "cached",
          target_path: existingStatus.dropbox_path,
          dropbox_file_id: existingStatus.dropbox_file_id,
          verified_exists: true,
          error: null,
          message: "Already synced to Dropbox",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Case 2: Currently syncing => check if it's a stale lock (>5 minutes) or active
    if (existingStatus.sync_status === "syncing" && existingStatus.started_at) {
      const startedAt = new Date(existingStatus.started_at).getTime();
      const now = Date.now();
      const elapsedMs = now - startedAt;
      const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

      // Check if we have a resumable session
      const hasResumableSession = existingStatus.upload_session_id && 
        existingStatus.upload_offset > 0 &&
        isUploadSessionValid(existingStatus.upload_session_started_at);

      if (elapsedMs < STALE_THRESHOLD_MS && !hasResumableSession) {
        // Active upload in progress - don't start another
        console.log(`[DropboxSync] Session ${sessionId} has upload in progress (started ${Math.round(elapsedMs / 1000)}s ago)`);
        return new Response(
          JSON.stringify({
            success: true,
            in_progress: true,
            method_used: null,
            target_path: null,
            dropbox_file_id: null,
            verified_exists: false,
            error: null,
            message: "Upload already in progress",
            started_seconds_ago: Math.round(elapsedMs / 1000),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (hasResumableSession) {
        // Has resumable session - allow to proceed
        console.log(`[DropboxSync] Session ${sessionId} has resumable upload (offset ${existingStatus.upload_offset}) - will resume`);
      } else {
        // Stale lock - reset to allow retry
        console.log(`[DropboxSync] Session ${sessionId} has stale lock (${Math.round(elapsedMs / 1000)}s old) - allowing retry`);
      }
    }
  }
  // ===== END IDEMPOTENCY CHECK =====

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
    .select("storage_path, storage_url, file_size_bytes")
    .eq("session_id", sessionId)
    .single();

  if (assetError || !asset) {
    console.error(`[DropboxSync] No video asset for session ${sessionId}:`, assetError);
    return new Response(JSON.stringify({ error: "No video found for session" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ===== ATOMIC LOCK: Set status to syncing with started_at timestamp =====
  // Use atomic update to claim the upload lock
  const { error: lockError } = await supabase
    .from("dropbox_sync_status")
    .upsert({
      user_id: userId,
      session_id: sessionId,
      sync_status: "syncing",
      started_at: new Date().toISOString(),
      error_message: null,
      attempt_count: (existingStatus?.attempt_count || 0) + 1,
      last_attempt_at: new Date().toISOString(),
    }, {
      onConflict: "session_id",
    });

  if (lockError) {
    console.error(`[DropboxSync] Failed to acquire lock for session ${sessionId}:`, lockError);
    return new Response(JSON.stringify({ error: "Failed to start sync" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build Dropbox path with human-readable filename
  const filename = sanitizeFilename(session?.title || "Recording", sessionId);
  const dropboxPath = `${RECORDINGS_PATH}/${filename}.webm`;

  try {
    // Get file size from asset
    const fileSize = asset.file_size_bytes || 0;
    if (!fileSize || fileSize < 1024) {
      console.error(`[DropboxSync] Invalid file size: ${fileSize} bytes`);
      throw new Error(`Invalid file size: ${fileSize} bytes`);
    }

    // Get a signed URL for streaming upload (avoids loading entire file into memory)
    console.log(`[DropboxSync] Getting signed URL for: ${asset.storage_path}`);
    const { signedUrl, error: signedUrlError } = await getSignedUrl(supabase, asset.storage_path);
    
    if (!signedUrl) {
      console.error(`[DropboxSync] Failed to get signed URL:`, signedUrlError);
      throw new Error(signedUrlError || "Failed to get signed URL");
    }

    console.log(`[DropboxSync] Streaming ${fileSize} bytes to Dropbox: ${dropboxPath}`);

    // Upload to Dropbox using streaming (never loads full file into memory)
    // Pass existing session state for resumable uploads
    const uploadResult = await uploadToDropboxStreaming(
      accessToken, 
      signedUrl, 
      fileSize, 
      dropboxPath,
      supabase,
      sessionId,
      existingStatus ? {
        upload_session_id: existingStatus.upload_session_id,
        upload_offset: existingStatus.upload_offset,
        upload_session_started_at: existingStatus.upload_session_started_at,
      } : undefined
    );
    
    if (uploadResult.resumed) {
      console.log(`[DropboxSync] Upload was RESUMED from previous attempt`);
    }
    
    if (!uploadResult.success) {
      console.error(`[DropboxSync] Upload failed: ${uploadResult.error}`);
      throw new Error(uploadResult.error || "Upload failed");
    }

    // CRITICAL: Verify the file actually exists in Dropbox
    const verification = await verifyDropboxUpload(accessToken, dropboxPath);
    
    if (!verification.verified) {
      console.error(`[DropboxSync] Post-upload verification FAILED: ${verification.error}`);
      throw new Error(`Verification failed: ${verification.error}`);
    }

    // File verified! Update sync status to completed with confirmed metadata
    console.log(`[DropboxSync] Upload verified! Updating status...`);
    await supabase
      .from("dropbox_sync_status")
      .update({
        sync_status: "completed",
        dropbox_path: uploadResult.uploadResult?.path_display || dropboxPath,
        dropbox_file_id: verification.fileId || uploadResult.uploadResult?.id,
        file_size_bytes: verification.size || fileSize,
        completed_at: new Date().toISOString(),
        error_message: null,
        method_used: uploadResult.method || "streaming",
      })
      .eq("session_id", sessionId);

    // Update last_used_at for the Dropbox connection
    await supabase
      .from("connected_accounts")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("provider", "dropbox");

    console.log(`[DropboxSync] Successfully synced and VERIFIED session ${sessionId} to ${dropboxPath} using ${uploadResult.method}`);

    return new Response(
      JSON.stringify({
        success: true,
        method_used: uploadResult.method,
        target_path: uploadResult.uploadResult?.path_display || dropboxPath,
        dropbox_file_id: verification.fileId || uploadResult.uploadResult?.id,
        dropbox_rev: verification.rev,
        size_bytes: verification.size || fileSize,
        verified_exists: true,
        error: null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[DropboxSync] Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update sync status to failed
    await supabase
      .from("dropbox_sync_status")
      .update({
        sync_status: "failed",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);

    return new Response(
      JSON.stringify({ 
        success: false,
        method_used: null,
        target_path: null,
        dropbox_file_id: null,
        dropbox_rev: null,
        size_bytes: null,
        verified_exists: false,
        error: errorMessage,
      }),
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

/**
 * List files in the Dropbox Recordings folder
 * Provides ground truth for debugging sync issues
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleListRecordings(userId: string, supabase: any): Promise<Response> {
  console.log(`[DropboxSync] Listing recordings for user ${userId}`);

  // Get valid access token
  const tokenResult = await getValidAccessToken(userId, supabase);
  if (!tokenResult.accessToken) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: tokenResult.error || "No valid token",
        files: [],
        folder_reachable: false,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // List the Recordings folder
    const listResponse = await fetch(DROPBOX_LIST_FOLDER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: RECORDINGS_PATH,
        recursive: false,
        include_deleted: false,
        include_media_info: false,
      }),
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error("[DropboxSync] List folder failed:", errorText);
      
      // Check if it's a "path not found" error (folder doesn't exist yet)
      if (listResponse.status === 409 && errorText.includes("path/not_found")) {
        return new Response(
          JSON.stringify({ 
            success: true,
            folder_reachable: false,
            folder_exists: false,
            files: [],
            message: "Recordings folder does not exist yet. It will be created on first sync.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to list folder: ${listResponse.status}`,
          folder_reachable: false,
          files: [],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const listData = await listResponse.json();
    const entries = listData.entries || [];

    // Filter to only files (not folders) and extract relevant info
    const files = entries
      .filter((entry: any) => entry[".tag"] === "file")
      .map((file: any) => ({
        name: file.name,
        path: file.path_display,
        size_bytes: file.size,
        modified: file.client_modified || file.server_modified,
        id: file.id,
        rev: file.rev,
      }))
      .sort((a: any, b: any) => {
        // Sort by modified date, newest first
        return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      });

    console.log(`[DropboxSync] Found ${files.length} files in Recordings folder`);

    return new Response(
      JSON.stringify({ 
        success: true,
        folder_reachable: true,
        folder_exists: true,
        folder_path: RECORDINGS_PATH,
        file_count: files.length,
        files,
        message: files.length === 0 
          ? "Dropbox folder reachable but empty" 
          : `Found ${files.length} recording(s)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[DropboxSync] List recordings error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Network error",
        folder_reachable: false,
        files: [],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
