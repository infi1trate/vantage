/**
 * Desktop Deep Link Helper
 * 
 * Attempts to open the Vantage desktop app via custom protocol.
 * If the app doesn't respond (page stays visible), assumes failure.
 */

const DEEP_LINK_URL = "vantage://capture";
const VISIBILITY_TIMEOUT_MS = 1500;

export type DeepLinkResult = "opened" | "failed";

/**
 * Analytics events for capture CTA flow.
 * Logged via console in dev; extend with real analytics later.
 */
function trackEvent(event: string, meta?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.log(`[Analytics] ${event}`, meta ?? "");
  }
  // Future: send to analytics endpoint
}

/**
 * Attempt to open the Vantage desktop app via deep link.
 * Returns a promise that resolves to "opened" if the page was backgrounded,
 * or "failed" if the page remained visible after the timeout.
 */
export function openVantageApp(): Promise<DeepLinkResult> {
  trackEvent("capture_deeplink_attempted");

  return new Promise((resolve) => {
    const start = Date.now();
    let resolved = false;

    const onVisibilityChange = () => {
      if (document.hidden && !resolved) {
        resolved = true;
        cleanup();
        resolve("opened");
      }
    };

    const onBlur = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve("opened");
      }
    };

    const cleanup = () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);

    // Attempt the deep link
    window.location.href = DEEP_LINK_URL;

    // If still visible after timeout, assume app not installed
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        const elapsed = Date.now() - start;
        trackEvent("capture_deeplink_failed_redirect_download", { elapsed });
        resolve("failed");
      }
    }, VISIBILITY_TIMEOUT_MS);
  });
}

/**
 * Track the initial CTA click.
 */
export function trackCaptureCTAClick() {
  trackEvent("capture_cta_clicked");
}
