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
};

// Stale time constants (in milliseconds)
const STALE_TIMES = {
  list: 2 * 60 * 1000,      // 2 minutes for session lists
  detail: 5 * 60 * 1000,    // 5 minutes for session details
  assets: 5 * 60 * 1000,    // 5 minutes for assets (rarely change)
  annotations: 30 * 1000,   // 30 seconds for annotations (may be actively edited)
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
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  };
}
