/**
 * Privacy Section - Blocked Users Management
 * 
 * QA Checklist:
 * - Prevent blocking self (handled by excluding current user from search)
 * - Prevent duplicate blocks (handled by unique constraint and UI check)
 * - Handle slow network with inline spinners on action buttons
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard, SettingsCardSkeleton } from "../SettingsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Search, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface BlockedUser {
  id: string;
  blocked_user_id: string;
  created_at: string;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface SearchResult {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  updated_at: string;
}

export function PrivacySection() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  
  // Confirm block state
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [blocking, setBlocking] = useState(false);
  
  // Unblock state
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);
  const [pendingUnblock, setPendingUnblock] = useState<BlockedUser | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user) {
      fetchBlockedUsers();
    }
  }, [user]);

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchBlockedUsers = async () => {
    if (!user) return;

    try {
      const { data: blockedData, error } = await supabase
        .from("blocked_users")
        .select("id, blocked_user_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (blockedData && blockedData.length > 0) {
        const blockedIds = blockedData.map(b => b.blocked_user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
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
      console.error("Error fetching blocked users:", error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = useCallback(async (query: string) => {
    if (!user || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, updated_at")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq("user_id", user.id) // Can't block yourself
        .limit(6);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [user]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSelectedUser(null);
    setConfirmingBlock(false);
    setShowResults(true);

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(value);
    }, 300);
  };

  const handleSelectUser = (result: SearchResult) => {
    setSelectedUser(result);
    setSearchQuery(result.username ? `@${result.username}` : result.display_name || "");
    setShowResults(false);
    setConfirmingBlock(false);
  };

  const handleBlockClick = () => {
    if (selectedUser) {
      setConfirmingBlock(true);
    }
  };

  const handleConfirmBlock = async () => {
    if (!user || !selectedUser) return;

    // Prevent blocking self (extra safety check)
    if (selectedUser.user_id === user.id) {
      toast.error("You cannot block yourself.");
      return;
    }

    // Prevent duplicate blocks
    if (isUserBlocked(selectedUser.user_id)) {
      toast.error("User is already blocked.");
      return;
    }

    setBlocking(true);
    try {
      const { error } = await supabase
        .from("blocked_users")
        .insert({
          user_id: user.id,
          blocked_user_id: selectedUser.user_id,
        });

      if (error) {
        // Handle unique constraint violation
        if (error.code === "23505") {
          toast.error("User is already blocked.");
        } else {
          throw error;
        }
        return;
      }

      // Add to list
      setBlockedUsers(prev => [{
        id: crypto.randomUUID(),
        blocked_user_id: selectedUser.user_id,
        created_at: new Date().toISOString(),
        profile: {
          display_name: selectedUser.display_name,
          username: selectedUser.username,
          avatar_url: selectedUser.avatar_url,
        }
      }, ...prev]);

      toast.success(`User blocked.`);
      
      // Reset form
      setSearchQuery("");
      setSelectedUser(null);
      setConfirmingBlock(false);
    } catch (error) {
      console.error("Error blocking user:", error);
      toast.error("Failed to block user");
    } finally {
      setBlocking(false);
    }
  };

  const handleCancelBlock = () => {
    setConfirmingBlock(false);
  };

  const handleUnblock = async (blocked: BlockedUser) => {
    if (!user) return;

    // Store for potential undo
    setPendingUnblock(blocked);
    setUnblocking(blocked.blocked_user_id);

    try {
      const { error } = await supabase
        .from("blocked_users")
        .delete()
        .eq("user_id", user.id)
        .eq("blocked_user_id", blocked.blocked_user_id);

      if (error) throw error;

      // Remove from list
      setBlockedUsers(prev => prev.filter(b => b.blocked_user_id !== blocked.blocked_user_id));
      
      // Show undo toast
      const timeout = setTimeout(() => {
        setPendingUnblock(null);
      }, 5000);
      setUndoTimeout(timeout);

      toast.success("User unblocked.", {
        action: {
          label: "Undo",
          onClick: () => handleUndoUnblock(blocked),
        },
        duration: 5000,
      });
    } catch (error) {
      console.error("Error unblocking user:", error);
      toast.error("Failed to unblock user");
    } finally {
      setUnblocking(null);
    }
  };

  const handleUndoUnblock = async (blocked: BlockedUser) => {
    if (!user) return;

    // Clear undo timeout
    if (undoTimeout) {
      clearTimeout(undoTimeout);
      setUndoTimeout(null);
    }

    try {
      const { error } = await supabase
        .from("blocked_users")
        .insert({
          user_id: user.id,
          blocked_user_id: blocked.blocked_user_id,
        });

      if (error) throw error;

      // Add back to list
      setBlockedUsers(prev => [blocked, ...prev].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      
      toast.success("Unblock undone");
    } catch (error) {
      console.error("Error undoing unblock:", error);
      toast.error("Failed to undo");
    } finally {
      setPendingUnblock(null);
    }
  };

  const isUserBlocked = (userId: string) => {
    return blockedUsers.some(b => b.blocked_user_id === userId);
  };

  const getInitial = (name: string | null) => {
    return name?.charAt(0).toUpperCase() || "?";
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
      <SettingsCard 
        title="Blocked users" 
        description="Blocked users can't interact with you or your content."
      >
        <div className="space-y-6">
          {/* Search + Block */}
          <div ref={searchRef} className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Label htmlFor="block-user-search" className="sr-only">
                  Search username to block
                </Label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="block-user-search"
                  type="text"
                  placeholder="Search username to block…"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                  className="pl-9"
                  aria-describedby="block-search-hint"
                  aria-autocomplete="list"
                  aria-expanded={showResults && searchQuery.length >= 2}
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <Button
                onClick={handleBlockClick}
                disabled={!selectedUser || isUserBlocked(selectedUser.user_id)}
                aria-label={selectedUser ? `Block ${selectedUser.username || selectedUser.display_name}` : "Block user"}
              >
                {selectedUser && isUserBlocked(selectedUser.user_id) ? "Blocked" : "Block"}
              </Button>
            </div>
            <p id="block-search-hint" className="sr-only">
              Type at least 2 characters to search for users
            </p>

            {/* Typeahead Results */}
            {showResults && searchQuery.length >= 2 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground">No users found.</p>
                  </div>
                ) : (
                  <ul className="py-1">
                    {searchResults.map((result) => {
                      const isBlocked = isUserBlocked(result.user_id);
                      return (
                        <li key={result.user_id}>
                          <button
                            onClick={() => handleSelectUser(result)}
                            className={cn(
                              "w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left",
                              isBlocked && "opacity-50"
                            )}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={result.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/20 text-primary text-sm">
                                {getInitial(result.display_name || result.username)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">
                                {result.username ? `@${result.username}` : result.display_name || "Unknown"}
                              </p>
                              {result.display_name && result.username && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {result.display_name}
                                </p>
                              )}
                            </div>
                            {isBlocked && (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                Blocked
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Confirm Block Inline */}
            {confirmingBlock && selectedUser && (
              <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-sm text-foreground mb-3">
                  Block @{selectedUser.username || selectedUser.display_name}? They won't be able to comment or annotate your videos.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelBlock}
                    disabled={blocking}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleConfirmBlock}
                    disabled={blocking}
                  >
                    {blocking ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        Blocking...
                      </>
                    ) : (
                      "Confirm block"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Blocked List - Empty State */}
          {blockedUsers.length === 0 ? (
            <div className="py-8 text-center">
              <Ban className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                You haven't blocked anyone.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {blockedUsers.map((blocked) => (
                <div
                  key={blocked.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={blocked.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                        {getInitial(blocked.profile?.display_name || blocked.profile?.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {blocked.profile?.username ? `@${blocked.profile.username}` : blocked.profile?.display_name || "Unknown User"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Blocked {formatDistanceToNow(new Date(blocked.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnblock(blocked)}
                    disabled={unblocking === blocked.blocked_user_id}
                    className="shrink-0"
                    aria-label={`Unblock ${blocked.profile?.username || blocked.profile?.display_name || "user"}`}
                  >
                    {unblocking === blocked.blocked_user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      "Unblock"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}
