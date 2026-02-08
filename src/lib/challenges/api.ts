/**
 * API helper stubs for Challenges feature.
 * 
 * These functions define the contract for challenge-related API calls.
 * Backend determines eligibility and ranking; UI only displays and
 * disables actions based on returned status/flags.
 * 
 * NOTE: These are stubs - implementations will call actual Supabase
 * functions or edge functions when backend logic is built.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  Challenge,
  ChallengeEntry,
  ChallengesGrouped,
  ChallengeEntriesTab,
  ChallengeEntriesResponse,
  SubmitChallengeEntryPayload,
  VoteResponse,
  HallOfFameWeek,
  AdminChallengeListItem,
  AdminCreateChallengePayload,
  AdminUpdateChallengePayload,
} from "./types";

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch all challenges grouped by status.
 * Returns active, upcoming, and ended challenges.
 */
export async function getChallenges(): Promise<ChallengesGrouped> {
  // TODO: Implement actual API call
  // This would likely call a Supabase function or query with status filtering
  
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .in('status', ['active', 'judging', 'completed'])
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Transform and group by computed status
  const now = new Date();
  const active: Challenge[] = [];
  const upcoming: Challenge[] = [];
  const ended: Challenge[] = [];

  for (const row of data || []) {
    const challenge = transformDbChallengeToUi(row);
    
    if (challenge.status === 'active') {
      active.push(challenge);
    } else if (challenge.status === 'upcoming') {
      upcoming.push(challenge);
    } else {
      ended.push(challenge);
    }
  }

  return { active, upcoming, ended };
}

/**
 * Fetch a single challenge by ID with full details.
 */
export async function getChallengeDetail(id: string): Promise<Challenge> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  
  return transformDbChallengeToUi(data);
}

/**
 * Fetch entries for a challenge with pagination.
 * @param id - Challenge ID
 * @param tab - 'leading' for top voted, 'new' for most recent
 * @param page - Page number (1-indexed)
 */
export async function getChallengeEntries(
  id: string,
  tab: ChallengeEntriesTab = 'leading',
  page: number = 1
): Promise<ChallengeEntriesResponse> {
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  // TODO: Implement proper ordering based on tab
  // 'leading' should order by votes_count desc
  // 'new' should order by created_at desc
  
  let query = supabase
    .from('challenge_submissions')
    .select('*, profiles!challenge_submissions_user_id_fkey(id, username, display_name, avatar_url)', { count: 'exact' })
    .eq('challenge_id', id)
    .in('status', ['approved', 'winner'])
    .range(offset, offset + pageSize - 1);

  if (tab === 'leading') {
    // TODO: Add votes_count column and order by it
    query = query.order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error, count } = await query;

  if (error) throw error;

  const entries: ChallengeEntry[] = (data || []).map(transformDbEntryToUi);
  const totalCount = count || 0;

  return {
    entries,
    totalCount,
    hasMore: offset + entries.length < totalCount,
    page,
  };
}

/**
 * Submit a new entry to a challenge.
 * Backend validates eligibility, clip duration, and submission limits.
 */
export async function submitChallengeEntry(
  payload: SubmitChallengeEntryPayload
): Promise<ChallengeEntry> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be authenticated to submit');

  const { data, error } = await supabase
    .from('challenge_submissions')
    .insert({
      challenge_id: payload.challengeId,
      user_id: user.id,
      session_id: payload.sessionId,
      clip_start_ms: payload.clipStartMs,
      clip_end_ms: payload.clipEndMs,
      title: payload.title,
      description: payload.description,
      proof_notes: payload.proofNotes,
    })
    .select()
    .single();

  if (error) throw error;

  return transformDbEntryToUi(data);
}

/**
 * Vote for a challenge entry.
 * Backend handles vote deduplication and validation.
 */
export async function voteChallengeEntry(entryId: string): Promise<VoteResponse> {
  // TODO: Implement actual voting API
  // This would call an edge function or RPC that handles:
  // - Checking if user already voted
  // - Updating vote count
  // - Preventing self-votes
  
  console.warn('voteChallengeEntry: Not yet implemented', { entryId });
  
  return {
    success: false,
    newVotesCount: 0,
    hasVoted: false,
  };
}

/**
 * Fetch Hall of Fame - past winners grouped by week/challenge.
 */
export async function getHallOfFame(): Promise<HallOfFameWeek[]> {
  // TODO: Implement actual Hall of Fame query
  // This would fetch completed challenges with their winners
  
  const { data, error } = await supabase
    .from('challenge_submissions')
    .select(`
      *,
      challenges!inner(id, title, game_name, status),
      profiles!challenge_submissions_user_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('status', 'winner')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  // TODO: Group by week and challenge
  // For now, return empty array as stub
  return [];
}

/**
 * Fetch winners for an ended challenge.
 * Returns top 3 entries with rank set.
 */
export async function getChallengeWinners(challengeId: string): Promise<ChallengeEntry[]> {
  const { data, error } = await supabase
    .from('challenge_submissions')
    .select('*, profiles!challenge_submissions_user_id_fkey(id, username, display_name, avatar_url)')
    .eq('challenge_id', challengeId)
    .eq('status', 'winner')
    .order('rank', { ascending: true })
    .limit(3);

  if (error) throw error;

  return (data || []).map(transformDbEntryToUi);
}

// ============================================================================
// Admin API
// ============================================================================

/**
 * List all challenges for admin (including drafts).
 */
export async function adminListChallenges(): Promise<AdminChallengeListItem[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    ...transformDbChallengeToUi(row),
    createdBy: row.created_by,
    isDraft: row.status === 'draft',
  }));
}

/**
 * Create a new challenge (admin only).
 */
export async function adminCreateChallenge(
  payload: AdminCreateChallengePayload
): Promise<Challenge> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be authenticated');

  const { data, error } = await supabase
    .from('challenges')
    .insert({
      created_by: user.id,
      title: payload.title,
      game_name: payload.game,
      description: payload.rulesSummary || null,
      rules: payload.rulesFull,
      difficulty: payload.difficulty,
      is_sponsored: !!payload.sponsor,
      sponsor_name: payload.sponsor?.name,
      prize_description: payload.prizePool,
      starts_at: payload.startAt,
      ends_at: payload.endAt,
      thumbnail_url: payload.thumbnailUrl,
      preview_video_url: payload.heroMediaUrl,
      max_submissions_per_user: payload.maxSubmissionsPerUser ?? 1,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw error;

  return transformDbChallengeToUi(data);
}

/**
 * Update an existing challenge (admin only).
 */
export async function adminUpdateChallenge(
  id: string,
  payload: AdminUpdateChallengePayload
): Promise<Challenge> {
  const updates: Record<string, unknown> = {};
  
  if (payload.title !== undefined) updates.title = payload.title;
  if (payload.game !== undefined) updates.game_name = payload.game;
  if (payload.rulesSummary !== undefined) updates.description = payload.rulesSummary;
  if (payload.rulesFull !== undefined) updates.rules = payload.rulesFull;
  if (payload.difficulty !== undefined) updates.difficulty = payload.difficulty;
  if (payload.sponsor !== undefined) {
    updates.is_sponsored = !!payload.sponsor;
    updates.sponsor_name = payload.sponsor?.name;
  }
  if (payload.prizePool !== undefined) updates.prize_description = payload.prizePool;
  if (payload.startAt !== undefined) updates.starts_at = payload.startAt;
  if (payload.endAt !== undefined) updates.ends_at = payload.endAt;
  if (payload.thumbnailUrl !== undefined) updates.thumbnail_url = payload.thumbnailUrl;
  if (payload.heroMediaUrl !== undefined) updates.preview_video_url = payload.heroMediaUrl;
  if (payload.maxSubmissionsPerUser !== undefined) {
    updates.max_submissions_per_user = payload.maxSubmissionsPerUser;
  }

  const { data, error } = await supabase
    .from('challenges')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return transformDbChallengeToUi(data);
}

/**
 * Publish a draft challenge (admin only).
 * Sets status to 'active' and makes it visible to users.
 */
export async function adminPublishChallenge(id: string): Promise<Challenge> {
  const { data, error } = await supabase
    .from('challenges')
    .update({ status: 'active' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return transformDbChallengeToUi(data);
}

/**
 * Unpublish a challenge (admin only).
 * Sets status back to 'draft'.
 */
export async function adminUnpublishChallenge(id: string): Promise<Challenge> {
  const { data, error } = await supabase
    .from('challenges')
    .update({ status: 'draft' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return transformDbChallengeToUi(data);
}

/**
 * End a challenge (admin only).
 * Sets status to 'completed'. Winner selection is handled server-side.
 */
export async function adminEndChallenge(id: string): Promise<Challenge> {
  const { data, error } = await supabase
    .from('challenges')
    .update({ 
      status: 'completed',
      winner_announced_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return transformDbChallengeToUi(data);
}

/**
 * Delete a challenge (admin only).
 * Only allowed for draft challenges.
 */
export async function adminDeleteChallenge(id: string): Promise<void> {
  const { error } = await supabase
    .from('challenges')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// Transform Helpers
// ============================================================================

/**
 * Transform database challenge row to UI Challenge type.
 */
function transformDbChallengeToUi(row: Record<string, unknown>): Challenge {
  const now = new Date();
  const startsAt = row.starts_at ? new Date(row.starts_at as string) : null;
  const endsAt = row.ends_at ? new Date(row.ends_at as string) : null;
  const dbStatus = row.status as string;

  // Compute UI status based on dates and db status
  let status: Challenge['status'] = 'ended';
  if (dbStatus === 'draft') {
    status = 'upcoming';
  } else if (dbStatus === 'active') {
    if (startsAt && now < startsAt) {
      status = 'upcoming';
    } else if (endsAt && now > endsAt) {
      status = 'ended';
    } else {
      status = 'active';
    }
  } else if (dbStatus === 'completed' || dbStatus === 'judging') {
    status = 'ended';
  }

  // Parse sponsor info
  const sponsor: Challenge['sponsor'] = row.is_sponsored
    ? { name: (row.sponsor_name as string) || 'Sponsor' }
    : null;

  // Build prize pool string
  let prizePool: string | null = null;
  if (row.prize_crypto && row.prize_crypto_amount) {
    prizePool = `${row.prize_crypto_amount} ${row.prize_crypto}`;
  } else if (row.prize_description) {
    prizePool = row.prize_description as string;
  }

  return {
    id: row.id as string,
    title: row.title as string,
    game: (row.game_name as string) || 'Unknown Game',
    gameId: null, // TODO: Add game_id to schema if needed
    rulesSummary: (row.description as string) || null,
    rulesFull: row.rules as string | null,
    difficulty: Math.min(5, Math.max(1, (row.difficulty as number) || 3)) as 1 | 2 | 3 | 4 | 5,
    sponsor,
    prizePool,
    prizesTop3: [], // TODO: Parse from prize_description or add structured field
    startAt: (row.starts_at as string) || row.created_at as string,
    endAt: (row.ends_at as string) || '',
    status,
    submissionsCount: (row.submission_count as number) || 0,
    isSponsored: (row.is_sponsored as boolean) || false,
    heroMediaUrl: row.preview_video_url as string | null,
    thumbnailUrl: row.thumbnail_url as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Transform database entry row to UI ChallengeEntry type.
 */
function transformDbEntryToUi(row: Record<string, unknown>): ChallengeEntry {
  const profile = row.profiles as Record<string, unknown> | null;
  const clipStartMs = (row.clip_start_ms as number) || 0;
  const clipEndMs = (row.clip_end_ms as number) || 0;
  const durationMs = clipEndMs - clipStartMs;

  return {
    id: row.id as string,
    challengeId: row.challenge_id as string,
    user: {
      id: profile?.id as string || row.user_id as string,
      username: profile?.username as string | null,
      displayName: profile?.display_name as string | null,
      avatarUrl: profile?.avatar_url as string | null,
    },
    clipUrl: null, // TODO: Generate from session_id
    posterUrl: null, // TODO: Generate thumbnail
    startMs: clipStartMs,
    endMs: clipEndMs,
    durationSec: Math.round(durationMs / 1000),
    votesCount: 0, // TODO: Add votes_count column
    isWinner: row.status === 'winner',
    rank: row.rank as number | null,
    status: row.status as ChallengeEntry['status'],
    createdAt: row.created_at as string,
  };
}
