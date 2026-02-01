import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

    const jwt = auth.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify the user from JWT using Supabase Auth
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (userErr || !user) return new Response("Unauthorized", { status: 401 });

    const code = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 min

    const { error: insertErr } = await supabase.from("extension_connect_codes").insert({
      code,
      user_id: user.id,
      expires_at: expiresAt,
      used_at: null,
    });

    if (insertErr) return new Response("DB insert failed", { status: 500 });

    return new Response(JSON.stringify({ code, expiresAt }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response("Server error", { status: 500 });
  }
});