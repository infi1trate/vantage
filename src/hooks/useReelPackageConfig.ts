/**
 * Reel Package Config Hook
 * 
 * React Query hooks for managing reel package configurations.
 * Integrates with AI generation pipeline.
 */

import { useState, useCallback, useRef } from "react";
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
  DEFAULT_ENERGY_PROFILE,
} from "@/lib/reelPackageConfig";
import {
  generateReelAssets,
  computeEnergyProfile,
  GenerationInputs,
  GenerationProgress,
  GenerationResult,
} from "@/lib/aiGeneration";

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
 * Uses local AI generation pipeline (can be swapped for server-side)
 */
export function useTriggerGeneration() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      configId,
      sessionId,
      inputs,
      onProgress,
    }: {
      configId: string;
      sessionId: string;
      inputs: GenerationInputs;
      onProgress?: (progress: GenerationProgress) => void;
    }): Promise<{ config: ReelPackageConfig; result: GenerationResult }> => {
      if (!user) throw new Error("Not authenticated");
      
      // Update status to pending
      await supabase
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
        .eq("user_id", user.id);
      
      // Update to generating
      await supabase
        .from("reel_package_configs")
        .update({
          generation_status: "generating",
        } as any)
        .eq("id", configId);
      
      try {
        // Run generation pipeline
        const result = await generateReelAssets(inputs, (progress) => {
          // Update progress in DB
          supabase
            .from("reel_package_configs")
            .update({
              generation_progress: progress.progress,
            } as any)
            .eq("id", configId)
            .then(() => {});
          
          onProgress?.(progress);
        });
        
        // Update with results
        const { data, error } = await supabase
          .from("reel_package_configs")
          .update({
            generation_status: "ready",
            generation_progress: 100,
            energy_profile: inputs.energyProfile,
            intro_asset_id: result.introTemplate?.id || null,
            outro_asset_id: result.outroTemplate?.id || null,
            transition_asset_ids: result.transitionTemplates.map(t => t.id),
            generation_metadata: {
              ...result.metadata,
              frameVariantCount: result.frameVariants.length,
            },
          } as any)
          .eq("id", configId)
          .eq("user_id", user.id)
          .select()
          .single();
        
        if (error) throw error;
        
        return {
          config: mapDbToReelPackageConfig(data as Record<string, unknown>),
          result,
        };
      } catch (err) {
        // Update with error
        await supabase
          .from("reel_package_configs")
          .update({
            generation_status: "failed",
            generation_error: err instanceof Error ? err.message : "Unknown error",
          } as any)
          .eq("id", configId);
        
        throw err;
      }
    },
    onSuccess: ({ config }, { sessionId }) => {
      queryClient.setQueryData(QUERY_KEYS.config(sessionId), config);
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
  generate: (sessionData?: {
    durationSeconds?: number;
    momentCount?: number;
    gameName?: string;
  }) => void;
  regenerate: (sessionData?: {
    durationSeconds?: number;
    momentCount?: number;
    gameName?: string;
  }) => void;
  
  // State
  isGenerating: boolean;
  canGenerate: boolean;
  generationProgress: number;
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
  
  const generate = async (sessionData?: {
    durationSeconds?: number;
    momentCount?: number;
    gameName?: string;
  }) => {
    if (!sessionId || !user) return;
    
    const currentConfig = await ensureConfig();
    if (!currentConfig) return;
    
    // Build generation inputs from config and session data
    const inputs: GenerationInputs = {
      styleKey: currentConfig.styleKey,
      gameName: sessionData?.gameName,
      energyProfile: currentConfig.energyProfile || computeEnergyProfile({
        durationSeconds: sessionData?.durationSeconds || 60,
        momentCount: sessionData?.momentCount || 3,
      }),
      durationSeconds: sessionData?.durationSeconds,
      clipCount: sessionData?.momentCount,
    };
    
    await generateMutation.mutateAsync({
      configId: currentConfig.id,
      sessionId,
      inputs,
      onProgress: (progress) => {
        // Progress is handled by the mutation
        console.log("[ReelPackage] Generation progress:", progress.stage, progress.progress);
      },
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
    generationProgress: config?.generationProgress ?? 0,
  };
}
