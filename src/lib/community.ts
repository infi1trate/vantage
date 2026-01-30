/**
 * Community Posts API
 * Manages community posts, annotations, and permissions
 */

import { supabase } from "@/integrations/supabase/client";

export interface CommunityPost {
  id: string;
  session_id: string;
  author_id: string;
  title: string;
  description: string | null;
  tags: string[];
  visibility: "public" | "unlisted" | "private";
  allow_comments: boolean;
  allow_public_annotations: boolean;
  allow_public_remixes: boolean;
  thumbnail_url: string | null;
  video_url: string | null;
  duration_seconds: number;
  views_count: number;
  share_token: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  author?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface CommunityAnnotation {
  id: string;
  post_id: string;
  user_id: string;
  timestamp_seconds: number;
  content: string;
  tags: string[];
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  author?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface CreateCommunityPostParams {
  sessionId: string;
  title: string;
  description?: string;
  tags?: string[];
  visibility?: "public" | "unlisted" | "private";
  allowComments?: boolean;
  allowPublicAnnotations?: boolean;
  allowPublicRemixes?: boolean;
  thumbnailUrl?: string;
  videoUrl?: string;
  durationSeconds?: number;
}

/**
 * Create a new community post
 */
export async function createCommunityPost(
  authorId: string,
  params: CreateCommunityPostParams
): Promise<CommunityPost> {
  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      session_id: params.sessionId,
      author_id: authorId,
      title: params.title,
      description: params.description || null,
      tags: params.tags || [],
      visibility: params.visibility || "public",
      allow_comments: params.allowComments ?? true,
      allow_public_annotations: params.allowPublicAnnotations ?? false,
      allow_public_remixes: params.allowPublicRemixes ?? false,
      thumbnail_url: params.thumbnailUrl || null,
      video_url: params.videoUrl || null,
      duration_seconds: params.durationSeconds || 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CommunityPost;
}

/**
 * Get public community feed
 */
export async function getCommunityFeed(options?: {
  limit?: number;
  offset?: number;
  tags?: string[];
}): Promise<CommunityPost[]> {
  let query = supabase
    .from("community_posts")
    .select("*")
    .eq("visibility", "public")
    .order("created_at", { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options?.limit || 20) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as CommunityPost[];
}

/**
 * Get a single community post by ID
 */
export async function getCommunityPost(postId: string): Promise<CommunityPost | null> {
  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("id", postId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }
  return data as unknown as CommunityPost;
}

/**
 * Get a community post by share token
 */
export async function getCommunityPostByToken(token: string): Promise<CommunityPost | null> {
  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("share_token", token)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as unknown as CommunityPost;
}

/**
 * Get posts by author
 */
export async function getAuthorPosts(authorId: string): Promise<CommunityPost[]> {
  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as CommunityPost[];
}

/**
 * Update a community post
 */
export async function updateCommunityPost(
  postId: string,
  updates: Partial<Pick<CommunityPost, 
    "title" | "description" | "tags" | "visibility" | 
    "allow_comments" | "allow_public_annotations" | "allow_public_remixes"
  >>
): Promise<CommunityPost> {
  const { data, error } = await supabase
    .from("community_posts")
    .update(updates)
    .eq("id", postId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CommunityPost;
}

/**
 * Delete a community post
 */
export async function deleteCommunityPost(postId: string): Promise<void> {
  const { error } = await supabase
    .from("community_posts")
    .delete()
    .eq("id", postId);

  if (error) throw error;
}

/**
 * Increment view count
 */
export async function incrementViewCount(postId: string): Promise<void> {
  // Use RPC or direct update - for now just update
  const { data: post } = await supabase
    .from("community_posts")
    .select("views_count")
    .eq("id", postId)
    .single();

  if (post) {
    await supabase
      .from("community_posts")
      .update({ views_count: (post.views_count || 0) + 1 })
      .eq("id", postId);
  }
}

// ============ Community Annotations ============

/**
 * Get annotations for a community post
 */
export async function getCommunityAnnotations(postId: string): Promise<CommunityAnnotation[]> {
  const { data, error } = await supabase
    .from("community_annotations")
    .select("*")
    .eq("post_id", postId)
    .eq("is_hidden", false)
    .order("timestamp_seconds", { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as CommunityAnnotation[];
}

/**
 * Create a community annotation
 */
export async function createCommunityAnnotation(
  postId: string,
  userId: string,
  timestampSeconds: number,
  content: string,
  tags?: string[]
): Promise<CommunityAnnotation> {
  const { data, error } = await supabase
    .from("community_annotations")
    .insert({
      post_id: postId,
      user_id: userId,
      timestamp_seconds: timestampSeconds,
      content,
      tags: tags || [],
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CommunityAnnotation;
}

/**
 * Hide/unhide an annotation (for moderation by post author)
 */
export async function toggleAnnotationVisibility(
  annotationId: string,
  isHidden: boolean
): Promise<void> {
  const { error } = await supabase
    .from("community_annotations")
    .update({ is_hidden: isHidden })
    .eq("id", annotationId);

  if (error) throw error;
}

/**
 * Delete an annotation
 */
export async function deleteCommunityAnnotation(annotationId: string): Promise<void> {
  const { error } = await supabase
    .from("community_annotations")
    .delete()
    .eq("id", annotationId);

  if (error) throw error;
}

// ============ Community Comments ============

/**
 * Get comments for a community post
 */
export async function getCommunityComments(postId: string) {
  const { data, error } = await supabase
    .from("social_comments")
    .select("*")
    .eq("post_id", postId)
    .is("parent_id", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Create a comment on a community post
 */
export async function createCommunityComment(
  postId: string,
  userId: string,
  content: string,
  timestampSeconds?: number,
  parentId?: string
) {
  const { data, error } = await supabase
    .from("social_comments")
    .insert({
      post_id: postId,
      session_id: "00000000-0000-0000-0000-000000000000", // Dummy session ID for post comments
      user_id: userId,
      content,
      timestamp_seconds: timestampSeconds,
      parent_id: parentId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Generate shareable link for a post
 */
export function getShareableLink(post: CommunityPost): string {
  if (post.visibility === "public") {
    return `${window.location.origin}/community/${post.id}`;
  }
  // For unlisted, use share token
  return `${window.location.origin}/community/p/${post.share_token}`;
}
