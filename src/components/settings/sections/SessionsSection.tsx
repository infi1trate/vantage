import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard, SettingsCardSkeleton } from "../SettingsCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  Laptop, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Trash2, 
  Loader2, 
  Shield,
  Clock,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface UserSession {
  id: string;
  user_id: string;
  device_info: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_active_at: string;
  created_at: string;
  is_current: boolean;
}

export function SessionsSection() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSessions();
    }
  }, [user]);

  const fetchSessions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("last_active_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      // Don't show error - table might be empty
    } finally {
      setLoading(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    if (!user) return;

    setRevoking(sessionId);
    try {
      const { error } = await supabase
        .from("user_sessions")
        .delete()
        .eq("id", sessionId)
        .eq("user_id", user.id);

      if (error) throw error;

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success("Session revoked");
    } catch (error) {
      console.error("Error revoking session:", error);
      toast.error("Failed to revoke session");
    } finally {
      setRevoking(null);
    }
  };

  const revokeAllSessions = async () => {
    if (!user) return;

    setRevokingAll(true);
    try {
      const { error } = await supabase
        .from("user_sessions")
        .delete()
        .eq("user_id", user.id)
        .eq("is_current", false);

      if (error) throw error;

      setSessions((prev) => prev.filter((s) => s.is_current));
      toast.success("All other sessions revoked");
    } catch (error) {
      console.error("Error revoking sessions:", error);
      toast.error("Failed to revoke sessions");
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return Monitor;
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return Smartphone;
    }
    if (ua.includes("tablet") || ua.includes("ipad")) {
      return Tablet;
    }
    return Laptop;
  };

  const getDeviceName = (userAgent: string | null) => {
    if (!userAgent) return "Unknown Device";
    const ua = userAgent.toLowerCase();
    
    // Browser detection
    let browser = "Unknown Browser";
    if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
    else if (ua.includes("firefox")) browser = "Firefox";
    else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
    else if (ua.includes("edg")) browser = "Edge";
    
    // OS detection
    let os = "";
    if (ua.includes("windows")) os = "Windows";
    else if (ua.includes("mac")) os = "macOS";
    else if (ua.includes("linux")) os = "Linux";
    else if (ua.includes("android")) os = "Android";
    else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
    
    return os ? `${browser} on ${os}` : browser;
  };

  if (loading) {
    return <SettingsCardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <SettingsCard 
        title="Active Sessions" 
        description="Devices where you're currently signed in"
      >
        {sessions.length === 0 ? (
          <div className="py-8 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No active sessions tracked
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Sessions will appear here as you use Vantage
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.length > 1 && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={revokeAllSessions}
                  disabled={revokingAll}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {revokingAll ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Sign Out All Others
                </Button>
              </div>
            )}

            <div className="divide-y divide-border/20">
              {sessions.map((session) => {
                const DeviceIcon = getDeviceIcon(session.user_agent);
                const deviceName = getDeviceName(session.user_agent);
                
                return (
                  <div
                    key={session.id}
                    className={cn(
                      "py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                      session.is_current && "bg-primary/5 -mx-4 sm:-mx-6 px-4 sm:px-6 rounded-lg"
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={cn(
                        "p-2 rounded-lg shrink-0",
                        session.is_current ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        <DeviceIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {deviceName}
                          </span>
                          {session.is_current && (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(session.last_active_at), { addSuffix: true })}
                          </span>
                          {session.ip_address && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {session.ip_address}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!session.is_current && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeSession(session.id)}
                        disabled={revoking === session.id}
                        className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {revoking === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Revoke
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SettingsCard>

      {/* Security Tips */}
      <SettingsCard 
        title="Security Tips" 
        description="Keep your account safe"
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Review your sessions regularly
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                If you see a device you don't recognize, revoke it immediately
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Use a strong, unique password
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Combine letters, numbers, and symbols for best security
              </p>
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
