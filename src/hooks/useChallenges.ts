import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchChallenges,
  fetchChallenge,
  fetchChallengeSubmissions,
  fetchUserSubmissions,
  createSubmission,
  updateSubmission,
  deleteSubmission,
  type Challenge,
  type ChallengeSubmission,
  type SubmissionMoment,
} from "@/lib/challenges";

export function useChallenges(status?: Challenge['status'] | Challenge['status'][]) {
  return useQuery({
    queryKey: ['challenges', status],
    queryFn: () => fetchChallenges(status),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useChallenge(id: string | undefined) {
  return useQuery({
    queryKey: ['challenge', id],
    queryFn: () => fetchChallenge(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useChallengeSubmissions(challengeId: string | undefined) {
  return useQuery({
    queryKey: ['challenge-submissions', challengeId],
    queryFn: () => fetchChallengeSubmissions(challengeId!),
    enabled: !!challengeId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useUserSubmissions(challengeId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-submissions', challengeId, user?.id],
    queryFn: () => fetchUserSubmissions(challengeId!, user!.id),
    enabled: !!challengeId && !!user?.id,
    staleTime: 30 * 1000,
  });
}

export function useCreateSubmission() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: {
      challenge_id: string;
      session_id?: string;
      clip_start_ms?: number;
      clip_end_ms?: number;
      title?: string;
      description?: string;
      proof_notes?: string;
      moments?: SubmissionMoment[];
    }) => createSubmission({ ...data, user_id: user!.id }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['challenge-submissions', variables.challenge_id] });
      queryClient.invalidateQueries({ queryKey: ['user-submissions', variables.challenge_id] });
    },
  });
}

export function useUpdateSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ChallengeSubmission> }) =>
      updateSubmission(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['challenge-submissions', data.challenge_id] });
      queryClient.invalidateQueries({ queryKey: ['user-submissions', data.challenge_id] });
    },
  });
}

export function useDeleteSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSubmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenge-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['user-submissions'] });
    },
  });
}
