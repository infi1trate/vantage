/**
 * React Query hooks for session data with optimized caching and prefetching.
 * 
 * Cache strategy:
 * - Session list: 2 minutes stale time, background refetch
 * - Session detail: 5 minutes stale time (less frequently changes)
 * - Assets/annotations: 5 minutes stale time
 * 
 * All queries are deduplicated automatically by React Query.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCaptureSession,
  getAnnotations,
  getVoiceNotes,
  getVideoAssets,
  getAudioTracks,
  getFacecamTracks,
  getTimelineEvents,
} from "@/lib/captures";
import { getSessionsWithAssets, SessionWithAssets } from "@/lib/sessionLibrary";
import { getLocalSession, LocalSession } from "@/lib/localSessionStorage";

// Query key factories for consistent cache management
export const sessionKeys = {
  all: ["sessions"] as const,
  lists: () => [...sessionKeys.all, "list"] as const,
  list: (userId: string) => [...sessionKeys.lists(), userId] as const,
  details: () => [...sessionKeys.all, "detail"] as const,
  detail: (sessionId: string) => [...sessionKeys.details(), sessionId] as const,
  local: (sessionId: string) => [...sessionKeys.all, "local", sessionId] as const,
  annotations: (sessionId: string) => [...sessionKeys.all, "annotations", sessionId] as const,
  voiceNotes: (sessionId: string) => [...sessionKeys.all, "voiceNotes", sessionId] as const,
  videoAssets: (sessionId: string) => [...sessionKeys.all, "videoAssets", sessionId] as const,
  audioTracks: (sessionId: string) => [...sessionKeys.all, "audioTracks", sessionId] as const,
  facecamTracks: (sessionId: string) => [...sessionKeys.all, "facecamTracks", sessionId] as const,
  timelineEvents: (sessionId: string) => [...sessionKeys.all, "timelineEvents", sessionId] as const,
  // Combined session + media status query key for eligibility checks
  mediaStatus: (sessionId: string) => [...sessionKeys.all, "mediaStatus", sessionId] as const,
};

// Stale time constants (in milliseconds)
const STALE_TIMES = {
  list: 2 * 60 * 1000,      // 2 minutes for session lists
  detail: 5 * 60 * 1000,    // 5 minutes for session details
  assets: 5 * 60 * 1000,    // 5 minutes for assets (rarely change)
  annotations: 30 * 1000,   // 30 seconds for annotations (may be actively edited)
  mediaStatus: 10 * 1000,   // 10 seconds for media status (needs to be fresh for eligibility)
} as const;

/**
 * Hook to fetch cloud sessions list with caching
 */
export function useCloudSessions(userId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.list(userId || ""),
    queryFn: () => getSessionsWithAssets(userId!),
    enabled: !!userId,
    staleTime: STALE_TIMES.list,
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook to fetch session detail (cloud only)
 */
export function useSessionDetail(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.detail(sessionId || ""),
    queryFn: () => getCaptureSession(sessionId!),
    enabled: !!sessionId,
    staleTime: STALE_TIMES.detail,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch local session
 */
export function useLocalSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.local(sessionId || ""),
    queryFn: () => getLocalSession(sessionId!),
    enabled: !!sessionId,
    staleTime: STALE_TIMES.detail,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch annotations with shorter stale time
 */
export function useAnnotations(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.annotations(sessionId || ""),
    queryFn: () => getAnnotations(sessionId!),
    enabled: !!sessionId,
    staleTime: STALE_TIMES.annotations,
  });
}

/**
 * Hook to fetch voice notes
 */
export function useVoiceNotes(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.voiceNotes(sessionId || ""),
    queryFn: () => getVoiceNotes(sessionId!),
    enabled: !!sessionId,
    staleTime: STALE_TIMES.assets,
  });
}

/**
 * Hook to fetch video assets
 */
export function useVideoAssets(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.videoAssets(sessionId || ""),
    queryFn: () => getVideoAssets(sessionId!),
    enabled: !!sessionId,
    staleTime: STALE_TIMES.assets,
  });
}

/**
 * Hook to fetch audio tracks
 */
export function useAudioTracks(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.audioTracks(sessionId || ""),
    queryFn: () => getAudioTracks(sessionId!),
    enabled: !!sessionId,
    staleTime: STALE_TIMES.assets,
  });
}

/**
 * Hook to fetch facecam tracks
 */
export function useFacecamTracks(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.facecamTracks(sessionId || ""),
    queryFn: () => getFacecamTracks(sessionId!),
    enabled: !!sessionId,
    staleTime: STALE_TIMES.assets,
  });
}

/**
 * Hook to fetch timeline events
 */
export function useTimelineEvents(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.timelineEvents(sessionId || ""),
    queryFn: () => getTimelineEvents(sessionId!),
    enabled: !!sessionId,
    staleTime: STALE_TIMES.assets,
  });
}

// ==================== Session Media Status (for Reel Eligibility) ====================

import { supabase } from "@/integrations/supabase/client";
import { getReelSourceFromMetadata, ReelSource, ReelSourceStatus } from "@/lib/reelSource";

/**
 * Combined session media status - single source of truth for eligibility checks
 */
export interface SessionMediaStatus {
  sessionId: string;
  /** Whether gameplay video is present and ready */
  hasGameplayReady: boolean;
  /** Gameplay video status */
  gameplayStatus: "ready" | "processing" | "uploading" | "failed" | "missing" | null;
  /** Gameplay video URL (if ready) */
  gameplayUrl: string | null;
  /** Legacy video_url from session (fallback) */
  legacyVideoUrl: string | null;
  /** ReelSource status from metadata */
  reelSourceStatus: ReelSourceStatus | null;
  /** ReelSource data (if present) */
  reelSource: ReelSource | null;
  /** Session status */
  sessionStatus: string | null;
}

/**
 * Fetch session media status - combines session, video_assets, and ReelSource
 * This is used for reel eligibility checks
 */
async function fetchSessionMediaStatus(sessionId: string): Promise<SessionMediaStatus> {
  // Fetch session and gameplay asset in parallel
  const [sessionResult, gameplayResult] = await Promise.all([
    supabase
      .from("capture_sessions")
      .select("id, metadata, video_url, status")
      .eq("id", sessionId)
      .single(),
    supabase
      .from("video_assets")
      .select("id, storage_url, status")
      .eq("session_id", sessionId)
      .eq("asset_type", "gameplay")
      .maybeSingle(),
  ]);

  if (sessionResult.error || !sessionResult.data) {
    console.error("[SessionMediaStatus] Failed to fetch session:", sessionResult.error);
    return {
      sessionId,
      hasGameplayReady: false,
      gameplayStatus: null,
      gameplayUrl: null,
      legacyVideoUrl: null,
      reelSourceStatus: null,
      reelSource: null,
      sessionStatus: null,
    };
  }

  const session = sessionResult.data;
  const gameplayAsset = gameplayResult.data;
  
  // Extract ReelSource from metadata
  const reelSource = getReelSourceFromMetadata(
    session.metadata as Record<string, unknown>
  );

  // Determine gameplay status
  const gameplayStatus = gameplayAsset?.status as SessionMediaStatus["gameplayStatus"] || null;
  const hasGameplayReady = gameplayStatus === "ready" && !!gameplayAsset?.storage_url;

  return {
    sessionId,
    hasGameplayReady,
    gameplayStatus: gameplayAsset ? gameplayStatus : "missing",
    gameplayUrl: gameplayAsset?.storage_url || null,
    legacyVideoUrl: session.video_url,
    reelSourceStatus: reelSource?.status || null,
    reelSource,
    sessionStatus: session.status,
  };
}

/**
 * Hook to fetch session media status with short stale time
 * Used for reel eligibility checks - ensures fresh data
 */
export function useSessionMediaStatus(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.mediaStatus(sessionId || ""),
    queryFn: () => fetchSessionMediaStatus(sessionId!),
    enabled: !!sessionId,
    staleTime: STALE_TIMES.mediaStatus,
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

/**
 * Hook to get a function that refreshes session media status
 * Call this before eligibility checks to ensure fresh data
 */
export function useRefreshSessionMediaStatus() {
  const queryClient = useQueryClient();
  
  return async (sessionId: string): Promise<SessionMediaStatus> => {
    // Force refetch and wait for result
    const result = await queryClient.fetchQuery({
      queryKey: sessionKeys.mediaStatus(sessionId),
      queryFn: () => fetchSessionMediaStatus(sessionId),
      staleTime: 0, // Force fresh fetch
    });
    
    // Also invalidate video assets cache to keep them in sync
    queryClient.invalidateQueries({ queryKey: sessionKeys.videoAssets(sessionId) });
    
    return result;
  };
}

/**
 * Hook to prefetch session detail and related data on hover.
 * Returns a function that can be called onMouseEnter/onPointerEnter.
 */
export function usePrefetchSession() {
  const queryClient = useQueryClient();

  const prefetch = async (sessionId: string, isLocal: boolean = false) => {
    if (isLocal) {
      // For local sessions, prefetch local data
      await queryClient.prefetchQuery({
        queryKey: sessionKeys.local(sessionId),
        queryFn: () => getLocalSession(sessionId),
        staleTime: STALE_TIMES.detail,
      });
    } else {
      // For cloud sessions, prefetch session detail and assets in parallel
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: sessionKeys.detail(sessionId),
          queryFn: () => getCaptureSession(sessionId),
          staleTime: STALE_TIMES.detail,
        }),
        queryClient.prefetchQuery({
          queryKey: sessionKeys.annotations(sessionId),
          queryFn: () => getAnnotations(sessionId),
          staleTime: STALE_TIMES.annotations,
        }),
        queryClient.prefetchQuery({
          queryKey: sessionKeys.videoAssets(sessionId),
          queryFn: () => getVideoAssets(sessionId),
          staleTime: STALE_TIMES.assets,
        }),
      ]);
    }
  };

  return prefetch;
}

/**
 * Hook to invalidate session queries after mutations
 */
export function useInvalidateSessions() {
  const queryClient = useQueryClient();

  return {
    invalidateList: (userId: string) => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.list(userId) });
    },
    invalidateDetail: (sessionId: string) => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) });
    },
    invalidateAnnotations: (sessionId: string) => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.annotations(sessionId) });
    },
    invalidateMediaStatus: (sessionId: string) => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.mediaStatus(sessionId) });
      // Also invalidate video assets to keep in sync
      queryClient.invalidateQueries({ queryKey: sessionKeys.videoAssets(sessionId) });
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  };
}
