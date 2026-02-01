import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";

export default function ExtensionAuth() {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Starting extension connect…");

  useEffect(() => {
    (async () => {
      try {
        // 1) Parse redirect_uri + state from URL
        const url = new URL(window.location.href);
        const redirectUri = url.searchParams.get("redirect_uri");
        const state = url.searchParams.get("state") || "";

        if (!redirectUri) {
          setStatus("error");
          setMessage("Missing redirect_uri. The extension must open /extension-auth with redirect_uri.");
          return;
        }

        // 2) Get current user session from Supabase
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;

        if (!accessToken) {
          setStatus("redirecting");
          setMessage("Not logged in. Redirecting to sign in…");
          const returnTo = encodeURIComponent(`/extension-auth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`);
          window.location.href = `/auth?returnTo=${returnTo}`;
          return;
        }

        setStatus("authed");
        setMessage("You're logged in. Generating one-time code…");

        // 3) Call edge function to generate one-time connect code
        const fnUrl = "http://localhost:54321/functions/v1/extension-create-code"; // local supabase
        const res = await fetch(fnUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
          setStatus("error");
          setMessage("Failed to create connect code.");
          return;
        }

        const { code } = await res.json();

        // 4) Redirect back to extension redirect URI with code+state
        const next = new URL(redirectUri);
        next.searchParams.set("code", code);
        if (state) next.searchParams.set("state", state);

        setStatus("redirecting");
        setMessage("Sending code to extension…");
        window.location.href = next.toString();
      } catch (e) {
        setStatus("error");
        setMessage("Unexpected error in extension connect.");
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#e8f0ff", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 720, border: "1px solid rgba(255,255,255,0.18)", borderRadius: 16, padding: 20, background: "rgba(255,255,255,0.04)" }}>
        <h1 style={{ fontSize: 28, margin: "0 0 12px 0" }}>Connect Vantage Extension</h1>
        <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Status: {status}</div>
          <div style={{ opacity: 0.9 }}>{message}</div>
        </div>
      </div>
    </div>
  );
}