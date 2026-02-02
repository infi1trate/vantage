/**
 * React Query hooks for Effect Events (VFX/SFX)
 * 
 * Provides caching, optimistic updates, and real-time sync
 * for timeline effect management.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  EffectEvent,
  EffectType,
  EffectIntensity,
  ApplyScope,
  SnapSource,
  VFX_CATALOG,
  SFX_CATALOG,
  getSessionEffectEvents,
  getEffectEventsInRange,
  createEffectEvent,
  updateEffectEvent,
  deleteEffectEvent,
  toggleEffectEnabled,
  duplicateEffectEvent,
  batchCreateEffects,
  clearSessionEffects,
  getEffectsForExport,
  hasSessionEffects,
  getDefaultDuration,
  getDefaultIntensity,
  getDefaultVolume,
} from "@/lib/effectEvents";

// Query keys
export const effectEventKeys = {
  all: ["effectEvents"] as const,
  session: (sessionId: string) => [...effectEventKeys.all, "session", sessionId] as const,
  range: (sessionId: string, startMs: number, endMs: number) => 
    [...effectEventKeys.session(sessionId), "range", startMs, endMs] as const,
  export: (sessionId: string) => [...effectEventKeys.session(sessionId), "export"] as const,
  hasEffects: (sessionId: string) => [...effectEventKeys.session(sessionId), "hasEffects"] as const,
};

/**
 * Hook to fetch all effect events for a session
 */
export function useSessionEffectEvents(sessionId: string | undefined) {
  return useQuery({
    queryKey: effectEventKeys.session(sessionId || ""),
    queryFn: () => getSessionEffectEvents(sessionId!),
    enabled: !!sessionId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch effect events in a specific time range
 */
export function useEffectEventsInRange(
  sessionId: string | undefined,
  startMs: number,
  endMs: number
) {
  return useQuery({
    queryKey: effectEventKeys.range(sessionId || "", startMs, endMs),
    queryFn: () => getEffectEventsInRange(sessionId!, startMs, endMs),
    enabled: !!sessionId && startMs < endMs,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to get effects grouped for export
 */
export function useEffectsForExport(sessionId: string | undefined) {
  return useQuery({
    queryKey: effectEventKeys.export(sessionId || ""),
    queryFn: () => getEffectsForExport(sessionId!),
    enabled: !!sessionId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to check if session has any effects
 */
export function useHasSessionEffects(sessionId: string | undefined) {
  return useQuery({
    queryKey: effectEventKeys.hasEffects(sessionId || ""),
    queryFn: () => hasSessionEffects(sessionId!),
    enabled: !!sessionId,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to create an effect event
 */
export function useCreateEffectEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (options: {
      sessionId: string;
      type: EffectType;
      key: string;
      startTimeMs: number;
      durationMs?: number;
      intensity?: EffectIntensity;
      volume?: number;
      params?: Record<string, unknown>;
      applyScope?: ApplyScope;
      clipId?: string;
      reelId?: string;
      snapSource?: SnapSource;
      snappedToId?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      return createEffectEvent(user.id, options.sessionId, options);
    },
    onSuccess: (data, variables) => {
      if (data) {
        queryClient.invalidateQueries({ 
          queryKey: effectEventKeys.session(variables.sessionId) 
        });
      }
    },
  });
}

/**
 * Hook to update an effect event
 */
export function useUpdateEffectEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      sessionId,
      updates 
    }: { 
      eventId: string;
      sessionId: string;
      updates: Partial<EffectEvent>;
    }) => {
      return updateEffectEvent(eventId, updates);
    },
    onMutate: async ({ eventId, sessionId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: effectEventKeys.session(sessionId) 
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<EffectEvent[]>(
        effectEventKeys.session(sessionId)
      );

      // Optimistically update
      if (previous) {
        queryClient.setQueryData(
          effectEventKeys.session(sessionId),
          previous.map((e) => 
            e.id === eventId 
              ? { ...e, ...updates, updated_at: new Date().toISOString() }
              : e
          )
        );
      }

      return { previous };
    },
    onError: (err, { sessionId }, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          effectEventKeys.session(sessionId),
          context.previous
        );
      }
    },
    onSettled: (data, error, { sessionId }) => {
      queryClient.invalidateQueries({ 
        queryKey: effectEventKeys.session(sessionId) 
      });
    },
  });
}

/**
 * Hook to delete an effect event
 */
export function useDeleteEffectEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, sessionId }: { eventId: string; sessionId: string }) => {
      const success = await deleteEffectEvent(eventId);
      if (!success) throw new Error("Failed to delete effect");
      return eventId;
    },
    onMutate: async ({ eventId, sessionId }) => {
      await queryClient.cancelQueries({ 
        queryKey: effectEventKeys.session(sessionId) 
      });

      const previous = queryClient.getQueryData<EffectEvent[]>(
        effectEventKeys.session(sessionId)
      );

      if (previous) {
        queryClient.setQueryData(
          effectEventKeys.session(sessionId),
          previous.filter((e) => e.id !== eventId)
        );
      }

      return { previous };
    },
    onError: (err, { sessionId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          effectEventKeys.session(sessionId),
          context.previous
        );
      }
    },
    onSettled: (data, error, { sessionId }) => {
      queryClient.invalidateQueries({ 
        queryKey: effectEventKeys.session(sessionId) 
      });
    },
  });
}

/**
 * Hook to toggle effect enabled state
 */
export function useToggleEffectEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      sessionId, 
      enabled 
    }: { 
      eventId: string; 
      sessionId: string;
      enabled: boolean;
    }) => {
      const success = await toggleEffectEnabled(eventId, enabled);
      if (!success) throw new Error("Failed to toggle effect");
      return { eventId, enabled };
    },
    onMutate: async ({ eventId, sessionId, enabled }) => {
      await queryClient.cancelQueries({ 
        queryKey: effectEventKeys.session(sessionId) 
      });

      const previous = queryClient.getQueryData<EffectEvent[]>(
        effectEventKeys.session(sessionId)
      );

      if (previous) {
        queryClient.setQueryData(
          effectEventKeys.session(sessionId),
          previous.map((e) => 
            e.id === eventId ? { ...e, is_enabled: enabled } : e
          )
        );
      }

      return { previous };
    },
    onError: (err, { sessionId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          effectEventKeys.session(sessionId),
          context.previous
        );
      }
    },
  });
}

/**
 * Hook to duplicate an effect event
 */
export function useDuplicateEffectEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      sessionId,
      newStartTimeMs 
    }: { 
      eventId: string;
      sessionId: string;
      newStartTimeMs: number;
    }) => {
      return duplicateEffectEvent(eventId, newStartTimeMs);
    },
    onSuccess: (data, { sessionId }) => {
      if (data) {
        queryClient.invalidateQueries({ 
          queryKey: effectEventKeys.session(sessionId) 
        });
      }
    },
  });
}

/**
 * Hook to batch create effects (for reel packages)
 */
export function useBatchCreateEffects() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      sessionId, 
      effects 
    }: { 
      sessionId: string;
      effects: Array<{
        type: EffectType;
        key: string;
        startTimeMs: number;
        durationMs?: number;
        intensity?: EffectIntensity;
        volume?: number;
        snapSource?: SnapSource;
        snappedToId?: string;
      }>;
    }) => {
      if (!user) throw new Error("Not authenticated");
      return batchCreateEffects(user.id, sessionId, effects);
    },
    onSuccess: (data, { sessionId }) => {
      if (data.length > 0) {
        queryClient.invalidateQueries({ 
          queryKey: effectEventKeys.session(sessionId) 
        });
      }
    },
  });
}

/**
 * Hook to clear all effects from a session
 */
export function useClearSessionEffects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const success = await clearSessionEffects(sessionId);
      if (!success) throw new Error("Failed to clear effects");
      return sessionId;
    },
    onSuccess: (sessionId) => {
      queryClient.invalidateQueries({ 
        queryKey: effectEventKeys.session(sessionId) 
      });
    },
  });
}

// Re-export types and catalogs for convenience
export {
  VFX_CATALOG,
  SFX_CATALOG,
  getDefaultDuration,
  getDefaultIntensity,
  getDefaultVolume,
} from "@/lib/effectEvents";

export type {
  EffectEvent,
  EffectType,
  EffectIntensity,
  ApplyScope,
  SnapSource,
  VFXDefinition,
  SFXDefinition,
} from "@/lib/effectEvents";
