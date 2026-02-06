/**
 * Challenges feature exports.
 * 
 * This module provides UI-facing types and API helpers for the Challenges feature.
 * Backend determines eligibility and ranking; UI only displays and disables
 * actions based on returned status/flags.
 */

// Types
export * from './types';

// API helpers
export {
  // Public API
  getChallenges,
  getChallengeDetail,
  getChallengeEntries,
  submitChallengeEntry,
  voteChallengeEntry,
  getHallOfFame,
  // Admin API
  adminListChallenges,
  adminCreateChallenge,
  adminUpdateChallenge,
  adminPublishChallenge,
  adminUnpublishChallenge,
  adminEndChallenge,
  adminDeleteChallenge,
} from './api';

// Re-export legacy helpers for backward compatibility
// These are used by existing components (ChallengeCard, etc.)
export {
  getChallengeStatus,
  getTimeRemaining,
  // Legacy types (database-oriented)
  type Challenge as DbChallenge,
  type ChallengeSubmission as DbChallengeSubmission,
  // Legacy fetch functions
  fetchChallenges,
  fetchChallenge,
  fetchChallengeSubmissions,
  fetchUserSubmissions,
  createSubmission,
  updateSubmission,
  deleteSubmission,
} from '../challenges';
