import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard, SettingsCardSkeleton } from "../SettingsCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  Link2, 
  Unlink, 
  Loader2, 
  Check,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ConnectedAccount {
  id: string;
  provider: string;
  provider_account_id: string;
  provider_email: string | null;
  connected_at: string;
  last_used_at: string | null;
}

// Provider configurations
const providers = [
  { 
    id: "google", 
    name: "Google", 
    icon: "G",
    description: "Sign in with Google",
    color: "bg-red-500/10 text-red-500 border-red-500/20"
  },
  { 
    id: "discord", 
    name: "Discord", 
    icon: "D",
    description: "Connect your Discord account",
    color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
  },
  { 
    id: "twitch", 
    name: "Twitch", 
    icon: "T",
    description: "Link your Twitch channel",
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20"
  },
  { 
    id: "youtube", 
    name: "YouTube", 
    icon: "Y",
    description: "Connect for direct uploads",
    color: "bg-red-600/10 text-red-600 border-red-600/20"
  },
];

export function ConnectedAccountsSection() {
  const { user } = useAuth();
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchConnectedAccounts();
    }
  }, [user]);

  const fetchConnectedAccounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("connected_accounts")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      setConnectedAccounts(data || []);
    } catch (error) {
      console.error("Error fetching connected accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (providerId: string) => {
    setConnecting(providerId);
    
    // Simulate OAuth flow - in production this would redirect to OAuth provider
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.info(`${providerId.charAt(0).toUpperCase() + providerId.slice(1)} integration coming soon`);
    setConnecting(null);
  };

  const handleDisconnect = async (providerId: string) => {
    if (!user) return;

    setDisconnecting(providerId);
    try {
      const { error } = await supabase
        .from("connected_accounts")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", providerId);

      if (error) throw error;

      setConnectedAccounts((prev) => prev.filter((a) => a.provider !== providerId));
      toast.success("Account disconnected");
    } catch (error) {
      console.error("Error disconnecting account:", error);
      toast.error("Failed to disconnect account");
    } finally {
      setDisconnecting(null);
    }
  };

  const isConnected = (providerId: string) => {
    return connectedAccounts.some((a) => a.provider === providerId);
  };

  const getConnectedAccount = (providerId: string) => {
    return connectedAccounts.find((a) => a.provider === providerId);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsCardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected Services */}
      <SettingsCard 
        title="Connected Services" 
        description="Link external accounts for enhanced functionality"
      >
        <div className="space-y-1">
          {providers.map((provider) => {
            const connected = isConnected(provider.id);
            const account = getConnectedAccount(provider.id);
            const isConnectingThis = connecting === provider.id;
            const isDisconnectingThis = disconnecting === provider.id;

            return (
              <div
                key={provider.id}
                className="py-4 border-b border-border/20 last:border-0"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center font-bold text-lg border shrink-0",
                      provider.color
                    )}>
                      {provider.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {provider.name}
                        </span>
                        {connected && (
                          <span className="text-xs bg-vantage-success/20 text-vantage-success px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Connected
                          </span>
                        )}
                      </div>
                      {connected && account?.provider_email ? (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {account.provider_email}
                          {account.connected_at && (
                            <span className="ml-2">
                              • Connected {formatDistanceToNow(new Date(account.connected_at), { addSuffix: true })}
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {provider.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {connected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(provider.id)}
                        disabled={isDisconnectingThis}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {isDisconnectingThis ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        ) : (
                          <Unlink className="h-4 w-4 mr-1.5" />
                        )}
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnect(provider.id)}
                        disabled={isConnectingThis}
                      >
                        {isConnectingThis ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        ) : (
                          <Link2 className="h-4 w-4 mr-1.5" />
                        )}
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SettingsCard>

      {/* Integration Benefits */}
      <SettingsCard 
        title="Why Connect?" 
        description="Benefits of linking your accounts"
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <ExternalLink className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                One-click publishing
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share clips directly to YouTube, Twitch, or Discord
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <ExternalLink className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Social sign-in
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quickly sign in with your connected accounts
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <ExternalLink className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Community integration
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Show your linked profiles on your Vantage profile
              </p>
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
