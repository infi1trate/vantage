/**
 * Reel Package Config Hook
 * 
 * React Query hooks for managing reel package configurations.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ReelPackageConfig,
  StyleKey,
  AudioMode,
  BeatSource,
  mapDbToReelPackageConfig,
  mapReelPackageConfigToDb,
  createDefaultReelPackageConfig,
} from "@/lib/reelPackageConfig";

// ============= Query Keys =============

const QUERY_KEYS = {
  config: (sessionId: string) => ["reelPackageConfig", sessionId],
  userConfigs: (userId: string) => ["reelPackageConfigs", userId],
};

// ============= Queries =============

/**
 * Get reel package config for a session
 */
export function useReelPackageConfig(sessionId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: QUERY_KEYS.config(sessionId || ""),
    queryFn: async () => {
      if (!sessionId || !user) return null;
      
      const { data, error } = await supabase
        .from("reel_package_configs")
        .select("*")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      return mapDbToReelPackageConfig(data);
    },
    enabled: !!sessionId && !!user,
    staleTime: 30000,
  });
}

// ============= Mutations =============

/**
 * Create or update reel package config
 */
export function useUpsertReelPackageConfig() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      sessionId,
      config,
    }: {
      sessionId: string;
      config: Partial<ReelPackageConfig>;
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      // Check if config exists
      const { data: existing } = await supabase
        .from("reel_package_configs")
        .select("id")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();
      
      const dbData = mapReelPackageConfigToDb({
        ...config,
        userId: user.id,
        sessionId,
      });
      
      if (existing) {
        // Update
        const { data, error } = await supabase
          .from("reel_package_configs")
          .update(dbData as any)
          .eq("id", existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return mapDbToReelPackageConfig(data as Record<string, unknown>);
      } else {
        // Insert
        const { data, error } = await supabase
          .from("reel_package_configs")
          .insert(dbData as any)
          .select()
          .single();
        
        if (error) throw error;
        return mapDbToReelPackageConfig(data as Record<string, unknown>);
      }
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(QUERY_KEYS.config(variables.sessionId), data);
    },
  });
}

/**
 * Update specific fields of reel package config
 */
export function useUpdateReelPackageConfig() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      configId,
      sessionId,
      updates,
    }: {
      configId: string;
      sessionId: string;
      updates: Partial<ReelPackageConfig>;
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      const dbData = mapReelPackageConfigToDb(updates);
      
      const { data, error } = await supabase
        .from("reel_package_configs")
        .update(dbData as any)
        .eq("id", configId)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return mapDbToReelPackageConfig(data as Record<string, unknown>);
    },
    onMutate: async ({ sessionId, updates }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.config(sessionId) });
      
      const previous = queryClient.getQueryData<ReelPackageConfig>(
        QUERY_KEYS.config(sessionId)
      );
      
      if (previous) {
        queryClient.setQueryData(QUERY_KEYS.config(sessionId), {
          ...previous,
          ...updates,
        });
      }
      
      return { previous };
    },
    onError: (err, { sessionId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEYS.config(sessionId), context.previous);
      }
    },
    onSettled: (data, err, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.config(sessionId) });
    },
  });
}

/**
 * Trigger generation of reel package assets
 */
export function useTriggerGeneration() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      configId,
      sessionId,
    }: {
      configId: string;
      sessionId: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      // Update status to pending
      const { data, error } = await supabase
        .from("reel_package_configs")
        .update({
          generation_status: "pending",
          generation_progress: 0,
          generation_error: null,
          generation_metadata: {
            createdAt: new Date().toISOString(),
          },
        } as any)
        .eq("id", configId)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      
      // TODO: Call edge function to start generation
      // For now, simulate by setting to "generating"
      // In production, this would trigger a background job
      
      return mapDbToReelPackageConfig(data as Record<string, unknown>);
    },
    onSuccess: (data, { sessionId }) => {
      queryClient.setQueryData(QUERY_KEYS.config(sessionId), data);
    },
  });
}

/**
 * Delete reel package config
 */
export function useDeleteReelPackageConfig() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      configId,
      sessionId,
    }: {
      configId: string;
      sessionId: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("reel_package_configs")
        .delete()
        .eq("id", configId)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.setQueryData(QUERY_KEYS.config(sessionId), null);
    },
  });
}

// ============= Combined Hook =============

export interface UseReelPackageResult {
  config: ReelPackageConfig | null | undefined;
  isLoading: boolean;
  
  // Toggles
  setIntroEnabled: (enabled: boolean) => void;
  setOutroEnabled: (enabled: boolean) => void;
  setTransitionsEnabled: (enabled: boolean) => void;
  
  // Settings
  setStyleKey: (styleKey: StyleKey) => void;
  setAudioMode: (audioMode: AudioMode) => void;
  setBeatSource: (beatSource: BeatSource) => void;
  setStatOverlayEnabled: (enabled: boolean) => void;
  
  // Actions
  generate: () => void;
  regenerate: () => void;
  
  // State
  isGenerating: boolean;
  canGenerate: boolean;
}

export function useReelPackage(sessionId: string | undefined): UseReelPackageResult {
  const { user } = useAuth();
  const { data: config, isLoading } = useReelPackageConfig(sessionId);
  const upsertMutation = useUpsertReelPackageConfig();
  const updateMutation = useUpdateReelPackageConfig();
  const generateMutation = useTriggerGeneration();
  
  const ensureConfig = async () => {
    if (!sessionId || !user) return null;
    
    if (!config) {
      // Create default config
      const defaults = createDefaultReelPackageConfig(user.id, sessionId);
      return await upsertMutation.mutateAsync({ sessionId, config: defaults });
    }
    return config;
  };
  
  const updateField = async <K extends keyof ReelPackageConfig>(
    field: K,
    value: ReelPackageConfig[K]
  ) => {
    if (!sessionId || !user) return;
    
    const currentConfig = await ensureConfig();
    if (!currentConfig) return;
    
    await updateMutation.mutateAsync({
      configId: currentConfig.id,
      sessionId,
      updates: { [field]: value } as Partial<ReelPackageConfig>,
    });
  };
  
  const setIntroEnabled = (enabled: boolean) => updateField("enabledIntro", enabled);
  const setOutroEnabled = (enabled: boolean) => updateField("enabledOutro", enabled);
  const setTransitionsEnabled = (enabled: boolean) => updateField("enabledTransitions", enabled);
  const setStyleKey = (styleKey: StyleKey) => updateField("styleKey", styleKey);
  const setAudioMode = (audioMode: AudioMode) => updateField("audioMode", audioMode);
  const setBeatSource = (beatSource: BeatSource) => updateField("beatSource", beatSource);
  const setStatOverlayEnabled = (enabled: boolean) => updateField("statOverlayEnabled", enabled);
  
  const generate = async () => {
    if (!sessionId || !user) return;
    
    const currentConfig = await ensureConfig();
    if (!currentConfig) return;
    
    await generateMutation.mutateAsync({
      configId: currentConfig.id,
      sessionId,
    });
  };
  
  const regenerate = generate; // Same action for now
  
  const isGenerating = 
    config?.generationStatus === "pending" || 
    config?.generationStatus === "generating";
  
  const canGenerate = 
    !isGenerating && 
    (config?.enabledIntro || config?.enabledOutro || config?.enabledTransitions);
  
  return {
    config,
    isLoading,
    setIntroEnabled,
    setOutroEnabled,
    setTransitionsEnabled,
    setStyleKey,
    setAudioMode,
    setBeatSource,
    setStatOverlayEnabled,
    generate,
    regenerate,
    isGenerating,
    canGenerate: canGenerate ?? false,
  };
}
