/**
 * Connected Accounts Section - OAuth Provider Management
 * 
 * QA Checklist:
 * - Show all providers with "Not connected" status when not linked
 * - Handle slow network with inline spinners on connect/disconnect buttons
 * - Proper toasts for success/error states
 * - Dropbox uses real OAuth flow
 */

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard } from "../SettingsCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Check, ExternalLink, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { startDropboxOAuth, disconnectDropbox, type DropboxOAuthResult } from "@/lib/dropboxOAuth";
import { DropboxSyncStatus } from "./DropboxSyncStatus";

interface ConnectedAccount {
  id: string;
  provider: string;
  provider_account_id: string;
  provider_email: string | null;
  connected_at: string;
  last_used_at: string | null;
  provisioning_status?: string | null;
}

// Provider icons as simple SVG components
const ProviderIcons: Record<string, React.FC<{ className?: string }>> = {
  steam: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.936 3.592 9.027 8.305 9.828L12 17l1.695 4.828C18.408 21.027 22 16.936 22 12c0-5.523-4.477-10-10-10zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
    </svg>
  ),
  riot: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12.534 21.77l-1.09-2.81 10.52.54-.451 4.5zM15.06 2L3 5.26l1.59 13.46 4.51-.28 1.07 2.1L22 21l-.85-7.05L22 7.32l-4.21-.24z"/>
    </svg>
  ),
  roblox: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M5.164 0L0 18.627 18.836 24 24 5.373 5.164 0zM13.69 15.267l-5.199-1.33 1.335-5.2 5.199 1.33-1.335 5.2z"/>
    </svg>
  ),
  twitch: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
    </svg>
  ),
  xbox: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M4.102 21.033C6.211 22.881 8.977 24 12 24c3.026 0 5.789-1.119 7.902-2.967 1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.073-14.02c2.316 3.064 6.549 9.276 4.918 11.025C22.009 16.015 24 13.214 24 10c0-2.091-.68-4.023-1.824-5.604-.655-.088-3.882-.461-7.001 2.617zM12 2.953c-.901 1.097-3.088 3.5-5.146 6.001C5.498 7.312 3.619 6.99 2.95 6.91 1.541 8.4.652 10.362.652 12.519c0 1.4.349 2.721.965 3.881 1.656-3.108 7.472-10.14 10.383-13.447zm-1.598-.197C7.19 5.84 1.328 12.876-.393 16.012c1.105 2.182 2.968 3.949 5.242 4.947 1.063-1.014 4.12-4.341 6.736-8.121 2.617 3.78 5.672 7.107 6.736 8.121 2.274-.998 4.137-2.765 5.242-4.947-1.721-3.136-7.583-10.172-10.795-13.256l-.366.443-.366-.443z"/>
    </svg>
  ),
  discord: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  ),
  tiktok: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  ),
  x: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  facebook: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  reddit: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  ),
  apple: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
    </svg>
  ),
  dropbox: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M6 1.807L0 5.629l6 3.822 6.011-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.011-3.822L6 9.452l-6 3.822zM18 9.452l-6.011 3.822 6.011 3.822 6-3.822-6-3.822zM6.011 18.152l6 3.822 6-3.822-6-3.822-6 3.822z"/>
    </svg>
  ),
};

// Provider configurations grouped by category
const providerGroups = [
  {
    label: "Gaming",
    providers: [
      { id: "steam", name: "Steam", color: "bg-[#1b2838]/20 text-[#66c0f4]" },
      { id: "riot", name: "Riot", color: "bg-[#d13639]/20 text-[#d13639]" },
      { id: "roblox", name: "Roblox", color: "bg-[#e2231a]/20 text-[#e2231a]" },
      { id: "twitch", name: "Twitch", color: "bg-purple-500/20 text-purple-400" },
      { id: "xbox", name: "Xbox", color: "bg-[#107c10]/20 text-[#107c10]" },
    ],
  },
  {
    label: "Social",
    providers: [
      { id: "discord", name: "Discord", color: "bg-[#5865f2]/20 text-[#5865f2]" },
      { id: "tiktok", name: "TikTok", color: "bg-foreground/20 text-foreground" },
      { id: "x", name: "X", color: "bg-foreground/20 text-foreground" },
      { id: "facebook", name: "Facebook", color: "bg-[#1877f2]/20 text-[#1877f2]" },
      { id: "reddit", name: "Reddit", color: "bg-[#ff4500]/20 text-[#ff4500]" },
    ],
  },
  {
    label: "Apple",
    providers: [
      { id: "apple", name: "Apple", color: "bg-foreground/20 text-foreground" },
    ],
  },
  {
    label: "Storage",
    providers: [
      { id: "dropbox", name: "Dropbox", color: "bg-[#0061ff]/20 text-[#0061ff]" },
    ],
  },
];

export function ConnectedAccountsSection() {
  const { user } = useAuth();
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Connect flow state
  const [confirmingConnect, setConfirmingConnect] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  
  // Disconnect flow state
  const [confirmingDisconnect, setConfirmingDisconnect] = useState<string | null>(null);
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

  const handleConnectClick = (providerId: string) => {
    setConfirmingConnect(providerId);
    setConfirmingDisconnect(null);
  };

  const handleCancelConnect = () => {
    setConfirmingConnect(null);
  };

  const handleContinueConnect = async (providerId: string) => {
    if (!user) return;

    setConnecting(providerId);
    setConfirmingConnect(null);

    try {
      // Handle Dropbox with real OAuth
      if (providerId === "dropbox") {
        const result: DropboxOAuthResult = await startDropboxOAuth();
        
        if (result.success) {
          // Refresh connected accounts
          await fetchConnectedAccounts();
          
          // Show success with provisioning status
          if (result.provisioned) {
            toast.success("Connected to Dropbox", {
              description: result.email ? `Signed in as ${result.email}. Storage ready.` : "Storage provisioned successfully.",
            });
          } else {
            // Connection succeeded but provisioning failed
            toast.warning("Connected to Dropbox with limited functionality", {
              description: result.provisioningError || "Storage setup failed. You can retry in settings.",
            });
          }
        } else {
          toast.error("Failed to connect Dropbox", {
            description: result.error || "Please try again",
          });
        }
        setConnecting(null);
        return;
      }

      // For other providers, use mock OAuth flow (to be implemented)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const providerName = providerGroups
        .flatMap(g => g.providers)
        .find(p => p.id === providerId)?.name || providerId;

      // Add to connected accounts (mock for non-Dropbox)
      const newAccount: ConnectedAccount = {
        id: crypto.randomUUID(),
        provider: providerId,
        provider_account_id: `${providerId}_${Date.now()}`,
        provider_email: `user@${providerId}.com`,
        connected_at: new Date().toISOString(),
        last_used_at: null,
      };

      const { error } = await supabase
        .from("connected_accounts")
        .insert({
          user_id: user.id,
          provider: providerId,
          provider_account_id: newAccount.provider_account_id,
          provider_email: newAccount.provider_email,
        });

      if (error) throw error;

      setConnectedAccounts(prev => [...prev, newAccount]);
      toast.success(`Connected to ${providerName}`);
    } catch (error) {
      console.error("Error connecting account:", error);
      toast.error("Failed to connect account");
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnectClick = (providerId: string) => {
    setConfirmingDisconnect(providerId);
    setConfirmingConnect(null);
  };

  const handleCancelDisconnect = () => {
    setConfirmingDisconnect(null);
  };

  const handleConfirmDisconnect = async (providerId: string) => {
    if (!user) return;

    setDisconnecting(providerId);
    setConfirmingDisconnect(null);

    const providerName = providerGroups
      .flatMap(g => g.providers)
      .find(p => p.id === providerId)?.name || providerId;

    try {
      // Handle Dropbox with edge function (to clean up tokens)
      if (providerId === "dropbox") {
        const result = await disconnectDropbox();
        
        if (!result.success) {
          // Fall back to direct DB delete if edge function fails
          console.warn("[ConnectedAccounts] Edge function disconnect failed, falling back to direct delete");
        }
      }

      // Always delete from connected_accounts
      const { error } = await supabase
        .from("connected_accounts")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", providerId);

      if (error) throw error;

      setConnectedAccounts(prev => prev.filter(a => a.provider !== providerId));
      toast.success(`Disconnected from ${providerName}`);
    } catch (error) {
      console.error("Error disconnecting account:", error);
      toast.error("Failed to disconnect account");
    } finally {
      setDisconnecting(null);
    }
  };

  const isConnected = (providerId: string) => {
    return connectedAccounts.some(a => a.provider === providerId);
  };

  const getConnectedAccount = (providerId: string) => {
    return connectedAccounts.find(a => a.provider === providerId);
  };

  const getProviderDisplayName = (providerId: string) => {
    return providerGroups
      .flatMap(g => g.providers)
      .find(p => p.id === providerId)?.name || providerId;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsCard 
          title="Connected accounts" 
          description="Connect your accounts to import identity and share exports faster."
        >
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i}>
                <Skeleton className="h-4 w-20 mb-3" />
                <div className="space-y-2">
                  {[1, 2].map(j => (
                    <div key={j} className="py-3 flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>
      </div>
    );
  }

  // Check if Dropbox is connected for sync status display
  const dropboxConnected = isConnected("dropbox");

  return (
    <div className="space-y-6">
      {/* Dropbox Sync Status - only shown when connected */}
      <DropboxSyncStatus isConnected={dropboxConnected} />

      <SettingsCard 
        title="Connected accounts" 
        description="Connect your accounts to import identity and share exports faster."
      >
        <div className="space-y-6">
          {providerGroups.map((group) => (
            <div key={group.label}>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {group.label}
              </h4>
              <div className="divide-y divide-border/20">
                {group.providers.map((provider) => {
                  const connected = isConnected(provider.id);
                  const account = getConnectedAccount(provider.id);
                  const IconComponent = ProviderIcons[provider.id];
                  const isConfirmingConnect = confirmingConnect === provider.id;
                  const isConfirmingDisconnect = confirmingDisconnect === provider.id;
                  const isConnecting = connecting === provider.id;
                  const isDisconnecting = disconnecting === provider.id;

                  return (
                    <div key={provider.id}>
                      <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                            provider.color
                          )}>
                            {IconComponent && <IconComponent className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">
                                {provider.name}
                              </span>
                              {connected && (
                                <>
                                  {/* Dropbox shows different status based on provisioning */}
                                  {provider.id === "dropbox" ? (
                                    account?.provisioning_status === "completed" ? (
                                      <span className="text-xs bg-vantage-success/20 text-vantage-success px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Check className="h-3 w-3" />
                                        Connected (Active)
                                      </span>
                                    ) : (
                                      <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Connected (Needs permission)
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-xs bg-vantage-success/20 text-vantage-success px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Check className="h-3 w-3" />
                                      Connected
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            {connected && account ? (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {account.provider_email || account.provider_account_id}
                                {account.connected_at && (
                                  <span className="hidden sm:inline ml-2">
                                    • Connected on {format(new Date(account.connected_at), "MMM d, yyyy")}
                                  </span>
                                )}
                                {/* Show provisioning issue hint for Dropbox */}
                                {provider.id === "dropbox" && account.provisioning_status !== "completed" && (
                                  <span className="hidden sm:inline ml-2 text-amber-500">
                                    • Reconnect to grant folder permissions
                                  </span>
                                )}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Connect to enable faster sharing and attribution.
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          {connected ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDisconnectClick(provider.id)}
                                disabled={isDisconnecting || isConfirmingDisconnect}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                aria-label={`Disconnect ${provider.name}`}
                              >
                                {isDisconnecting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : (
                                  "Disconnect"
                                )}
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConnectClick(provider.id)}
                              disabled={isConnecting || isConfirmingConnect}
                              aria-label={`Connect ${provider.name}`}
                            >
                              {isConnecting ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                "Connect"
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Inline Connect Confirmation */}
                      {isConfirmingConnect && (
                        <div className="pb-3 pl-13 sm:pl-13">
                          <div className="p-3 rounded-lg bg-muted/50 border border-border/50 ml-13">
                            <div className="flex items-start gap-2 mb-3">
                              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                              <p className="text-sm text-foreground">
                                You'll be redirected to {provider.name} to authorize Vantage.
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelConnect}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleContinueConnect(provider.id)}
                              >
                                Continue
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Inline Disconnect Confirmation */}
                      {isConfirmingDisconnect && (
                        <div className="pb-3 pl-13 sm:pl-13">
                          <div className="p-3 rounded-lg bg-muted/50 border border-border/50 ml-13">
                            <p className="text-sm text-foreground mb-3">
                              Disconnect {provider.name}? This will stop syncing and remove the connection from Vantage.
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelDisconnect}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleConfirmDisconnect(provider.id)}
                              >
                                Disconnect
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}
