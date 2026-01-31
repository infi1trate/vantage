import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProcessing } from "@/contexts/ProcessingContext";
import { Header } from "@/components/layout/Header";
import { SessionCard } from "@/components/library/SessionCard";
import { ProcessingSessionCard } from "@/components/library/ProcessingSessionCard";
import { NewCaptureDialog } from "@/components/captures/NewCaptureDialog";
import { SessionWithAssets } from "@/lib/sessionLibrary";
import { useCloudSessions } from "@/hooks/useSessionQueries";
import { getAllLocalSessions, getStorageUsage, LocalSession, formatBytes } from "@/lib/localSessionStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  HardDrive,
  Gamepad2,
  Cloud
} from "lucide-react";

type SortOption = "newest" | "oldest" | "longest" | "shortest" | "name";
type FilterStatus = "all" | "ready" | "recording" | "processing" | "failed";
type FilterVisibility = "all" | "private" | "unlisted" | "public";
type TabValue = "local" | "cloud";

export default function SessionLibrary() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
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
  const [showNewCapture, setShowNewCapture] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("local");
  
  // Filters and view state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterVisibility, setFilterVisibility] = useState<FilterVisibility>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  useEffect(() => {
    loadLocalSessions();
  }, []);

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

  // Filter and sort local sessions
  const filteredLocalSessions = useMemo(() => {
    let result = [...localSessions];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        s => s.title.toLowerCase().includes(query) || 
             s.gameName?.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "longest":
        result.sort((a, b) => b.duration - a.duration);
        break;
      case "shortest":
        result.sort((a, b) => a.duration - b.duration);
        break;
      case "name":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return result;
  }, [localSessions, searchQuery, sortBy]);

  // Filter and sort cloud sessions
  const filteredCloudSessions = useMemo(() => {
    let result = [...cloudSessions];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        s => s.title.toLowerCase().includes(query) || 
             s.game_name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      result = result.filter(s => s.status === filterStatus);
    }

    // Visibility filter
    if (filterVisibility !== "all") {
      result = result.filter(s => s.visibility === filterVisibility);
    }

    // Sort
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "longest":
        result.sort((a, b) => b.duration_seconds - a.duration_seconds);
        break;
      case "shortest":
        result.sort((a, b) => a.duration_seconds - b.duration_seconds);
        break;
      case "name":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return result;
  }, [cloudSessions, searchQuery, sortBy, filterStatus, filterVisibility]);

  // Stats - include processing jobs in count
  const localStats = useMemo(() => {
    const totalDuration = localSessions.reduce((acc, s) => acc + s.duration, 0);
    const processingDuration = processingJobsToShow.reduce((acc, j) => acc + j.duration, 0);
    const uniqueGames = new Set(localSessions.filter(s => s.gameName).map(s => s.gameName)).size;
    
    return {
      total: localSessions.length + processingJobsToShow.length,
      processing: processingJobsToShow.length,
      totalDuration: totalDuration + processingDuration,
      uniqueGames,
      storageUsed: storageUsage.totalBytes,
    };
  }, [localSessions, processingJobsToShow, storageUsage]);

  const cloudStats = useMemo(() => {
    const totalDuration = cloudSessions.reduce((acc, s) => acc + s.duration_seconds, 0);
    const uniqueGames = new Set(cloudSessions.filter(s => s.game_name).map(s => s.game_name)).size;
    
    return {
      total: cloudSessions.length,
      ready: cloudSessions.filter(s => s.status === "ready").length,
      totalDuration,
      uniqueGames,
    };
  }, [cloudSessions]);

  const formatTotalDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Session Library</h1>
            <p className="text-muted-foreground mt-1">
              {localStats.total + cloudStats.total} sessions • {formatTotalDuration(localStats.totalDuration + cloudStats.totalDuration)} total
            </p>
          </div>
          
          <Button 
            size="lg" 
            onClick={() => setShowNewCapture(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary"
          >
            <Plus className="mr-2 h-5 w-5" />
            New Capture
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="local" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Local ({localStats.total})
            </TabsTrigger>
            <TabsTrigger value="cloud" className="flex items-center gap-2" disabled={!user}>
              <Cloud className="h-4 w-4" />
              Cloud ({cloudStats.total})
            </TabsTrigger>
          </TabsList>

          {/* Local Tab Content */}
          <TabsContent value="local" className="mt-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card className="p-4 bg-card border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Video className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-mono-data">{localStats.total}</p>
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
                    <p className="text-2xl font-bold font-mono-data">{formatTotalDuration(localStats.totalDuration)}</p>
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
                    <p className="text-2xl font-bold font-mono-data">{localStats.uniqueGames}</p>
                    <p className="text-xs text-muted-foreground">Games</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-card border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-vantage-success/10">
                    <HardDrive className="h-5 w-5 text-vantage-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-mono-data">{formatBytes(localStats.storageUsed)}</p>
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
                <div className="flex items-center gap-3">
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
                </div>
              </div>

              {/* Active filters */}
              {searchQuery && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
                  <span className="text-sm text-muted-foreground">Showing {filteredLocalSessions.length} of {localSessions.length}:</span>
                  <Badge variant="secondary" className="gap-1">
                    "{searchQuery}"
                    <button onClick={() => setSearchQuery("")} className="ml-1 hover:text-foreground">×</button>
                  </Badge>
                </div>
              )}
            </Card>

            {/* Sessions */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredLocalSessions.length === 0 && processingJobsToShow.length === 0 ? (
              <Card className="p-12 bg-card border-border/50 border-dashed">
                <div className="text-center">
                  <Video className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  {localSessions.length === 0 && processingJobsToShow.length === 0 ? (
                    <>
                      <h3 className="text-lg font-semibold mb-2">No recordings yet</h3>
                      <p className="text-muted-foreground mb-6">
                        Start your first capture to begin recording gameplay
                      </p>
                      <Button onClick={() => setShowNewCapture(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Capture
                      </Button>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold mb-2">No matching recordings</h3>
                      <p className="text-muted-foreground mb-6">
                        Try adjusting your search
                      </p>
                      <Button variant="outline" onClick={() => setSearchQuery("")}>
                        Clear Search
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
                {/* Then completed local sessions */}
                {filteredLocalSessions.map((session) => (
                  <SessionCard 
                    key={session.id} 
                    session={{ type: "local", data: session }}
                    onDeleted={loadLocalSessions}
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
                {/* Then completed local sessions */}
                {filteredLocalSessions.map((session) => (
                  <SessionCard 
                    key={session.id} 
                    session={{ type: "local", data: session }}
                    onDeleted={loadLocalSessions}
                    viewMode="list"
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Cloud Tab Content */}
          <TabsContent value="cloud" className="mt-6">
            {!user ? (
              <Card className="p-12 bg-card border-border/50 border-dashed">
                <div className="text-center">
                  <Cloud className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sign in to access cloud sessions</h3>
                  <p className="text-muted-foreground mb-6">
                    Cloud sync allows you to access your recordings from any device
                  </p>
                  <Button onClick={() => navigate("/auth")}>
                    Sign In
                  </Button>
                </div>
              </Card>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <Card className="p-4 bg-card border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Video className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold font-mono-data">{cloudStats.total}</p>
                        <p className="text-xs text-muted-foreground">Total Sessions</p>
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-4 bg-card border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-vantage-success/10">
                        <Video className="h-5 w-5 text-vantage-success" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold font-mono-data">{cloudStats.ready}</p>
                        <p className="text-xs text-muted-foreground">Ready</p>
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-4 bg-card border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-accent/10">
                        <Clock className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold font-mono-data">{formatTotalDuration(cloudStats.totalDuration)}</p>
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
                        <p className="text-2xl font-bold font-mono-data">{cloudStats.uniqueGames}</p>
                        <p className="text-xs text-muted-foreground">Games</p>
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
                        placeholder="Search sessions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-muted/50"
                      />
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-3">
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
                    </div>
                  </div>

                  {/* Active filters */}
                  {(searchQuery || filterStatus !== "all" || filterVisibility !== "all") && (
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
                      <span className="text-sm text-muted-foreground">Showing {filteredCloudSessions.length} of {cloudSessions.length}:</span>
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
                ) : filteredCloudSessions.length === 0 ? (
                  <Card className="p-12 bg-card border-border/50 border-dashed">
                    <div className="text-center">
                      <Video className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      {cloudSessions.length === 0 ? (
                        <>
                          <h3 className="text-lg font-semibold mb-2">No cloud sessions yet</h3>
                          <p className="text-muted-foreground mb-6">
                            Your recordings will be synced to the cloud when you're online
                          </p>
                          <Button onClick={() => setShowNewCapture(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create First Capture
                          </Button>
                        </>
                      ) : (
                        <>
                          <h3 className="text-lg font-semibold mb-2">No matching sessions</h3>
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
                    {filteredCloudSessions.map((session) => (
                      <SessionCard 
                        key={session.id} 
                        session={{ type: "cloud", data: session }}
                        onDeleted={loadCloudSessions}
                        viewMode="grid"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredCloudSessions.map((session) => (
                      <SessionCard 
                        key={session.id} 
                        session={{ type: "cloud", data: session }}
                        onDeleted={loadCloudSessions}
                        viewMode="list"
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <NewCaptureDialog open={showNewCapture} onOpenChange={setShowNewCapture} />
    </div>
  );
}
