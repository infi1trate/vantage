import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Get auth token from request
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create client with user's token for RLS
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Verify user
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Admin client for operations that need elevated permissions
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Path format: /settings-api/{action} or /settings-api/{action}/{id}
  const action = pathParts[1] || "";
  const actionId = pathParts[2] || "";

  try {
    // ===== PROFILE ENDPOINTS =====
    
    // PATCH /settings-api/me - Update display name
    if (action === "me" && req.method === "PATCH" && !actionId) {
      const body = await req.json();
      const { displayName } = body;

      const { error } = await supabaseUser
        .from("profiles")
        .update({ display_name: displayName, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /settings-api/change-email - Change email
    if (action === "change-email" && req.method === "POST") {
      const body = await req.json();
      const { newEmail, currentPassword } = body;

      if (!newEmail || !currentPassword) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify current password by attempting sign in
      const { error: verifyError } = await supabaseUser.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (verifyError) {
        return new Response(JSON.stringify({ error: "Incorrect password" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update email
      const { error: updateError } = await supabaseUser.auth.updateUser({
        email: newEmail,
      });

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, message: "Verification email sent" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /settings-api/change-password - Change password
    if (action === "change-password" && req.method === "POST") {
      const body = await req.json();
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (newPassword.length < 8) {
        return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify current password
      const { error: verifyError } = await supabaseUser.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (verifyError) {
        return new Response(JSON.stringify({ error: "Incorrect password" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update password
      const { error: updateError } = await supabaseUser.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH /settings-api/camera-defaults - Update camera defaults
    if (action === "camera-defaults" && req.method === "PATCH") {
      const body = await req.json();
      const { cameraDeviceId, mirror, resolution, fps } = body;

      // Upsert user preferences
      const { error } = await supabaseUser
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          camera_device_id: cameraDeviceId,
          camera_mirror: mirror,
          camera_resolution: resolution,
          camera_fps: fps,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== USER SEARCH ENDPOINT =====
    
    // GET /settings-api/users/search?query=
    if (action === "users" && actionId === "search" && req.method === "GET") {
      const query = url.searchParams.get("query") || "";

      if (query.length < 2) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabaseUser
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, updated_at")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq("user_id", user.id)
        .limit(6);

      if (error) throw error;

      return new Response(JSON.stringify(data || []), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== BLOCKED USERS ENDPOINTS =====
    
    // GET /settings-api/blocked
    if (action === "blocked" && req.method === "GET" && !actionId) {
      const { data, error } = await supabaseUser
        .from("blocked_users")
        .select("id, blocked_user_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for blocked users
      if (data && data.length > 0) {
        const blockedIds = data.map(b => b.blocked_user_id);
        const { data: profiles } = await supabaseUser
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", blockedIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        const enriched = data.map(b => ({
          ...b,
          profile: profileMap.get(b.blocked_user_id) || null,
        }));

        return new Response(JSON.stringify(enriched), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /settings-api/blocked - Block a user
    if (action === "blocked" && req.method === "POST" && !actionId) {
      const body = await req.json();
      const { blockedUserId } = body;

      if (!blockedUserId) {
        return new Response(JSON.stringify({ error: "Missing blockedUserId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (blockedUserId === user.id) {
        return new Response(JSON.stringify({ error: "Cannot block yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseUser
        .from("blocked_users")
        .insert({
          user_id: user.id,
          blocked_user_id: blockedUserId,
        });

      if (error) {
        if (error.code === "23505") { // Unique violation
          return new Response(JSON.stringify({ error: "User already blocked" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /settings-api/blocked/{blockedUserId}
    if (action === "blocked" && req.method === "DELETE" && actionId) {
      const { error } = await supabaseUser
        .from("blocked_users")
        .delete()
        .eq("user_id", user.id)
        .eq("blocked_user_id", actionId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== SESSIONS ENDPOINTS =====
    
    // GET /settings-api/sessions
    if (action === "sessions" && req.method === "GET" && !actionId) {
      const { data, error } = await supabaseUser
        .from("user_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("last_active_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify(data || []), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /settings-api/sessions/revoke
    if (action === "sessions" && actionId === "revoke" && req.method === "POST") {
      const body = await req.json();
      const { sessionId } = body;

      if (!sessionId) {
        return new Response(JSON.stringify({ error: "Missing sessionId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseUser
        .from("user_sessions")
        .delete()
        .eq("id", sessionId)
        .eq("user_id", user.id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== OAUTH ENDPOINTS =====
    
    // POST /settings-api/oauth/{provider}/start
    if (action === "oauth" && pathParts[3] === "start" && req.method === "POST") {
      const provider = actionId;
      
      // In production, this would initiate OAuth flow
      // For now, return a placeholder response
      return new Response(JSON.stringify({ 
        message: `OAuth flow for ${provider} not yet implemented`,
        redirectUrl: null 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /settings-api/oauth/{provider}/callback
    if (action === "oauth" && pathParts[3] === "callback" && req.method === "GET") {
      const provider = actionId;
      
      // In production, this would handle OAuth callback
      return new Response(JSON.stringify({ 
        message: `OAuth callback for ${provider} not yet implemented`
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /settings-api/oauth/{provider}
    if (action === "oauth" && req.method === "DELETE" && actionId) {
      const provider = actionId;

      const { error } = await supabaseUser
        .from("connected_accounts")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", provider);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== 404 =====
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Settings API error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
