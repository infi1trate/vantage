/**
 * Extension Me API
 * 
 * Returns current user info for Chrome extension:
 * - GET /: Get current user profile
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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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
    console.warn(`[extension-me] Rejected origin: ${origin}`);
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[extension-me] Missing or invalid auth header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User client for RLS
    const supabase: AnySupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate token
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claims?.claims?.sub) {
      console.error("[extension-me] Invalid token:", claimsError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub as string;
    const email = claims.claims.email as string | undefined;

    // Get profile info
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, username")
      .eq("user_id", userId)
      .single();

    // Get user preferences
    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("record_facecam, record_microphone, record_game_audio, default_session_visibility")
      .eq("user_id", userId)
      .single();

    console.log(`[extension-me] Returned profile for user: ${userId}`);

    return new Response(
      JSON.stringify({
        id: userId,
        email: email || null,
        name: profile?.display_name || null,
        username: profile?.username || null,
        avatarUrl: profile?.avatar_url || null,
        preferences: preferences ? {
          recordFacecam: preferences.record_facecam ?? true,
          recordMicrophone: preferences.record_microphone ?? true,
          recordGameAudio: preferences.record_game_audio ?? true,
          defaultVisibility: preferences.default_session_visibility ?? "private",
        } : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[extension-me] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
