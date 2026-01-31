import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard, SettingsCardSkeleton } from "../SettingsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UserX, Trash2, Loader2, Search, Ban } from "lucide-react";
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

export function PrivacySection() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchBlockedUsers();
    }
  }, [user]);

  const fetchBlockedUsers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("blocked_users")
        .select(`
          id,
          blocked_user_id,
          reason,
          created_at
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for blocked users
      if (data && data.length > 0) {
        const blockedIds = data.map(b => b.blocked_user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", blockedIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        
        setBlockedUsers(data.map(b => ({
          ...b,
          profile: profileMap.get(b.blocked_user_id)
        })));
      } else {
        setBlockedUsers([]);
      }
    } catch (error) {
      console.error("Error fetching blocked users:", error);
      toast.error("Failed to load blocked users");
    } finally {
      setLoading(false);
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
    return <SettingsCardSkeleton />;
  }

  return (
    <div className="space-y-6">
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
                    <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                      Blocked {new Date(blocked.created_at).toLocaleDateString()}
                    </p>
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
        description="Manage your data and privacy settings"
      >
        <div className="space-y-4">
          <div className="py-3 border-b border-border/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Export Your Data</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Download a copy of all your data
                </p>
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
              <div>
                <p className="text-sm font-medium text-foreground">Clear Watch History</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Remove your viewing activity
                </p>
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
