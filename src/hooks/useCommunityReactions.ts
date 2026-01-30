import { useState, useCallback, useEffect } from "react";
import {
  CommunityReaction,
  ReactionEmoji,
  getCommunityReactions,
  addCommunityReaction,
  removeCommunityReaction,
} from "@/lib/communityReactions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface UseCommunityReactionsOptions {
  postId: string;
  enabled?: boolean;
}

export function useCommunityReactions({
  postId,
  enabled = true,
}: UseCommunityReactionsOptions) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<CommunityReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load reactions
  useEffect(() => {
    if (!enabled || !postId) {
      setLoading(false);
      return;
    }

    async function loadReactions() {
      try {
        setLoading(true);
        setError(null);
        const data = await getCommunityReactions(postId);
        setReactions(data);
      } catch (err) {
        console.error("[useCommunityReactions] Load error:", err);
        setError("Failed to load reactions");
      } finally {
        setLoading(false);
      }
    }

    loadReactions();
  }, [postId, enabled]);

  // Add a reaction
  const addReaction = useCallback(
    async (emoji: ReactionEmoji, timestampSeconds: number) => {
      if (!user) {
        toast.error("Sign in to react");
        return null;
      }

      try {
        const newReaction = await addCommunityReaction(
          postId,
          user.id,
          timestampSeconds,
          emoji
        );
        setReactions((prev) =>
          [...prev, newReaction].sort(
            (a, b) => a.timestamp_seconds - b.timestamp_seconds
          )
        );
        return newReaction;
      } catch (err) {
        console.error("[useCommunityReactions] Add error:", err);
        toast.error("Failed to add reaction");
        return null;
      }
    },
    [postId, user]
  );

  // Remove a reaction
  const removeReaction = useCallback(async (reactionId: string) => {
    try {
      await removeCommunityReaction(reactionId);
      setReactions((prev) => prev.filter((r) => r.id !== reactionId));
    } catch (err) {
      console.error("[useCommunityReactions] Remove error:", err);
      toast.error("Failed to remove reaction");
    }
  }, []);

  // Get user's reactions
  const userReactions = reactions.filter((r) => r.user_id === user?.id);

  return {
    reactions,
    userReactions,
    loading,
    error,
    addReaction,
    removeReaction,
    canReact: !!user,
  };
}
