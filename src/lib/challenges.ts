import { supabase } from "@/integrations/supabase/client";

export interface Challenge {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  rules: string | null;
  game_name: string | null;
  thumbnail_url: string | null;
  preview_video_url: string | null;
  status: 'draft' | 'active' | 'judging' | 'completed' | 'cancelled';
  starts_at: string | null;
  ends_at: string | null;
  winner_announced_at: string | null;
  max_submissions_per_user: number;
  required_moments_count: number;
  required_moments_min: number;
  required_moments_max: number;
  moment_label: string | null;
  tags: string[];
  prize_description: string | null;
  prize_crypto: string | null;
  prize_crypto_amount: number | null;
  difficulty: number;
  is_sponsored: boolean;
  sponsor_name: string | null;
  submission_count: number;
  created_at: string;
  updated_at: string;
}

export interface SubmissionMoment {
  annotation_id: string;
  start_ms: number;
  end_ms: number;
  order: number;
  label?: string;
}

export interface ChallengeSubmission {
  id: string;
  challenge_id: string;
  user_id: string;
  session_id: string | null;
  clip_start_ms: number | null;
  clip_end_ms: number | null;
  title: string | null;
  description: string | null;
  proof_notes: string | null;
  moments: SubmissionMoment[] | null;
  status: 'pending' | 'approved' | 'rejected' | 'winner';
  rank: number | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchChallenges(status?: Challenge['status'] | Challenge['status'][]) {
  let query = supabase
    .from('challenges')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    if (Array.isArray(status)) {
      query = query.in('status', status);
    } else {
      query = query.eq('status', status);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Challenge[];
}

export async function fetchChallenge(id: string) {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Challenge;
}

export async function fetchChallengeSubmissions(challengeId: string) {
  const { data, error } = await supabase
    .from('challenge_submissions')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as ChallengeSubmission[];
}

export async function fetchUserSubmissions(challengeId: string, userId: string) {
  const { data, error } = await supabase
    .from('challenge_submissions')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId);

  if (error) throw error;
  return data as unknown as ChallengeSubmission[];
}

export async function createSubmission(submission: {
  challenge_id: string;
  user_id: string;
  session_id?: string;
  clip_start_ms?: number;
  clip_end_ms?: number;
  title?: string;
  description?: string;
  proof_notes?: string;
  moments?: SubmissionMoment[];
}) {
  const { data, error } = await supabase
    .from('challenge_submissions')
    .insert({
      challenge_id: submission.challenge_id,
      user_id: submission.user_id,
      session_id: submission.session_id,
      clip_start_ms: submission.clip_start_ms,
      clip_end_ms: submission.clip_end_ms,
      title: submission.title,
      description: submission.description,
      proof_notes: submission.proof_notes,
      moments: submission.moments ? (submission.moments as any) : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ChallengeSubmission;
}

export async function updateSubmission(
  id: string,
  updates: Partial<ChallengeSubmission>
) {
  const { data, error } = await supabase
    .from('challenge_submissions')
    .update(updates as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ChallengeSubmission;
}

export async function deleteSubmission(id: string) {
  const { error } = await supabase
    .from('challenge_submissions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function getChallengeStatus(challenge: Challenge): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  isOpen: boolean;
} {
  const now = new Date();
  const startsAt = challenge.starts_at ? new Date(challenge.starts_at) : null;
  const endsAt = challenge.ends_at ? new Date(challenge.ends_at) : null;

  if (challenge.status === 'completed') {
    return { label: 'Completed', variant: 'secondary', isOpen: false };
  }
  if (challenge.status === 'cancelled') {
    return { label: 'Cancelled', variant: 'destructive', isOpen: false };
  }
  if (challenge.status === 'judging') {
    return { label: 'Judging', variant: 'outline', isOpen: false };
  }
  if (challenge.status === 'draft') {
    return { label: 'Coming Soon', variant: 'outline', isOpen: false };
  }

  // Active challenge
  if (startsAt && now < startsAt) {
    return { label: 'Starting Soon', variant: 'outline', isOpen: false };
  }
  if (endsAt && now > endsAt) {
    return { label: 'Ended', variant: 'secondary', isOpen: false };
  }

  return { label: 'Open', variant: 'default', isOpen: true };
}

export function getTimeRemaining(endsAt: string | null): string | null {
  if (!endsAt) return null;
  
  const now = new Date();
  const end = new Date(endsAt);
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return null;
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return `${days}d ${hours}h left`;
  }
  
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  
  return `${minutes}m left`;
}
