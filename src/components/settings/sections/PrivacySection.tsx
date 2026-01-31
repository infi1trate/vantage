import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard, SettingsCardSkeleton } from "../SettingsCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UserX, Trash2, Loader2, Search, Ban, Brain, Bell, Download, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlockedUser {
  id: string;
  blocked_user_id: string;
  reason: string | null;
  created_at: string;
  profile?: {
    display_name: string | null;
    username: string | null;
  };
}

interface UserPreferences {
  allow_ai_analysis: boolean | null;
  show_ai_insights: boolean | null;
  notify_on_share: boolean | null;
  notify_on_comment: boolean | null;
  notify_on_analysis_complete: boolean | null;
}

export function PrivacySection() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch preferences
      const { data: prefsData } = await supabase
        .from("user_preferences")
        .select("allow_ai_analysis, show_ai_insights, notify_on_share, notify_on_comment, notify_on_analysis_complete")
        .eq("user_id", user.id)
        .single();

      if (prefsData) {
        setPreferences(prefsData);
      }

      // Fetch blocked users
      const { data: blockedData, error } = await supabase
        .from("blocked_users")
        .select("id, blocked_user_id, reason, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for blocked users
      if (blockedData && blockedData.length > 0) {
        const blockedIds = blockedData.map(b => b.blocked_user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", blockedIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        
        setBlockedUsers(blockedData.map(b => ({
          ...b,
          profile: profileMap.get(b.blocked_user_id)
        })));
      } else {
        setBlockedUsers([]);
      }
    } catch (error) {
      console.error("Error fetching privacy data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof UserPreferences, value: boolean) => {
    if (!user) return;

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

  const handleUnblock = async (blockedUserId: string) => {
    if (!user) return;

    setUnblocking(blockedUserId);
    try {
      const { error } = await supabase
        .from("blocked_users")
        .delete()
        .eq("user_id", user.id)
        .eq("blocked_user_id", blockedUserId);

      if (error) throw error;

      setBlockedUsers((prev) => prev.filter((b) => b.blocked_user_id !== blockedUserId));
      toast.success("User unblocked");
    } catch (error) {
      console.error("Error unblocking user:", error);
      toast.error("Failed to unblock user");
    } finally {
      setUnblocking(null);
    }
  };

  const filteredUsers = blockedUsers.filter((b) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      b.profile?.display_name?.toLowerCase().includes(query) ||
      b.profile?.username?.toLowerCase().includes(query)
    );
  });

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
      {/* AI & Analysis */}
      <SettingsCard 
        title="AI & Analysis" 
        description="Control how AI features work with your content"
      >
        <div className="space-y-1">
          <PreferenceToggle
            icon={Brain}
            label="Allow AI Analysis"
            description="Let AI analyze your gameplay for insights"
            checked={preferences?.allow_ai_analysis ?? true}
            onCheckedChange={(v) => updatePreference("allow_ai_analysis", v)}
            saving={saving === "allow_ai_analysis"}
          />
          <PreferenceToggle
            icon={Brain}
            label="Show AI Insights"
            description="Display AI suggestions during session review"
            checked={preferences?.show_ai_insights ?? true}
            onCheckedChange={(v) => updatePreference("show_ai_insights", v)}
            saving={saving === "show_ai_insights"}
          />
        </div>
      </SettingsCard>

      {/* Notifications */}
      <SettingsCard 
        title="Notifications" 
        description="Choose what notifications you receive"
      >
        <div className="space-y-1">
          <PreferenceToggle
            icon={Bell}
            label="Share Notifications"
            description="When someone shares a session with you"
            checked={preferences?.notify_on_share ?? true}
            onCheckedChange={(v) => updatePreference("notify_on_share", v)}
            saving={saving === "notify_on_share"}
          />
          <PreferenceToggle
            icon={Bell}
            label="Comment Notifications"
            description="When someone comments on your content"
            checked={preferences?.notify_on_comment ?? true}
            onCheckedChange={(v) => updatePreference("notify_on_comment", v)}
            saving={saving === "notify_on_comment"}
          />
          <PreferenceToggle
            icon={Bell}
            label="Analysis Complete"
            description="When AI analysis finishes processing"
            checked={preferences?.notify_on_analysis_complete ?? true}
            onCheckedChange={(v) => updatePreference("notify_on_analysis_complete", v)}
            saving={saving === "notify_on_analysis_complete"}
          />
        </div>
      </SettingsCard>

      {/* Blocked Users */}
      <SettingsCard 
        title="Blocked Users" 
        description="Users you've blocked can't interact with your content"
      >
        {blockedUsers.length === 0 ? (
          <div className="py-8 text-center">
            <Ban className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              You haven't blocked anyone yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Block users from their profile or comments
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {blockedUsers.length > 5 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search blocked users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            <div className="divide-y divide-border/20">
              {filteredUsers.map((blocked) => (
                <div
                  key={blocked.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <UserX className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">
                        {blocked.profile?.display_name || "Unknown User"}
                      </span>
                    </div>
                    {blocked.profile?.username && (
                      <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                        @{blocked.profile.username}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnblock(blocked.blocked_user_id)}
                    disabled={unblocking === blocked.blocked_user_id}
                    className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {unblocking === blocked.blocked_user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Unblock
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>

            {filteredUsers.length === 0 && searchQuery && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No blocked users match "{searchQuery}"
              </p>
            )}
          </div>
        )}
      </SettingsCard>

      {/* Data & Privacy */}
      <SettingsCard 
        title="Data & Privacy" 
        description="Manage your data"
      >
        <div className="space-y-1">
          <div className="py-3 border-b border-border/20 last:border-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Export Your Data</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Download a copy of all your data
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Data export will be available soon")}
                className="shrink-0"
              >
                Request Export
              </Button>
            </div>
          </div>
          <div className="py-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Clear Watch History</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Remove your viewing activity
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Watch history cleared")}
                className="shrink-0"
              >
                Clear History
              </Button>
            </div>
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
