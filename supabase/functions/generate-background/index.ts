import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Background-safety constraints for prompt generation
// Each retry level adds increasingly strict constraints
const CONSTRAINT_LEVELS = [
  // Level 0: Standard constraints
  {
    prefix: "A softly lit, wide-angle",
    suffix: "environment with subtle depth and low contrast. Blurred background plate aesthetic with soft gradients and environmental textures. Absolutely no people, no faces, no human figures, no text, no logos, no readable objects, no strong focal points. Designed as a clean video call background with gentle ambient lighting and muted tones.",
  },
  // Level 1: Stricter - emphasize emptiness
  {
    prefix: "An empty, softly blurred, wide-angle",
    suffix: "scene with very soft gradients and gentle depth blur. Abstract environmental texture only. CRITICAL: Zero people, zero faces, zero text, zero logos, zero focal subjects, zero high-frequency detail in center. Ultra-soft lighting, muted colors, background plate only.",
  },
  // Level 2: Maximum strictness - abstract only
  {
    prefix: "An abstract, defocused, minimal",
    suffix: "atmospheric gradient with extremely soft environmental tones. Purely abstract shapes and colors. ABSOLUTELY NO: people, faces, figures, text, logos, objects, focal points, sharp details. Only soft color gradients and gentle lighting for video background use.",
  },
];

const MAX_RETRIES = 3;

async function generateImage(apiKey: string, prompt: string): Promise<{ imageUrl?: string; error?: string; status?: number }> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      return { error: "API error", status: response.status };
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      return { error: "No image generated" };
    }

    return { imageUrl };
  } catch (err) {
    console.error("[generate-background] Generation attempt failed:", err);
    return { error: "Generation failed" };
  }
}

function buildPrompt(userInput: string, level: number): string {
  const constraints = CONSTRAINT_LEVELS[Math.min(level, CONSTRAINT_LEVELS.length - 1)];
  return `${constraints.prefix} ${userInput.toLowerCase().trim()} ${constraints.suffix}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate JWT and extract user id
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("[generate-background] Auth error:", claimsError?.message || "Invalid token");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log("[generate-background] Authenticated user:", userId);

    const { prompt } = await req.json();
    
    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("[generate-background] User input:", prompt);

    // Try generation with increasingly strict constraints
    // Silent retries - user never sees intermediate failures
    let lastError: string | undefined;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const normalizedPrompt = buildPrompt(prompt, attempt);
      console.log(`[generate-background] Attempt ${attempt + 1}/${MAX_RETRIES}, constraint level ${attempt}`);
      console.log("[generate-background] Prompt:", normalizedPrompt);

      const result = await generateImage(LOVABLE_API_KEY, normalizedPrompt);

      // Handle rate limit and payment errors immediately (don't retry)
      if (result.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (result.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Success - return the image
      if (result.imageUrl) {
        console.log(`[generate-background] Success on attempt ${attempt + 1}`);
        return new Response(
          JSON.stringify({ imageUrl: result.imageUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Failed - silently retry with stricter constraints
      lastError = result.error;
      console.log(`[generate-background] Attempt ${attempt + 1} failed, retrying with stricter constraints...`);
    }

    // All retries exhausted
    console.error("[generate-background] All attempts failed:", lastError);
    return new Response(
      JSON.stringify({ error: "Failed to generate background. Please try a different description." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Log full error server-side with context for debugging
    console.error("[Internal] generate-background error:", {
      error: error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    // Return generic safe message to client - never expose internal error details
    return new Response(
      JSON.stringify({ error: "Request failed. Please try again later." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
