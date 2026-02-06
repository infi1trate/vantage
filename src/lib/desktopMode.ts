/**
 * Desktop Mode Detection
 * 
 * Determines if the app is running in "desktop mode" (Electron tray popover).
 * This is a hard isolation - desktop mode routes are completely separate from main app.
 */

/**
 * Check if the app is currently in desktop mode.
 * Desktop mode is determined by the URL path starting with /desktop.
 * 
 * This is evaluated once at app initialization and should be treated as immutable
 * for the lifetime of the app instance.
 */
export function isDesktopMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.pathname.startsWith("/desktop");
}

/**
 * Cached desktop mode flag - evaluated once at module load.
 * Use this for conditional logic throughout the app.
 */
export const DESKTOP_MODE = isDesktopMode();

/**
 * Desktop-specific route paths
 */
export const DESKTOP_ROUTES = {
  ROOT: "/desktop",
  AUTH: "/desktop/auth",
  PREVIEW: "/desktop/preview",
} as const;

/**
 * Check if a path is a valid desktop route
 */
export function isDesktopRoute(path: string): boolean {
  return path.startsWith("/desktop");
}
