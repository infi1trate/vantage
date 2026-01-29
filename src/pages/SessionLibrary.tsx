import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { SessionLibraryCard } from "@/components/library/SessionLibraryCard";
import { NewCaptureDialog } from "@/components/captures/NewCaptureDialog";
import { getSessionsWithAssets, SessionWithAssets } from "@/lib/sessionLibrary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Calendar,
  Gamepad2
} from "lucide-react";

type SortOption = "newest" | "oldest" | "longest" | "shortest" | "name";
type FilterStatus = "all" | "ready" | "recording" | "processing" | "failed";
type FilterVisibility = "all" | "private" | "unlisted" | "public";

export default function SessionLibrary() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [sessions, setSessions] = useState<SessionWithAssets[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCapture, setShowNewCapture] = useState(false);
  
  // Filters and view state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterVisibility, setFilterVisibility] = useState<FilterVisibility>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const data = await getSessionsWithAssets(user.id);
      setSessions(data);
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

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
  }, [sessions, searchQuery, sortBy, filterStatus, filterVisibility]);

  // Stats
  const stats = useMemo(() => {
    const totalDuration = sessions.reduce((acc, s) => acc + s.duration_seconds, 0);
    const uniqueGames = new Set(sessions.filter(s => s.game_name).map(s => s.game_name)).size;
    
    return {
      total: sessions.length,
      ready: sessions.filter(s => s.status === "ready").length,
      totalDuration,
      uniqueGames,
    };
  }, [sessions]);

  const formatTotalDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  if (authLoading || !user) {
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
              {stats.total} sessions • {formatTotalDuration(stats.totalDuration)} total
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 bg-card border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono-data">{stats.total}</p>
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
                <p className="text-2xl font-bold font-mono-data">{stats.ready}</p>
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
              <span className="text-sm text-muted-foreground">Showing {filteredSessions.length} of {sessions.length}:</span>
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
        ) : filteredSessions.length === 0 ? (
          <Card className="p-12 bg-card border-border/50 border-dashed">
            <div className="text-center">
              <Video className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              {sessions.length === 0 ? (
                <>
                  <h3 className="text-lg font-semibold mb-2">No captures yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Start your first capture session to begin analyzing your gameplay
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
            {filteredSessions.map((session) => (
              <SessionLibraryCard 
                key={session.id} 
                session={session} 
                onDeleted={loadSessions}
                viewMode="grid"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((session) => (
              <SessionLibraryCard 
                key={session.id} 
                session={session} 
                onDeleted={loadSessions}
                viewMode="list"
              />
            ))}
          </div>
        )}
      </main>

      <NewCaptureDialog open={showNewCapture} onOpenChange={setShowNewCapture} />
    </div>
  );
}
