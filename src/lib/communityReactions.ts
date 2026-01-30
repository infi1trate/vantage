/**
 * Community Reactions API
 * Timeline-anchored emoji reactions for community videos
 */

import { supabase } from "@/integrations/supabase/client";

// Fixed curated emoji set
export const REACTION_EMOJIS = ["👍", "😂", "🔥", "😮", "😬", "💀", "👀"] as const;
export type ReactionType = typeof REACTION_EMOJIS[number];

export interface CommunityReaction {
  id: string;
  post_id: string;
  user_id: string;
  timestamp_seconds: number;
  reaction_type: ReactionType;
  created_at: string;
}

export interface ReactionCluster {
  timestamp_seconds: number;
  reactions: {
    type: ReactionType;
    count: number;
    userReacted: boolean;
  }[];
  totalCount: number;
}

/**
 * Get all reactions for a community post
 */
export async function getCommunityReactions(postId: string): Promise<CommunityReaction[]> {
  const { data, error } = await supabase
    .from("community_reactions")
    .select("*")
    .eq("post_id", postId)
    .order("timestamp_seconds", { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as CommunityReaction[];
}

/**
 * Get reactions clustered by timestamp (for timeline visualization)
 * Clusters reactions within 1-second windows
 */
export function clusterReactions(
  reactions: CommunityReaction[],
  currentUserId?: string,
  clusterWindowSeconds = 1
): ReactionCluster[] {
  const clusters = new Map<number, Map<ReactionType, { count: number; userReacted: boolean }>>();

  for (const reaction of reactions) {
    // Round to nearest cluster window
    const clusterKey = Math.floor(reaction.timestamp_seconds / clusterWindowSeconds) * clusterWindowSeconds;
    
    if (!clusters.has(clusterKey)) {
      clusters.set(clusterKey, new Map());
    }
    
    const clusterReactions = clusters.get(clusterKey)!;
    const reactionType = reaction.reaction_type as ReactionType;
    
    if (!clusterReactions.has(reactionType)) {
      clusterReactions.set(reactionType, { count: 0, userReacted: false });
    }
    
    const reactionData = clusterReactions.get(reactionType)!;
    reactionData.count++;
    if (reaction.user_id === currentUserId) {
      reactionData.userReacted = true;
    }
  }

  return Array.from(clusters.entries())
    .map(([timestamp_seconds, reactionsMap]) => {
      const reactions = Array.from(reactionsMap.entries())
        .map(([type, data]) => ({ type, ...data }))
        .sort((a, b) => b.count - a.count);
      
      return {
        timestamp_seconds,
        reactions,
        totalCount: reactions.reduce((sum, r) => sum + r.count, 0),
      };
    })
    .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
}

/**
 * Add a reaction to a community post
 */
export async function addReaction(
  postId: string,
  userId: string,
  timestampSeconds: number,
  reactionType: ReactionType
): Promise<CommunityReaction> {
  // Round to nearest 0.5 second for clustering
  const roundedTimestamp = Math.round(timestampSeconds * 2) / 2;

  const { data, error } = await supabase
    .from("community_reactions")
    .insert({
      post_id: postId,
      user_id: userId,
      timestamp_seconds: roundedTimestamp,
      reaction_type: reactionType,
    })
    .select()
    .single();

  if (error) {
    // If duplicate, silently fail (user already reacted with this emoji at this time)
    if (error.code === "23505") {
      throw new Error("Already reacted");
    }
    throw error;
  }
  return data as unknown as CommunityReaction;
}

/**
 * Remove a reaction
 */
export async function removeReaction(reactionId: string): Promise<void> {
  const { error } = await supabase
    .from("community_reactions")
    .delete()
    .eq("id", reactionId);

  if (error) throw error;
}

/**
 * Get user's reactions for a post
 */
export async function getUserReactions(
  postId: string,
  userId: string
): Promise<CommunityReaction[]> {
  const { data, error } = await supabase
    .from("community_reactions")
    .select("*")
    .eq("post_id", postId)
    .eq("user_id", userId);

  if (error) throw error;
  return (data || []) as unknown as CommunityReaction[];
}

/**
 * Get reaction density for timeline heatmap
 * Returns normalized density values (0-1) for visualization
 */
export function getReactionDensity(
  reactions: CommunityReaction[],
  duration: number,
  bucketCount = 100
): number[] {
  if (duration <= 0 || reactions.length === 0) {
    return Array(bucketCount).fill(0);
  }

  const bucketSize = duration / bucketCount;
  const buckets = Array(bucketCount).fill(0);

  for (const reaction of reactions) {
    const bucketIndex = Math.min(
      Math.floor(reaction.timestamp_seconds / bucketSize),
      bucketCount - 1
    );
    buckets[bucketIndex]++;
  }

  // Normalize to 0-1
  const maxCount = Math.max(...buckets, 1);
  return buckets.map((count) => count / maxCount);
}
