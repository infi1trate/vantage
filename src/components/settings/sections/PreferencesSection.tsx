import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard, SettingsCardSkeleton } from "../SettingsCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UserPreferences {
  id: string;
  user_id: string;
  theme: string | null;
  default_playback_speed: number | null;
  record_facecam: boolean | null;
  record_microphone: boolean | null;
  record_game_audio: boolean | null;
  default_session_visibility: string | null;
  allow_ai_analysis: boolean | null;
  show_ai_insights: boolean | null;
  notify_on_share: boolean | null;
  notify_on_comment: boolean | null;
  notify_on_analysis_complete: boolean | null;
  auto_skip_dead_time: boolean | null;
  sidebar_collapsed: boolean | null;
  timeline_zoom: number | null;
}

export function PreferencesSection() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setPreferences(data);
      } else {
        // Create preferences if they don't exist
        const { data: newPrefs, error: createError } = await supabase
          .from("user_preferences")
          .insert({ user_id: user.id })
          .select()
          .single();

        if (createError) throw createError;
        setPreferences(newPrefs);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
      toast.error("Failed to load preferences");
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    if (!user || !preferences) return;

    setSaving(key);
    try {
      const { error } = await supabase
        .from("user_preferences")
        .update({ [key]: value })
        .eq("user_id", user.id);

      if (error) throw error;

      setPreferences((prev) => (prev ? { ...prev, [key]: value } : null));
      toast.success("Preference saved");
    } catch (error) {
      console.error("Error updating preference:", error);
      toast.error("Failed to save preference");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsCardSkeleton />
        <SettingsCardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Recording Defaults */}
      <SettingsCard 
        title="Recording Defaults" 
        description="Default settings for new captures"
      >
        <div className="space-y-4">
          <PreferenceToggle
            label="Record Facecam"
            description="Enable webcam by default"
            checked={preferences?.record_facecam ?? true}
            onCheckedChange={(v) => updatePreference("record_facecam", v)}
            saving={saving === "record_facecam"}
          />
          <PreferenceToggle
            label="Record Microphone"
            description="Enable microphone by default"
            checked={preferences?.record_microphone ?? true}
            onCheckedChange={(v) => updatePreference("record_microphone", v)}
            saving={saving === "record_microphone"}
          />
          <PreferenceToggle
            label="Record Game Audio"
            description="Capture system/game audio"
            checked={preferences?.record_game_audio ?? true}
            onCheckedChange={(v) => updatePreference("record_game_audio", v)}
            saving={saving === "record_game_audio"}
          />
          
          <div className="py-3 border-b border-border/20 last:border-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <Label className="text-sm font-medium text-foreground">Default Visibility</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Who can see your sessions by default
                </p>
              </div>
              <Select
                value={preferences?.default_session_visibility || "private"}
                onValueChange={(v) => updatePreference("default_session_visibility", v)}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* AI & Analysis */}
      <SettingsCard 
        title="AI & Analysis" 
        description="Control AI-powered features"
      >
        <div className="space-y-4">
          <PreferenceToggle
            label="Allow AI Analysis"
            description="Let AI analyze your gameplay"
            checked={preferences?.allow_ai_analysis ?? true}
            onCheckedChange={(v) => updatePreference("allow_ai_analysis", v)}
            saving={saving === "allow_ai_analysis"}
          />
          <PreferenceToggle
            label="Show AI Insights"
            description="Display AI suggestions during review"
            checked={preferences?.show_ai_insights ?? true}
            onCheckedChange={(v) => updatePreference("show_ai_insights", v)}
            saving={saving === "show_ai_insights"}
          />
          <PreferenceToggle
            label="Auto-skip Dead Time"
            description="Skip low-activity sections automatically"
            checked={preferences?.auto_skip_dead_time ?? false}
            onCheckedChange={(v) => updatePreference("auto_skip_dead_time", v)}
            saving={saving === "auto_skip_dead_time"}
          />
        </div>
      </SettingsCard>

      {/* Notifications */}
      <SettingsCard 
        title="Notifications" 
        description="Choose what notifications you receive"
      >
        <div className="space-y-4">
          <PreferenceToggle
            label="Share Notifications"
            description="When someone shares a session with you"
            checked={preferences?.notify_on_share ?? true}
            onCheckedChange={(v) => updatePreference("notify_on_share", v)}
            saving={saving === "notify_on_share"}
          />
          <PreferenceToggle
            label="Comment Notifications"
            description="When someone comments on your content"
            checked={preferences?.notify_on_comment ?? true}
            onCheckedChange={(v) => updatePreference("notify_on_comment", v)}
            saving={saving === "notify_on_comment"}
          />
          <PreferenceToggle
            label="Analysis Complete"
            description="When AI analysis finishes processing"
            checked={preferences?.notify_on_analysis_complete ?? true}
            onCheckedChange={(v) => updatePreference("notify_on_analysis_complete", v)}
            saving={saving === "notify_on_analysis_complete"}
          />
        </div>
      </SettingsCard>

      {/* Playback */}
      <SettingsCard 
        title="Playback" 
        description="Video player preferences"
      >
        <div className="py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <Label className="text-sm font-medium text-foreground">Default Playback Speed</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Starting speed for video playback
              </p>
            </div>
            <Select
              value={String(preferences?.default_playback_speed || 1)}
              onValueChange={(v) => updatePreference("default_playback_speed", parseFloat(v))}
            >
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="0.75">0.75x</SelectItem>
                <SelectItem value="1">1x</SelectItem>
                <SelectItem value="1.25">1.25x</SelectItem>
                <SelectItem value="1.5">1.5x</SelectItem>
                <SelectItem value="2">2x</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

interface PreferenceToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  saving?: boolean;
}

function PreferenceToggle({
  label,
  description,
  checked,
  onCheckedChange,
  saving,
}: PreferenceToggleProps) {
  return (
    <div className="py-3 border-b border-border/20 last:border-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Label className="text-sm font-medium text-foreground">{label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={saving}
          className={cn(saving && "opacity-50")}
        />
      </div>
    </div>
  );
}
