/**
 * Dropbox OAuth Client
 * 
 * Handles the OAuth 2.0 flow for connecting Dropbox accounts.
 * Uses a popup window for the OAuth authorization.
 */

import { supabase } from "@/integrations/supabase/client";

// OAuth state storage key
const OAUTH_STATE_KEY = "vantage_dropbox_oauth_state";

export interface DropboxOAuthResult {
  success: boolean;
  email?: string;
  accountId?: string;
  provisioned?: boolean;
  provisioningError?: string;
  error?: string;
}

/**
 * Start the Dropbox OAuth flow
 * Opens a popup window for authorization
 */
export async function startDropboxOAuth(): Promise<DropboxOAuthResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { success: false, error: "Not authenticated" };
  }

  // Get the redirect URI for OAuth callback
  const redirectUri = `${window.location.origin}/settings?dropbox_callback=true`;

  try {
    // Request OAuth start from edge function
    const response = await supabase.functions.invoke("dropbox-sync", {
      body: { redirectUri },
      headers: {
        "x-custom-path": "/oauth/start",
      },
    });

    if (response.error) {
      console.error("[DropboxOAuth] Start error:", response.error);
      return { success: false, error: response.error.message };
    }

    const { authUrl, state } = response.data;
    
    if (!authUrl) {
      return { success: false, error: "Failed to get authorization URL" };
    }

    // Store state for CSRF verification
    sessionStorage.setItem(OAUTH_STATE_KEY, state);

    // Open popup for OAuth
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      "dropbox_oauth",
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );

    if (!popup) {
      return { success: false, error: "Popup blocked. Please allow popups and try again." };
    }

    // Wait for the popup to complete
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        try {
          // Check if popup is closed
          if (popup.closed) {
            clearInterval(checkInterval);
            window.removeEventListener("message", handleMessage);
            
            // Check if we got a callback
            const pendingCallback = sessionStorage.getItem("vantage_dropbox_callback_result");
            if (pendingCallback) {
              sessionStorage.removeItem("vantage_dropbox_callback_result");
              const result = JSON.parse(pendingCallback);
              resolve(result);
            } else {
              resolve({ success: false, error: "Authorization cancelled" });
            }
          }

          // Check if popup navigated to our callback URL
          if (popup.location?.href?.includes("dropbox_callback=true")) {
            const url = new URL(popup.location.href);
            const code = url.searchParams.get("code");
            const returnedState = url.searchParams.get("state");
            const error = url.searchParams.get("error");

            popup.close();
            clearInterval(checkInterval);
            window.removeEventListener("message", handleMessage);

            if (error) {
              resolve({ success: false, error: `Dropbox error: ${error}` });
              return;
            }

            if (code && returnedState) {
              // Exchange code for tokens
              exchangeCodeForTokens(code, returnedState, redirectUri).then(resolve);
            } else {
              resolve({ success: false, error: "No authorization code received" });
            }
          }
        } catch {
          // Cross-origin error - popup is still on Dropbox domain
        }
      }, 500);

      // Also listen for postMessage in case popup sends it
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "dropbox_oauth_callback") {
          clearInterval(checkInterval);
          window.removeEventListener("message", handleMessage);
          popup.close();

          if (event.data.code) {
            exchangeCodeForTokens(
              event.data.code,
              event.data.state,
              redirectUri
            ).then(resolve);
          } else {
            resolve({ success: false, error: event.data.error || "Authorization failed" });
          }
        }
      };

      window.addEventListener("message", handleMessage);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener("message", handleMessage);
        if (!popup.closed) {
          popup.close();
        }
        resolve({ success: false, error: "Authorization timed out" });
      }, 5 * 60 * 1000);
    });
  } catch (error) {
    console.error("[DropboxOAuth] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(
  code: string,
  state: string,
  redirectUri: string
): Promise<DropboxOAuthResult> {
  // Verify state to prevent CSRF
  const storedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);

  if (state !== storedState) {
    console.error("[DropboxOAuth] State mismatch:", { state, storedState });
    return { success: false, error: "Invalid OAuth state - please try again" };
  }

  try {
    const response = await supabase.functions.invoke("dropbox-sync", {
      body: { code, redirectUri },
      headers: {
        "x-custom-path": "/oauth/callback",
      },
    });

    if (response.error) {
      console.error("[DropboxOAuth] Callback error:", response.error);
      return { success: false, error: response.error.message };
    }

    if (response.data?.success) {
      return {
        success: true,
        email: response.data.email,
        accountId: response.data.accountId,
        provisioned: response.data.provisioned,
        provisioningError: response.data.provisioningError,
      };
    }

    return { success: false, error: response.data?.error || "Token exchange failed" };
  } catch (error) {
    console.error("[DropboxOAuth] Exchange error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Handle OAuth callback (called when redirected back to app)
 * This is used when the popup redirects to our callback URL
 */
export function handleDropboxCallback(): { code?: string; state?: string; error?: string } | null {
  const url = new URL(window.location.href);
  
  if (!url.searchParams.has("dropbox_callback")) {
    return null;
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Clean up URL
  url.searchParams.delete("dropbox_callback");
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  window.history.replaceState({}, "", url.toString());

  if (error) {
    return { error };
  }

  if (code && state) {
    return { code, state };
  }

  return null;
}

/**
 * Retry provisioning for a failed Dropbox connection
 * Note: This requires a fresh access token - user may need to reconnect
 */
export async function retryDropboxProvisioning(accessToken: string): Promise<{ 
  success: boolean; 
  error?: string 
}> {
  try {
    const response = await supabase.functions.invoke("dropbox-sync", {
      body: { accessToken },
      headers: {
        "x-custom-path": "/provision/retry",
      },
    });

    if (response.error) {
      console.error("[DropboxOAuth] Retry provisioning error:", response.error);
      return { success: false, error: response.error.message };
    }

    return {
      success: response.data?.success || false,
      error: response.data?.error,
    };
  } catch (error) {
    console.error("[DropboxOAuth] Retry provisioning error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Disconnect Dropbox account
 */
export async function disconnectDropbox(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await supabase.functions.invoke("dropbox-sync", {
      method: "DELETE",
      headers: {
        "x-custom-path": "/disconnect",
      },
    });

    if (response.error) {
      console.error("[DropboxOAuth] Disconnect error:", response.error);
      return { success: false, error: response.error.message };
    }

    return { success: response.data?.success || false };
  } catch (error) {
    console.error("[DropboxOAuth] Disconnect error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
