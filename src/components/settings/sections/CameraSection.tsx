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
import { Video, Mic, Volume2, Eye } from "lucide-react";

interface UserPreferences {
  id: string;
  user_id: string;
  record_facecam: boolean | null;
  record_microphone: boolean | null;
  record_game_audio: boolean | null;
  default_session_visibility: string | null;
  default_playback_speed: number | null;
}

export function CameraSection() {
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
        .select("id, user_id, record_facecam, record_microphone, record_game_audio, default_session_visibility, default_playback_speed")
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
          .select("id, user_id, record_facecam, record_microphone, record_game_audio, default_session_visibility, default_playback_speed")
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
        description="Default settings for new capture sessions"
      >
        <div className="space-y-1">
          <PreferenceToggle
            icon={Video}
            label="Record Facecam"
            description="Enable webcam recording by default"
            checked={preferences?.record_facecam ?? true}
            onCheckedChange={(v) => updatePreference("record_facecam", v)}
            saving={saving === "record_facecam"}
          />
          <PreferenceToggle
            icon={Mic}
            label="Record Microphone"
            description="Enable microphone recording by default"
            checked={preferences?.record_microphone ?? true}
            onCheckedChange={(v) => updatePreference("record_microphone", v)}
            saving={saving === "record_microphone"}
          />
          <PreferenceToggle
            icon={Volume2}
            label="Record Game Audio"
            description="Capture system and game audio"
            checked={preferences?.record_game_audio ?? true}
            onCheckedChange={(v) => updatePreference("record_game_audio", v)}
            saving={saving === "record_game_audio"}
          />
        </div>
      </SettingsCard>

      {/* Session Defaults */}
      <SettingsCard 
        title="Session Defaults" 
        description="Default settings for new sessions"
      >
        <div className="space-y-4 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <Label className="text-sm font-medium text-foreground">Default Visibility</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Who can see your sessions by default
                </p>
              </div>
            </div>
            <Select
              value={preferences?.default_session_visibility || "private"}
              onValueChange={(v) => updatePreference("default_session_visibility", v)}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
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
      </SettingsCard>

      {/* Playback */}
      <SettingsCard 
        title="Playback" 
        description="Video player preferences"
      >
        <div className="py-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <Label className="text-sm font-medium text-foreground">Default Playback Speed</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Starting speed when reviewing sessions
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
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  saving?: boolean;
}

function PreferenceToggle({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  saving,
}: PreferenceToggleProps) {
  return (
    <div className="py-3 border-b border-border/20 last:border-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <Label className="text-sm font-medium text-foreground">{label}</Label>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
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
