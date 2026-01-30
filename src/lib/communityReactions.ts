/**
 * Community Reactions API
 * Manages timeline-anchored emoji reactions for community posts
 */

import { supabase } from "@/integrations/supabase/client";

export interface CommunityReaction {
  id: string;
  post_id: string;
  user_id: string;
  timestamp_seconds: number;
  reaction_type: string;
  created_at: string;
}

export interface ReactionCluster {
  timestamp_seconds: number;
  reactions: { emoji: string; count: number }[];
  total: number;
}

// Curated emoji set for reactions
export const REACTION_EMOJIS = ["👍", "😂", "🔥", "😮", "😬", "💀", "👀"] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

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
  return (data || []) as CommunityReaction[];
}

/**
 * Add a reaction to a community post at a specific timestamp
 */
export async function addCommunityReaction(
  postId: string,
  userId: string,
  timestampSeconds: number,
  reactionType: ReactionEmoji
): Promise<CommunityReaction> {
  const { data, error } = await supabase
    .from("community_reactions")
    .insert({
      post_id: postId,
      user_id: userId,
      timestamp_seconds: timestampSeconds,
      reaction_type: reactionType,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CommunityReaction;
}

/**
 * Remove a user's reaction
 */
export async function removeCommunityReaction(reactionId: string): Promise<void> {
  const { error } = await supabase
    .from("community_reactions")
    .delete()
    .eq("id", reactionId);

  if (error) throw error;
}

/**
 * Cluster reactions by timestamp for timeline visualization
 * Groups reactions within a small time window (e.g., 2 seconds)
 */
export function clusterReactions(
  reactions: CommunityReaction[],
  windowSeconds: number = 2
): ReactionCluster[] {
  if (reactions.length === 0) return [];

  const clusters: ReactionCluster[] = [];
  let currentCluster: CommunityReaction[] = [];
  let clusterStart = reactions[0].timestamp_seconds;

  for (const reaction of reactions) {
    if (reaction.timestamp_seconds - clusterStart <= windowSeconds) {
      currentCluster.push(reaction);
    } else {
      if (currentCluster.length > 0) {
        clusters.push(buildCluster(currentCluster));
      }
      currentCluster = [reaction];
      clusterStart = reaction.timestamp_seconds;
    }
  }

  if (currentCluster.length > 0) {
    clusters.push(buildCluster(currentCluster));
  }

  return clusters;
}

function buildCluster(reactions: CommunityReaction[]): ReactionCluster {
  const avgTimestamp = reactions.reduce((sum, r) => sum + r.timestamp_seconds, 0) / reactions.length;
  
  const emojiCounts: Record<string, number> = {};
  for (const r of reactions) {
    emojiCounts[r.reaction_type] = (emojiCounts[r.reaction_type] || 0) + 1;
  }

  const reactionList = Object.entries(emojiCounts)
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count);

  return {
    timestamp_seconds: avgTimestamp,
    reactions: reactionList,
    total: reactions.length,
  };
}

/**
 * Get reaction density map for highlighting intense moments
 */
export function getReactionDensity(
  reactions: CommunityReaction[],
  duration: number,
  bucketSize: number = 5
): number[] {
  const buckets = Math.ceil(duration / bucketSize);
  const density = new Array(buckets).fill(0);

  for (const r of reactions) {
    const bucket = Math.min(Math.floor(r.timestamp_seconds / bucketSize), buckets - 1);
    density[bucket]++;
  }

  const maxDensity = Math.max(...density, 1);
  return density.map(d => d / maxDensity);
}
