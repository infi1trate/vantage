/**
 * Video Retry Hook
 * 
 * Provides automatic retry logic for transient video playback errors.
 * Implements exponential backoff and distinguishes between recoverable
 * and permanent errors.
 */

import { useState, useCallback, useRef, useEffect } from "react";

export interface VideoRetryState {
  /** Current attempt number (1-indexed, 0 means no attempts yet) */
  attempt: number;
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Whether currently retrying */
  isRetrying: boolean;
  /** Whether all retries exhausted */
  exhausted: boolean;
  /** Last error encountered */
  lastError: MediaError | null;
}

export interface UseVideoRetryOptions {
  /** Maximum retry attempts (default: 3) */
  maxAttempts?: number;
  /** Base delay in ms for exponential backoff (default: 500) */
  baseDelay?: number;
  /** Called when a retry attempt starts */
  onRetry?: (attempt: number) => void;
  /** Called when all retries are exhausted */
  onExhausted?: (lastError: MediaError | null) => void;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY = 500;

// MediaError codes as constants (to avoid type issues)
const MEDIA_ERR_ABORTED = 1;
const MEDIA_ERR_NETWORK = 2;
const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

// Error types that are potentially recoverable
const RECOVERABLE_ERROR_CODES = [
  MEDIA_ERR_NETWORK,    // Network issues - often transient
  MEDIA_ERR_ABORTED,    // Aborted - might work on retry
];

// Error types that are permanent (no point retrying)
const PERMANENT_ERROR_CODES = [
  MEDIA_ERR_DECODE,           // Codec not supported
  MEDIA_ERR_SRC_NOT_SUPPORTED, // Format not supported
];

export function isRecoverableError(error: MediaError | null): boolean {
  if (!error) return false;
  return RECOVERABLE_ERROR_CODES.includes(error.code);
}

export function isPermanentError(error: MediaError | null): boolean {
  if (!error) return false;
  return PERMANENT_ERROR_CODES.includes(error.code);
}

export function useVideoRetry(
  videoUrl: string | null | undefined,
  options: UseVideoRetryOptions = {}
): {
  state: VideoRetryState;
  handleError: (error: MediaError | null) => boolean;
  reset: () => void;
  forceRetry: () => void;
  /** Key to force video element remount */
  videoKey: number;
} {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelay = DEFAULT_BASE_DELAY,
    onRetry,
    onExhausted,
  } = options;

  const [state, setState] = useState<VideoRetryState>({
    attempt: 0,
    maxAttempts,
    isRetrying: false,
    exhausted: false,
    lastError: null,
  });

  // Key to force video element remount for retry
  const [videoKey, setVideoKey] = useState(0);

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Reset state when URL changes
  useEffect(() => {
    setState({
      attempt: 0,
      maxAttempts,
      isRetrying: false,
      exhausted: false,
      lastError: null,
    });
    setVideoKey(0);
  }, [videoUrl, maxAttempts]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const scheduleRetry = useCallback((attempt: number, error: MediaError | null) => {
    // Calculate delay with exponential backoff + jitter
    const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 200;
    
    if (import.meta.env.DEV) {
      console.log(`[VideoRetry] Scheduling retry ${attempt}/${maxAttempts} in ${delay.toFixed(0)}ms`);
    }

    setState(prev => ({ ...prev, isRetrying: true, lastError: error }));

    retryTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      
      onRetry?.(attempt);
      setVideoKey(prev => prev + 1);
      
      setState(prev => ({
        ...prev,
        attempt,
        isRetrying: false,
      }));
    }, delay);
  }, [baseDelay, maxAttempts, onRetry]);

  const handleError = useCallback((error: MediaError | null): boolean => {
    if (import.meta.env.DEV) {
      console.log(`[VideoRetry] Error received:`, error?.code, error?.message);
    }

    // Permanent errors - don't retry
    if (isPermanentError(error)) {
      if (import.meta.env.DEV) {
        console.log(`[VideoRetry] Permanent error, not retrying`);
      }
      setState(prev => ({
        ...prev,
        exhausted: true,
        lastError: error,
      }));
      onExhausted?.(error);
      return false; // Indicate we're not retrying
    }

    const nextAttempt = state.attempt + 1;

    // Check if we have retries left
    if (nextAttempt <= maxAttempts && isRecoverableError(error)) {
      scheduleRetry(nextAttempt, error);
      return true; // Indicate we're retrying
    }

    // Exhausted retries
    if (import.meta.env.DEV) {
      console.log(`[VideoRetry] Retries exhausted (${state.attempt}/${maxAttempts})`);
    }
    setState(prev => ({
      ...prev,
      exhausted: true,
      lastError: error,
    }));
    onExhausted?.(error);
    return false;
  }, [state.attempt, maxAttempts, scheduleRetry, onExhausted]);

  const reset = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    setState({
      attempt: 0,
      maxAttempts,
      isRetrying: false,
      exhausted: false,
      lastError: null,
    });
    setVideoKey(0);
  }, [maxAttempts]);

  const forceRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    const nextAttempt = state.attempt + 1;
    setState(prev => ({
      ...prev,
      attempt: nextAttempt,
      exhausted: false,
      isRetrying: false,
    }));
    setVideoKey(prev => prev + 1);
    onRetry?.(nextAttempt);
  }, [state.attempt, onRetry]);

  return {
    state,
    handleError,
    reset,
    forceRetry,
    videoKey,
  };
}
