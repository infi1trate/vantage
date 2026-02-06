/**
 * Hook for admin challenge management.
 * 
 * Fetches and manages challenges for admin panel.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminListChallenges,
  adminPublishChallenge,
  adminUnpublishChallenge,
  adminEndChallenge,
  adminDeleteChallenge,
} from "@/lib/challenges/api";
import { toast } from "sonner";

export function useAdminChallenges() {
  return useQuery({
    queryKey: ["admin-challenges"],
    queryFn: adminListChallenges,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useAdminPublishChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminPublishChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      toast.success("Challenge published successfully");
    },
    onError: (error) => {
      console.error("Failed to publish challenge:", error);
      toast.error("Failed to publish challenge");
    },
  });
}

export function useAdminUnpublishChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminUnpublishChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      toast.success("Challenge unpublished");
    },
    onError: (error) => {
      console.error("Failed to unpublish challenge:", error);
      toast.error("Failed to unpublish challenge");
    },
  });
}

export function useAdminEndChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminEndChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      toast.success("Challenge ended");
    },
    onError: (error) => {
      console.error("Failed to end challenge:", error);
      toast.error("Failed to end challenge");
    },
  });
}

export function useAdminDeleteChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminDeleteChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      toast.success("Challenge deleted");
    },
    onError: (error) => {
      console.error("Failed to delete challenge:", error);
      toast.error("Failed to delete challenge");
    },
  });
}
