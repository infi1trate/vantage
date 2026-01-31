import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard, SettingsCardSkeleton } from "../SettingsCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Laptop, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Loader2, 
  Shield,
  Clock,
  MapPin,
  Globe
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

interface ParsedDevice {
  device: string;
  browser: string;
  os: string;
}

export function SessionsSection() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState<string | null>(null);

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
    } finally {
      setLoading(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    if (!user) return;

    setRevoking(sessionId);
    
    // Optimistically remove from UI
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setConfirmingRevoke(null);

    try {
      const { error } = await supabase
        .from("user_sessions")
        .delete()
        .eq("id", sessionId)
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Session revoked.");
    } catch (error) {
      console.error("Error revoking session:", error);
      toast.error("Failed to revoke session");
      // Refetch on error to restore state
      fetchSessions();
    } finally {
      setRevoking(null);
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

  const parseUserAgent = (userAgent: string | null): ParsedDevice => {
    if (!userAgent) return { device: "Unknown Device", browser: "Unknown", os: "" };
    const ua = userAgent.toLowerCase();
    
    // Device detection
    let device = "Desktop";
    if (ua.includes("iphone")) device = "iPhone";
    else if (ua.includes("ipad")) device = "iPad";
    else if (ua.includes("android")) {
      if (ua.includes("mobile")) device = "Android Phone";
      else device = "Android Tablet";
    } else if (ua.includes("macintosh") || ua.includes("mac os")) device = "MacBook";
    else if (ua.includes("windows")) device = "Windows PC";
    else if (ua.includes("linux")) device = "Linux PC";
    
    // Browser detection
    let browser = "Unknown";
    if (ua.includes("edg/") || ua.includes("edge/")) browser = "Edge";
    else if (ua.includes("chrome/") && !ua.includes("chromium")) browser = "Chrome";
    else if (ua.includes("firefox/")) browser = "Firefox";
    else if (ua.includes("safari/") && !ua.includes("chrome")) browser = "Safari";
    else if (ua.includes("opera") || ua.includes("opr/")) browser = "Opera";
    
    // OS detection
    let os = "";
    if (ua.includes("windows nt 10")) os = "Windows 10/11";
    else if (ua.includes("windows")) os = "Windows";
    else if (ua.includes("mac os x")) os = "macOS";
    else if (ua.includes("android")) {
      const match = ua.match(/android\s+([\d.]+)/);
      os = match ? `Android ${match[1]}` : "Android";
    }
    else if (ua.includes("iphone os") || ua.includes("ipad")) {
      const match = ua.match(/os\s+([\d_]+)/);
      os = match ? `iOS ${match[1].replace(/_/g, ".")}` : "iOS";
    }
    else if (ua.includes("linux")) os = "Linux";
    
    return { device, browser, os };
  };

  // Mock location from IP - in production this would come from server
  const getLocationDisplay = (session: UserSession): string => {
    // If we have device_info that contains location, use it
    if (session.device_info) {
      try {
        const info = JSON.parse(session.device_info);
        if (info.location) return info.location;
      } catch {
        // Not JSON, might be a string location
        if (session.device_info.includes(",")) return session.device_info;
      }
    }
    return "—";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsCard 
          title="Active sessions" 
          description="See where you're signed in. Revoke any session you don't recognize."
        >
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-4 flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </SettingsCard>
      </div>
    );
  }

  const hasOnlyCurrent = sessions.length === 1 && sessions[0]?.is_current;

  return (
    <div className="space-y-6">
      <SettingsCard 
        title="Active sessions" 
        description="See where you're signed in. Revoke any session you don't recognize."
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
          <div className="space-y-2">
            {/* Session List */}
            <div className="divide-y divide-border/20">
              {sessions.map((session) => {
                const DeviceIcon = getDeviceIcon(session.user_agent);
                const parsed = parseUserAgent(session.user_agent);
                const location = getLocationDisplay(session);
                const isConfirming = confirmingRevoke === session.id;
                
                return (
                  <div key={session.id}>
                    <div
                      className={cn(
                        "py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                        session.is_current && "bg-primary/5 -mx-4 sm:-mx-6 px-4 sm:px-6 rounded-lg"
                      )}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={cn(
                          "p-2.5 rounded-lg shrink-0",
                          session.is_current ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          <DeviceIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">
                              {parsed.device}
                            </span>
                            {session.is_current && (
                              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                            <span className="text-xs text-muted-foreground">
                              {parsed.browser}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {location}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(session.last_active_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                      {!session.is_current && !isConfirming && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmingRevoke(session.id)}
                          disabled={revoking === session.id}
                          className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {revoking === session.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Revoke"
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Inline Confirmation */}
                    {isConfirming && (
                      <div className="pb-4 pl-14 pr-4 sm:pr-6">
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                          <p className="text-sm text-foreground mb-3">
                            Revoke this session?
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmingRevoke(null)}
                              disabled={revoking === session.id}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => revokeSession(session.id)}
                              disabled={revoking === session.id}
                            >
                              {revoking === session.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                  Revoking...
                                </>
                              ) : (
                                "Revoke"
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Single Session Note */}
            {hasOnlyCurrent && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                This is your only active session.
              </p>
            )}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
