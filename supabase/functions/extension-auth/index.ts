/**
 * Extension Auth API
 * 
 * Handles auth code exchange for Chrome extension:
 * - POST /exchange: Exchange one-time code for tokens
 * 
 * CORS: Only allows chrome-extension:// origins
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Extension CORS Configuration
 * 
 * Configurable allowlist of extension IDs. Set to empty array to allow all chrome-extension:// origins.
 * To restrict to specific extensions, add their IDs:
 * const ALLOWED_EXTENSION_IDS = ["abcdefghijklmnop", "qrstuvwxyz123456"];
 */
const ALLOWED_EXTENSION_IDS: string[] = [];

// Rate limiting: track requests per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // max 10 requests per minute per IP

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
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  
  // Only set Allow-Origin for valid extension origins
  if (isAllowedExtensionOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin!;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  
  return headers;
}

/**
 * Check rate limit for an IP
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
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
    console.warn(`[extension-auth] Rejected origin: ${origin}`);
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

  // Rate limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                   req.headers.get("cf-connecting-ip") || 
                   "unknown";
  
  if (!checkRateLimit(clientIp)) {
    console.warn(`[extension-auth] Rate limited IP: ${clientIp}`);
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin: AnySupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { code, deviceId } = body;

    if (!code || typeof code !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[extension-auth] Exchange request for code: ${code.substring(0, 8)}...`);

    // Find the auth code
    const { data: authCode, error: fetchError } = await supabaseAdmin
      .from("extension_auth_codes")
      .select("*")
      .eq("code", code)
      .single();

    if (fetchError || !authCode) {
      console.warn(`[extension-auth] Code not found: ${code.substring(0, 8)}...`);
      return new Response(
        JSON.stringify({ error: "Invalid or expired code" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already used
    if (authCode.used_at) {
      console.warn(`[extension-auth] Code already used: ${code.substring(0, 8)}...`);
      return new Response(
        JSON.stringify({ error: "Code has already been used" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (new Date(authCode.expires_at) < new Date()) {
      console.warn(`[extension-auth] Code expired: ${code.substring(0, 8)}...`);
      return new Response(
        JSON.stringify({ error: "Code has expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark code as used immediately (before generating tokens)
    const { error: updateError } = await supabaseAdmin
      .from("extension_auth_codes")
      .update({ 
        used_at: new Date().toISOString(),
        device_id: deviceId || null,
      })
      .eq("id", authCode.id);

    if (updateError) {
      console.error(`[extension-auth] Failed to mark code as used:`, updateError);
      return new Response(
        JSON.stringify({ error: "Failed to process code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user info
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(authCode.user_id);

    if (userError || !userData?.user) {
      console.error(`[extension-auth] Failed to get user:`, userError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = userData.user;

    // Generate new session tokens for the extension
    // Using admin API to create a session
    const accessTokenTtl = 15 * 60; // 15 minutes
    const refreshTokenTtl = 30 * 24 * 60 * 60; // 30 days

    // Get user's current session or create magic link style token
    // For extension auth, we'll use the existing Supabase session mechanism
    // by generating a short-lived access token

    // Get profile info if available
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, avatar_url, username")
      .eq("user_id", user.id)
      .single();

    console.log(`[extension-auth] Successfully exchanged code for user: ${user.id}`);

    // Return user info - the extension should use this to establish its own session
    // Note: For production, you'd want to implement proper JWT generation
    // For now, we return user info that the extension can use with Supabase auth
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: profile?.display_name || user.user_metadata?.full_name || null,
          avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url || null,
          username: profile?.username || null,
        },
        // The extension should use Supabase's signInWithPassword or other auth methods
        // with these user details to establish a proper session
        expiresInSeconds: accessTokenTtl,
        message: "Use these credentials with Supabase auth to establish a session",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[extension-auth] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
