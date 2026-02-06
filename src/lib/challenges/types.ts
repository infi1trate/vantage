/**
 * UI-facing types for the Challenges feature.
 * These types represent the shape of data as consumed by the frontend,
 * which may differ from the raw database schema.
 */

// ============================================================================
// Core Types
// ============================================================================

export type ChallengeStatus = 'active' | 'upcoming' | 'ended';

export interface ChallengeSponsor {
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
}

export interface ChallengePrize {
  rank: 1 | 2 | 3;
  amount: number;
  currency: string; // e.g., "ETH", "USDC", "USD"
  description?: string;
}

export interface Challenge {
  id: string;
  title: string;
  game: string;
  gameId: string | null;
  rulesSummary: string | null;
  rulesFull: string | null;
  difficulty: 1 | 2 | 3 | 4 | 5;
  sponsor: ChallengeSponsor | null;
  prizePool: string | null; // Formatted display string, e.g., "0.5 ETH"
  prizesTop3: ChallengePrize[];
  startAt: string; // ISO date
  endAt: string; // ISO date
  status: ChallengeStatus;
  submissionsCount: number;
  isSponsored: boolean;
  heroMediaUrl: string | null; // Video or image URL for hero section
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeEntryUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ChallengeEntry {
  id: string;
  challengeId: string;
  user: ChallengeEntryUser;
  clipUrl: string | null;
  posterUrl: string | null; // Thumbnail/poster frame
  startMs: number;
  endMs: number;
  durationSec: number;
  votesCount: number;
  isWinner: boolean;
  rank: number | null; // 1, 2, 3 for podium, null for unranked
  status: 'pending' | 'approved' | 'rejected' | 'winner';
  createdAt: string;
}

// ============================================================================
// Grouped Response Types
// ============================================================================

export interface ChallengesGrouped {
  active: Challenge[];
  upcoming: Challenge[];
  ended: Challenge[];
}

export type ChallengeEntriesTab = 'leading' | 'new';

export interface ChallengeEntriesResponse {
  entries: ChallengeEntry[];
  totalCount: number;
  hasMore: boolean;
  page: number;
}

// ============================================================================
// Hall of Fame Types
// ============================================================================

export interface HallOfFameWeek {
  weekStart: string; // ISO date
  weekEnd: string; // ISO date
  challenges: HallOfFameChallenge[];
}

export interface HallOfFameChallenge {
  challengeId: string;
  challengeTitle: string;
  game: string;
  winners: ChallengeEntry[];
}

// ============================================================================
// Submission Payload Types
// ============================================================================

export interface SubmitChallengeEntryPayload {
  challengeId: string;
  sessionId: string;
  clipStartMs: number;
  clipEndMs: number;
  title?: string;
  description?: string;
  proofNotes?: string;
}

// ============================================================================
// Admin Types
// ============================================================================

export interface AdminChallengeListItem extends Challenge {
  createdBy: string;
  isDraft: boolean;
}

export interface AdminCreateChallengePayload {
  title: string;
  game: string;
  gameId?: string;
  rulesSummary?: string;
  rulesFull?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  sponsor?: ChallengeSponsor;
  prizePool?: string;
  prizesTop3?: ChallengePrize[];
  startAt: string;
  endAt: string;
  heroMediaUrl?: string;
  thumbnailUrl?: string;
  maxSubmissionsPerUser?: number;
}

export interface AdminUpdateChallengePayload extends Partial<AdminCreateChallengePayload> {
  // All fields optional for partial updates
}

// ============================================================================
// Vote Response
// ============================================================================

export interface VoteResponse {
  success: boolean;
  newVotesCount: number;
  hasVoted: boolean;
}
