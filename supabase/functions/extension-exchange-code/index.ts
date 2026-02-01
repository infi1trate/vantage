import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const { code } = await req.json().catch(() => ({ code: null }));
    if (!code) return new Response("Missing code", { status: 400 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const secret = Deno.env.get("EXTENSION_JWT_SECRET")!; // you must set this

    const supabase = createClient(supabaseUrl, serviceKey);

    // Look up code
    const { data, error } = await supabase
      .from("extension_connect_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (error || !data) return new Response("Invalid code", { status: 400 });

    if (data.used_at) return new Response("Code already used", { status: 400 });

    const now = new Date();
    if (new Date(data.expires_at) < now) return new Response("Code expired", { status: 400 });

    // mark used
    await supabase
      .from("extension_connect_codes")
      .update({ used_at: now.toISOString() })
      .eq("code", code);

    // Mint a simple JWT for extension API calls (valid 24h)
    const payload = {
      sub: data.user_id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      aud: "vantage_extension",
    };

    // Minimal JWT signing without libraries:
    const enc = (obj: any) => btoa(JSON.stringify(obj)).replace(/=+$/g, "");
    const header = enc({ alg: "HS256", typ: "JWT" });
    const body = enc(payload);

    const toSign = `${header}.${body}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(toSign));
    const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/=+$/g, "");

    const accessToken = `${toSign}.${sig}`;

    return new Response(JSON.stringify({ accessToken, userId: data.user_id, expiresInSeconds: 86400 }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response("Server error", { status: 500 });
  }
});