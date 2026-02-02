/**
 * Reel Hooks
 * 
 * React Query hooks for managing Reel entities.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Reel, 
  CreateReelInput,
  createReel, 
  getReel, 
  getReelsForSession,
  getUserReels,
  updateReel, 
  deleteReel,
  startReelRender,
} from "@/lib/reels";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Fetch a single reel by ID
 */
export function useReel(reelId: string | undefined) {
  return useQuery({
    queryKey: ["reel", reelId],
    queryFn: () => getReel(reelId!),
    enabled: !!reelId,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Fetch all reels for a session
 */
export function useSessionReels(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["reels", "session", sessionId],
    queryFn: () => getReelsForSession(sessionId!),
    enabled: !!sessionId,
    staleTime: 30_000,
  });
}

/**
 * Fetch all reels for current user
 */
export function useUserReels() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["reels", "user", user?.id],
    queryFn: getUserReels,
    enabled: !!user,
    staleTime: 30_000,
  });
}

/**
 * Create a new reel
 */
export function useCreateReel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReelInput) => createReel(input),
    onSuccess: (reel) => {
      // Invalidate user reels list
      queryClient.invalidateQueries({ queryKey: ["reels", "user"] });
      // Invalidate session reels if applicable
      if (reel.session_id) {
        queryClient.invalidateQueries({ 
          queryKey: ["reels", "session", reel.session_id] 
        });
      }
    },
  });
}

/**
 * Update a reel
 */
export function useUpdateReel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      reelId, 
      updates 
    }: { 
      reelId: string; 
      updates: Partial<Pick<Reel, "title" | "aspect_ratio" | "source_moment_ids" | "status">> 
    }) => updateReel(reelId, updates),
    onSuccess: (reel) => {
      // Update the specific reel in cache
      queryClient.setQueryData(["reel", reel.id], reel);
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: ["reels"] });
    },
  });
}

/**
 * Delete a reel
 */
export function useDeleteReel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reelId: string) => deleteReel(reelId),
    onSuccess: (_, reelId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: ["reel", reelId] });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: ["reels"] });
    },
  });
}

/**
 * Start rendering a reel
 */
export function useStartReelRender() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reelId: string) => startReelRender(reelId),
    onSuccess: (reel) => {
      queryClient.setQueryData(["reel", reel.id], reel);
    },
  });
}
