import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProcessing } from "@/contexts/ProcessingContext";
import { useChallengeSession } from "@/contexts/ChallengeSessionContext";
import { Header } from "@/components/layout/Header";
import { SessionCard, UnifiedSession } from "@/components/library/SessionCard";
import { ProcessingSessionCard } from "@/components/library/ProcessingSessionCard";
import { OpenVantageModal } from "@/components/capture/OpenVantageModal";
import { DropboxPromoBanner } from "@/components/library/DropboxPromoBanner";
import { ChallengeSubmitPrompt } from "@/components/challenges/ChallengeSubmitPrompt";
import { SubmissionModal } from "@/components/challenges/SubmissionModal";
import { useCloudSessions } from "@/hooks/useSessionQueries";
import { sessionKeys } from "@/hooks/useSessionQueries";
import { supabase } from "@/integrations/supabase/client";
import { getAllLocalSessions, getStorageUsage, LocalSession, formatBytes } from "@/lib/localSessionStorage";
import { backfillSessionThumbnails } from "@/lib/sessionThumbnailBackfill";
import { useQueryClient } from "@tanstack/react-query";
import { markLibraryRendered } from "@/lib/processingTelemetry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { 
  Loader2, 
  Plus, 
  Search, 
  Grid3X3, 
  List, 
  Video, 
  Filter,
  SortDesc,
  Clock,
  Gamepad2,
  Cloud,
  Monitor,
  CheckCircle2
} from "lucide-react";

type SortOption = "newest" | "oldest" | "longest" | "shortest" | "name";
type FilterStatus = "all" | "ready" | "recording" | "processing" | "failed";
type FilterVisibility = "all" | "private" | "unlisted" | "public";

// Desktop deep link states
type DesktopLinkState = "checking" | "processing" | "found" | "fallback" | null;

export default function SessionLibrary() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Challenge submission prompt handling
  const { 
    challengeContext, 
    completedSessionId, 
    clearChallengeContext, 
    clearCompletedSession 
  } = useChallengeSession();
  const [showChallengePrompt, setShowChallengePrompt] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  
  // Show challenge prompt when returning from a challenge-initiated recording
  useEffect(() => {
    if (challengeContext && completedSessionId) {
      // Slight delay to let the page settle
      const timeout = setTimeout(() => {
        setShowChallengePrompt(true);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [challengeContext, completedSessionId]);
  
  // Desktop deep link handling
  const fromDesktop = searchParams.get("from") === "desktop";
  const recordingId = searchParams.get("recordingId");
  const [desktopLinkState, setDesktopLinkState] = useState<DesktopLinkState>(
    fromDesktop && recordingId ? "checking" : null
  );
  const pollCountRef = useRef(0);
  const maxPolls = 30; // 30 polls × 2s = 60s max wait
  
  // Processing jobs from context
  const { activeJobs, cancelJob, retryJob } = useProcessing();
  
  // Use React Query for cloud sessions - automatic caching and deduplication
  const { 
    data: cloudSessions = [], 
    isLoading: cloudLoading,
    refetch: refetchCloud 
  } = useCloudSessions(user?.id);
  
  const [localSessions, setLocalSessions] = useState<LocalSession[]>([]);
  const [storageUsage, setStorageUsage] = useState<{ count: number; totalBytes: number }>({ count: 0, totalBytes: 0 });
  const [localLoading, setLocalLoading] = useState(true);
  const [showOpenVantage, setShowOpenVantage] = useState(false);
  
  // Filters and view state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterVisibility, setFilterVisibility] = useState<FilterVisibility>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Dropbox backup status: "active" | "needs_attention" | null (not connected)
  const [backupStatus, setBackupStatus] = useState<"active" | "needs_attention" | null>(null);

  // Combined loading state
  const loading = localLoading || (!!user && cloudLoading);
  
  // Get processing jobs that aren't yet in local sessions (avoid duplicates)
  const processingJobsToShow = useMemo(() => {
    const localSessionIds = new Set(localSessions.map(s => s.id));
    return activeJobs.filter(job => 
      !localSessionIds.has(job.sessionId) && 
      (job.status === "queued" || job.status === "processing" || job.status === "uploading" || job.status === "failed")
    );
  }, [activeJobs, localSessions]);

  // Desktop deep link: check for recording and redirect or fallback
  useEffect(() => {
    if (!fromDesktop || !recordingId || desktopLinkState === "found" || desktopLinkState === "fallback") {
      return;
    }

    const checkRecording = async () => {
      try {
        // Check if recording exists in the database
        const { data, error } = await supabase
          .from("capture_sessions")
          .select("id, status")
          .eq("id", recordingId)
          .maybeSingle();

        if (data) {
          // Recording found - redirect to detail page
          setDesktopLinkState("found");
          // Clear query params and navigate
          navigate(`/session/${recordingId}`, { replace: true });
          return;
        }

        // Recording not found yet - check if we should keep polling
        pollCountRef.current += 1;
        
        if (pollCountRef.current >= maxPolls) {
          // Timed out - fall back to library
          console.log(`[SessionLibrary] Desktop recording ${recordingId} not found after ${maxPolls} polls, falling back to library`);
          setDesktopLinkState("fallback");
          // Clear query params
          setSearchParams({}, { replace: true });
          return;
        }

        // Keep polling
        setDesktopLinkState("processing");
      } catch (err) {
        console.error("[SessionLibrary] Error checking desktop recording:", err);
        setDesktopLinkState("fallback");
        setSearchParams({}, { replace: true });
      }
    };

    // Initial check or polling
    checkRecording();

    // Set up polling interval
    const pollInterval = setInterval(checkRecording, 2000);

    return () => clearInterval(pollInterval);
  }, [fromDesktop, recordingId, desktopLinkState, navigate, setSearchParams]);

  // Mark library rendered for telemetry (measures Stop -> Library time)
  useEffect(() => {
    markLibraryRendered();
  }, []);

  // Thumbnail backfill: generate thumbnails for sessions missing them
  const queryClient = useQueryClient();
  const backfillRanRef = useRef(false);
  useEffect(() => {
    if (!user || cloudLoading || cloudSessions.length === 0 || backfillRanRef.current) return;
    backfillRanRef.current = true;

    const needsBackfill = cloudSessions.some(
      (s) => s.status === "ready" && s.video_url && (!s.thumbnail_url || s.thumbnail_url.startsWith("data:"))
    );
    if (!needsBackfill) return;

    backfillSessionThumbnails(
      cloudSessions.map((s) => ({
        id: s.id,
        thumbnail_url: s.thumbnail_url,
        video_url: s.video_url,
        user_id: s.user_id,
        status: s.status,
      }))
    ).then((results) => {
      if (results.size > 0) {
        console.log(`[SessionLibrary] Backfilled ${results.size} thumbnails`);
        // Update query cache so cards re-render with new thumbnails
        queryClient.setQueryData(
          sessionKeys.list(user.id),
          (old: typeof cloudSessions | undefined) =>
            old?.map((s) => (results.has(s.id) ? { ...s, thumbnail_url: results.get(s.id)! } : s))
        );
      }
    });
  }, [user, cloudLoading, cloudSessions, queryClient]);

  useEffect(() => {
    loadLocalSessions();
  }, []);
  
  // Check Dropbox backup status
  useEffect(() => {
    if (!user) {
      setBackupStatus(null);
      return;
    }
    
    const checkBackupStatus = async () => {
      try {
        // Check connection status
        const { data: accountData, error: accountError } = await supabase
          .from("connected_accounts")
          .select("provisioning_status")
          .eq("user_id", user.id)
          .eq("provider", "dropbox")
          .single();
        
        if (accountError || !accountData) {
          setBackupStatus(null); // Not connected
          return;
        }
        
        if (accountData.provisioning_status !== "completed") {
          setBackupStatus("needs_attention");
          return;
        }
        
        // Connected and provisioned - check for failed syncs
        const { count: failedCount } = await supabase
          .from("dropbox_sync_status")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("sync_status", "failed");
        
        if (failedCount && failedCount > 0) {
          setBackupStatus("needs_attention");
        } else {
          setBackupStatus("active");
        }
      } catch {
        setBackupStatus(null);
      }
    };
    
    checkBackupStatus();
  }, [user]);

  const loadLocalSessions = async () => {
    setLocalLoading(true);
    try {
      const [localData, usage] = await Promise.all([
        getAllLocalSessions(),
        getStorageUsage(),
      ]);
      setLocalSessions(localData);
      setStorageUsage(usage);
    } catch (error) {
      console.error("Error loading local sessions:", error);
    } finally {
      setLocalLoading(false);
    }
  };

  const loadCloudSessions = () => {
    refetchCloud();
  };

  const refreshSessions = () => {
    loadLocalSessions();
    loadCloudSessions();
  };

  // Combine local and cloud sessions into unified list
  const unifiedSessions: UnifiedSession[] = useMemo(() => {
    const sessions: UnifiedSession[] = [];
    
    // Add local sessions
    localSessions.forEach(local => {
      sessions.push({ type: "local", data: local });
    });
    
    // Add cloud sessions (avoid duplicates if session exists in both)
    const localIds = new Set(localSessions.map(s => s.id));
    cloudSessions.forEach(cloud => {
      if (!localIds.has(cloud.id)) {
        sessions.push({ type: "cloud", data: cloud });
      }
    });
    
    return sessions;
  }, [localSessions, cloudSessions]);

  // Filter and sort unified sessions
  const filteredSessions = useMemo(() => {
    let result = [...unifiedSessions];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(session => {
        if (session.type === "local") {
          return session.data.title.toLowerCase().includes(query) || 
                 session.data.gameName?.toLowerCase().includes(query);
        } else {
          return session.data.title.toLowerCase().includes(query) || 
                 session.data.game_name?.toLowerCase().includes(query);
        }
      });
    }

    // Status filter (only applies to cloud sessions)
    if (filterStatus !== "all") {
      result = result.filter(session => {
        if (session.type === "local") {
          // Local sessions are always "ready"
          return filterStatus === "ready";
        }
        return session.data.status === filterStatus;
      });
    }

    // Visibility filter (only applies to cloud sessions)
    if (filterVisibility !== "all") {
      result = result.filter(session => {
        if (session.type === "local") {
          // Local sessions are private by default
          return filterVisibility === "private";
        }
        return session.data.visibility === filterVisibility;
      });
    }

    // Sort
    result.sort((a, b) => {
      const getCreatedAt = (s: UnifiedSession) => 
        s.type === "local" ? new Date(s.data.createdAt).getTime() : new Date(s.data.created_at).getTime();
      const getDuration = (s: UnifiedSession) => 
        s.type === "local" ? s.data.duration : s.data.duration_seconds;
      const getTitle = (s: UnifiedSession) => s.data.title;

      switch (sortBy) {
        case "newest":
          return getCreatedAt(b) - getCreatedAt(a);
        case "oldest":
          return getCreatedAt(a) - getCreatedAt(b);
        case "longest":
          return getDuration(b) - getDuration(a);
        case "shortest":
          return getDuration(a) - getDuration(b);
        case "name":
          return getTitle(a).localeCompare(getTitle(b));
        default:
          return 0;
      }
    });

    return result;
  }, [unifiedSessions, searchQuery, sortBy, filterStatus, filterVisibility]);

  // Unified stats
  const stats = useMemo(() => {
    const localDuration = localSessions.reduce((acc, s) => acc + s.duration, 0);
    const cloudDuration = cloudSessions.reduce((acc, s) => acc + s.duration_seconds, 0);
    const processingDuration = processingJobsToShow.reduce((acc, j) => acc + j.duration, 0);
    
    const localGames = new Set(localSessions.filter(s => s.gameName).map(s => s.gameName));
    const cloudGames = new Set(cloudSessions.filter(s => s.game_name).map(s => s.game_name));
    const allGames = new Set([...localGames, ...cloudGames]);
    
    return {
      total: localSessions.length + cloudSessions.length + processingJobsToShow.length,
      processing: processingJobsToShow.length,
      totalDuration: localDuration + cloudDuration + processingDuration,
      uniqueGames: allGames.size,
      storageUsed: storageUsage.totalBytes,
    };
  }, [localSessions, cloudSessions, processingJobsToShow, storageUsage]);

  const formatTotalDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  // Desktop recording processing overlay
  if (desktopLinkState === "checking" || desktopLinkState === "processing") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
              <Monitor className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Processing Upload</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Your desktop recording is being processed. This usually takes just a moment...
            </p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Waiting for recording to appear...</span>
            </div>
            <p className="text-xs text-muted-foreground/60 mt-8">
              Recording ID: {recordingId?.slice(0, 8)}...
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasActiveFilters = searchQuery || filterStatus !== "all" || filterVisibility !== "all";
  const totalSessionCount = localSessions.length + cloudSessions.length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        {/* Dropbox promo banner - only shows if not connected and not dismissed */}
        <DropboxPromoBanner />
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Session Library</h1>
            <p className="text-muted-foreground mt-1">
              {stats.total} sessions • {formatTotalDuration(stats.totalDuration)} total
            </p>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="lg" 
                onClick={() => setShowOpenVantage(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary"
              >
                <Monitor className="mr-2 h-5 w-5" />
                Open Vantage (Desktop)
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Capture runs in the desktop app</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 bg-card border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono-data">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Recordings</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-card border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Clock className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono-data">{formatTotalDuration(stats.totalDuration)}</p>
                <p className="text-xs text-muted-foreground">Total Duration</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-card border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-vantage-warning/10">
                <Gamepad2 className="h-5 w-5 text-vantage-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono-data">{stats.uniqueGames}</p>
                <p className="text-xs text-muted-foreground">Games</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-card border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-vantage-success/10">
                <Video className="h-5 w-5 text-vantage-success" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono-data">{formatBytes(stats.storageUsed)}</p>
                <p className="text-xs text-muted-foreground">Storage Used</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 bg-card border-border/50 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recordings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/50"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
                <SelectTrigger className="w-[140px] bg-muted/50">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="recording">Recording</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterVisibility} onValueChange={(v) => setFilterVisibility(v as FilterVisibility)}>
                <SelectTrigger className="w-[140px] bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Privacy</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[150px] bg-muted/50">
                  <SortDesc className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="longest">Longest</SelectItem>
                  <SelectItem value="shortest">Shortest</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                </SelectContent>
              </Select>

              {/* View Toggle */}
              <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "grid" | "list")}>
                <ToggleGroupItem value="grid" aria-label="Grid view">
                  <Grid3X3 className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              
              {/* Backup status indicator */}
              {backupStatus === "active" && (
                <span className="text-xs text-muted-foreground/60 flex items-center gap-1 ml-2">
                  <Cloud className="h-3 w-3" />
                  Backup: On
                </span>
              )}
              {backupStatus === "needs_attention" && (
                <button 
                  onClick={() => navigate("/settings")}
                  className="text-xs text-muted-foreground/60 hover:text-foreground flex items-center gap-1 ml-2 transition-colors"
                >
                  <Cloud className="h-3 w-3" />
                  Backup: Needs attention
                </button>
              )}
            </div>
          </div>

          {/* Active filters */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
              <span className="text-sm text-muted-foreground">Showing {filteredSessions.length} of {totalSessionCount}:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  "{searchQuery}"
                  <button onClick={() => setSearchQuery("")} className="ml-1 hover:text-foreground">×</button>
                </Badge>
              )}
              {filterStatus !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Status: {filterStatus}
                  <button onClick={() => setFilterStatus("all")} className="ml-1 hover:text-foreground">×</button>
                </Badge>
              )}
              {filterVisibility !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  {filterVisibility}
                  <button onClick={() => setFilterVisibility("all")} className="ml-1 hover:text-foreground">×</button>
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => {
                setSearchQuery("");
                setFilterStatus("all");
                setFilterVisibility("all");
              }}>
                Clear all
              </Button>
            </div>
          )}
        </Card>

        {/* Sessions */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredSessions.length === 0 && processingJobsToShow.length === 0 ? (
          <Card className="p-12 bg-card border-border/50 border-dashed">
            <div className="text-center">
              <Video className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              {totalSessionCount === 0 && processingJobsToShow.length === 0 ? (
                <>
                  <h3 className="text-lg font-semibold mb-2">No recordings yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Start your first capture with the Vantage desktop app
                  </p>
                  <Button onClick={() => setShowOpenVantage(true)}>
                    <Monitor className="mr-2 h-4 w-4" />
                    Open Vantage (Desktop)
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">No matching recordings</h3>
                  <p className="text-muted-foreground mb-6">
                    Try adjusting your search or filters
                  </p>
                  <Button variant="outline" onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                    setFilterVisibility("all");
                  }}>
                    Clear Filters
                  </Button>
                </>
              )}
            </div>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Processing jobs shown first */}
            {processingJobsToShow.map((job) => (
              <ProcessingSessionCard
                key={`processing-${job.id}`}
                job={job}
                viewMode="grid"
                onCancel={cancelJob}
                onRetry={retryJob}
              />
            ))}
            {/* Then all sessions */}
            {filteredSessions.map((session) => (
              <SessionCard 
                key={session.type === "local" ? `local-${session.data.id}` : `cloud-${session.data.id}`}
                session={session}
                onDeleted={refreshSessions}
                viewMode="grid"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Processing jobs shown first */}
            {processingJobsToShow.map((job) => (
              <ProcessingSessionCard
                key={`processing-${job.id}`}
                job={job}
                viewMode="list"
                onCancel={cancelJob}
                onRetry={retryJob}
              />
            ))}
            {/* Then all sessions */}
            {filteredSessions.map((session) => (
              <SessionCard 
                key={session.type === "local" ? `local-${session.data.id}` : `cloud-${session.data.id}`}
                session={session}
                onDeleted={refreshSessions}
                viewMode="list"
              />
            ))}
          </div>
        )}
      </main>

      <OpenVantageModal open={showOpenVantage} onOpenChange={setShowOpenVantage} />
      
      {/* Challenge Submit Prompt - shown after recording from a challenge */}
      {challengeContext && completedSessionId && (
        <ChallengeSubmitPrompt
          open={showChallengePrompt}
          onOpenChange={setShowChallengePrompt}
          challengeId={challengeContext.id}
          challengeTitle={challengeContext.title}
          sessionId={completedSessionId}
          onSubmitNow={() => {
            setShowChallengePrompt(false);
            setShowSubmissionModal(true);
          }}
          onLater={() => {
            setShowChallengePrompt(false);
            clearChallengeContext();
            clearCompletedSession();
          }}
        />
      )}
      
      {/* Submission Modal - for submitting to the challenge */}
      {challengeContext && completedSessionId && (
        <SubmissionModal
          open={showSubmissionModal}
          onOpenChange={(open) => {
            setShowSubmissionModal(open);
            if (!open) {
              // Clear challenge context after modal closes
              clearChallengeContext();
              clearCompletedSession();
            }
          }}
          challenge={{
            id: challengeContext.id,
            title: challengeContext.title,
          } as any}
          selectedSession={{
            id: completedSessionId,
            title: "Recent Recording",
          }}
          onSuccess={() => {
            setShowSubmissionModal(false);
            clearChallengeContext();
            clearCompletedSession();
            navigate(`/challenges/${challengeContext.id}`);
          }}
          onChangeSession={() => {
            // Navigate to challenge detail to pick a different session
            setShowSubmissionModal(false);
            clearChallengeContext();
            clearCompletedSession();
            navigate(`/challenges/${challengeContext.id}`);
          }}
        />
      )}
    </div>
  );
}
