/**
 * Production-safe Logger
 * 
 * Provides logging utilities that are stripped in production builds.
 * Uses import.meta.env.DEV for tree-shaking.
 */

const IS_DEV = import.meta.env.DEV;

/**
 * Log only in development mode
 */
export function devLog(message: string, ...args: unknown[]): void {
  if (IS_DEV) {
    console.log(message, ...args);
  }
}

/**
 * Warn only in development mode
 */
export function devWarn(message: string, ...args: unknown[]): void {
  if (IS_DEV) {
    console.warn(message, ...args);
  }
}

/**
 * Debug only in development mode
 */
export function devDebug(message: string, ...args: unknown[]): void {
  if (IS_DEV) {
    console.debug(message, ...args);
  }
}

/**
 * Error logging (always logs, but with extra context in dev)
 */
export function logError(message: string, error?: unknown): void {
  if (IS_DEV) {
    console.error(message, error);
  } else {
    // In production, log minimal info
    console.error(message);
  }
}

/**
 * Performance log - only in dev
 */
export function perfLog(category: string, duration: number, extra?: Record<string, unknown>): void {
  if (IS_DEV && duration > 50) {
    console.log(`[Perf] ${category}: ${duration.toFixed(2)}ms`, extra || "");
  }
}

/**
 * Conditional execution wrapper - runs callback only in dev
 */
export function devOnly(callback: () => void): void {
  if (IS_DEV) {
    callback();
  }
}
