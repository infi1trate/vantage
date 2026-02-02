/**
 * React Query hooks for Frame Overlays
 * 
 * Provides caching, optimistic updates, and real-time sync
 * for frame overlay management.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  FrameOverlay,
  FrameStyleParams,
  FrameLayoutParams,
  PRESET_FRAMES,
  getUserFrameOverlays,
  getSessionFrameOverlays,
  getFrameOverlay,
  createFrameOverlay,
  createFromPreset,
  updateFrameOverlay,
  deleteFrameOverlay,
  setSignatureFrame,
  setDefaultFrame,
  duplicateFrameOverlay,
  DEFAULT_STYLE_PARAMS,
  DEFAULT_LAYOUT_PARAMS,
} from "@/lib/frameOverlays";

// Query keys
export const frameOverlayKeys = {
  all: ["frameOverlays"] as const,
  user: (userId: string) => [...frameOverlayKeys.all, "user", userId] as const,
  session: (sessionId: string) => [...frameOverlayKeys.all, "session", sessionId] as const,
  detail: (frameId: string) => [...frameOverlayKeys.all, "detail", frameId] as const,
};

/**
 * Hook to fetch all frame overlays for the current user
 */
export function useUserFrameOverlays() {
  const { user } = useAuth();

  return useQuery({
    queryKey: frameOverlayKeys.user(user?.id || ""),
    queryFn: () => getUserFrameOverlays(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch frame overlays for a specific session
 */
export function useSessionFrameOverlays(sessionId: string | undefined) {
  return useQuery({
    queryKey: frameOverlayKeys.session(sessionId || ""),
    queryFn: () => getSessionFrameOverlays(sessionId!),
    enabled: !!sessionId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch a single frame overlay
 */
export function useFrameOverlay(frameId: string | undefined) {
  return useQuery({
    queryKey: frameOverlayKeys.detail(frameId || ""),
    queryFn: () => getFrameOverlay(frameId!),
    enabled: !!frameId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to create a frame overlay
 */
export function useCreateFrameOverlay() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (options: {
      type?: "preset" | "ai" | "custom";
      presetKey?: string;
      name?: string;
      sessionId?: string;
      styleParams?: Partial<FrameStyleParams>;
      layoutParams?: Partial<FrameLayoutParams>;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // If preset key provided, use createFromPreset
      if (options.presetKey) {
        return createFromPreset(
          user.id,
          options.presetKey,
          options.sessionId,
          options.styleParams
        );
      }

      // Otherwise create custom
      return createFrameOverlay(user.id, {
        type: options.type || "custom",
        name: options.name,
        session_id: options.sessionId,
        style_params: { ...DEFAULT_STYLE_PARAMS, ...options.styleParams },
        layout_params: { ...DEFAULT_LAYOUT_PARAMS, ...options.layoutParams },
      });
    },
    onSuccess: (data, variables) => {
      if (!user || !data) return;

      // Invalidate user frames
      queryClient.invalidateQueries({ queryKey: frameOverlayKeys.user(user.id) });

      // Invalidate session frames if applicable
      if (variables.sessionId) {
        queryClient.invalidateQueries({ 
          queryKey: frameOverlayKeys.session(variables.sessionId) 
        });
      }
    },
  });
}

/**
 * Hook to update a frame overlay
 */
export function useUpdateFrameOverlay() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      frameId, 
      updates 
    }: { 
      frameId: string; 
      updates: Partial<FrameOverlay>;
    }) => {
      return updateFrameOverlay(frameId, updates);
    },
    onMutate: async ({ frameId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: frameOverlayKeys.detail(frameId) });

      // Snapshot previous value
      const previous = queryClient.getQueryData<FrameOverlay>(
        frameOverlayKeys.detail(frameId)
      );

      // Optimistically update
      if (previous) {
        queryClient.setQueryData(frameOverlayKeys.detail(frameId), {
          ...previous,
          ...updates,
          updated_at: new Date().toISOString(),
        });
      }

      return { previous };
    },
    onError: (err, { frameId }, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(frameOverlayKeys.detail(frameId), context.previous);
      }
    },
    onSettled: (data, error, { frameId }) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: frameOverlayKeys.detail(frameId) });
      if (user) {
        queryClient.invalidateQueries({ queryKey: frameOverlayKeys.user(user.id) });
      }
    },
  });
}

/**
 * Hook to delete a frame overlay
 */
export function useDeleteFrameOverlay() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (frameId: string) => {
      const success = await deleteFrameOverlay(frameId);
      if (!success) throw new Error("Failed to delete frame");
      return frameId;
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: frameOverlayKeys.user(user.id) });
      }
    },
  });
}

/**
 * Hook to set signature frame for a session
 */
export function useSetSignatureFrame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      sessionId, 
      frameId 
    }: { 
      sessionId: string; 
      frameId: string | null;
    }) => {
      const success = await setSignatureFrame(sessionId, frameId);
      if (!success) throw new Error("Failed to set signature frame");
      return { sessionId, frameId };
    },
    onSuccess: ({ sessionId }) => {
      // Invalidate session data
      queryClient.invalidateQueries({ queryKey: ["sessions", "detail", sessionId] });
    },
  });
}

/**
 * Hook to set user's default frame
 */
export function useSetDefaultFrame() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (frameId: string | null) => {
      if (!user) throw new Error("Not authenticated");
      const success = await setDefaultFrame(user.id, frameId);
      if (!success) throw new Error("Failed to set default frame");
      return frameId;
    },
    onSuccess: () => {
      // Invalidate user preferences
      queryClient.invalidateQueries({ queryKey: ["userPreferences"] });
    },
  });
}

/**
 * Hook to duplicate a frame overlay
 */
export function useDuplicateFrameOverlay() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      frameId, 
      overrides 
    }: { 
      frameId: string; 
      overrides?: Partial<FrameOverlay>;
    }) => {
      return duplicateFrameOverlay(frameId, overrides);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: frameOverlayKeys.user(user.id) });
      }
    },
  });
}

// Re-export types and constants for convenience
export { 
  PRESET_FRAMES, 
  DEFAULT_STYLE_PARAMS, 
  DEFAULT_LAYOUT_PARAMS,
  type FrameOverlay,
  type FrameStyleParams,
  type FrameLayoutParams,
};
