/**
 * Default Frame Hook
 * 
 * Fetches and manages the user's default frame for new captures.
 * This hook is used to:
 * 1. Load the default frame when starting a new capture
 * 2. Apply frame metadata immediately (without affecting capture performance)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  getFrameOverlay, 
  type FrameOverlay,
  DEFAULT_STYLE_PARAMS,
  DEFAULT_LAYOUT_PARAMS,
} from "@/lib/frameOverlays";
import type { FrameConfig } from "@/components/captures/frames/FramesTab";

interface UserDefaultFrameData {
  defaultFrameId: string | null;
  defaultFrame: FrameOverlay | null;
}

/**
 * Fetch user's default frame ID and full frame data
 */
export function useDefaultFrameData() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["userDefaultFrame", user?.id],
    queryFn: async (): Promise<UserDefaultFrameData> => {
      if (!user) return { defaultFrameId: null, defaultFrame: null };

      // Get user preferences with default frame ID
      const { data: prefs, error } = await supabase
        .from("user_preferences")
        .select("default_frame_id")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("[useDefaultFrame] Preferences fetch error:", error);
        return { defaultFrameId: null, defaultFrame: null };
      }

      const frameId = prefs?.default_frame_id as string | null;
      
      if (!frameId) {
        return { defaultFrameId: null, defaultFrame: null };
      }

      // Fetch full frame data
      const frame = await getFrameOverlay(frameId);
      
      return {
        defaultFrameId: frameId,
        defaultFrame: frame,
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Convert a FrameOverlay to a FrameConfig for use in Effects
 */
export function frameOverlayToConfig(frame: FrameOverlay | null): FrameConfig {
  if (!frame) {
    return {
      enabled: false,
      presetKey: null,
      style: DEFAULT_STYLE_PARAMS,
      layout: DEFAULT_LAYOUT_PARAMS,
      isAIGenerated: false,
    };
  }

  return {
    enabled: true,
    presetKey: frame.preset_key,
    style: frame.style_params,
    layout: frame.layout_params,
    isAIGenerated: frame.type === "ai",
    aiVariantId: frame.type === "ai" ? frame.id : undefined,
  };
}

/**
 * Hook to apply default frame when starting capture
 * Returns the initial FrameConfig to use
 */
export function useApplyDefaultFrame() {
  const { data, isLoading } = useDefaultFrameData();

  return {
    isLoading,
    defaultFrameId: data?.defaultFrameId ?? null,
    defaultFrame: data?.defaultFrame ?? null,
    getInitialFrameConfig: (): FrameConfig => {
      return frameOverlayToConfig(data?.defaultFrame ?? null);
    },
  };
}

/**
 * Hook to update the default frame ID in user preferences
 */
export function useUpdateDefaultFrame() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (frameId: string | null) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          default_frame_id: frameId,
        }, {
          onConflict: "user_id",
        });

      if (error) throw error;
      return frameId;
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["userDefaultFrame", user.id] });
        queryClient.invalidateQueries({ queryKey: ["userPreferences"] });
      }
    },
  });
}
