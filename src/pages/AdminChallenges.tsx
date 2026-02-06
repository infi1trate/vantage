/**
 * Admin Challenges Page
 * 
 * Admin panel for managing challenges. Protected route - requires isChallengeAdmin.
 */

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChallengesTable } from "@/components/admin/ChallengesTable";
import { ChallengesFilters, StatusFilter, TypeFilter } from "@/components/admin/ChallengesFilters";
import {
  useAdminChallenges,
  useAdminPublishChallenge,
  useAdminUnpublishChallenge,
  useAdminEndChallenge,
  useAdminDeleteChallenge,
} from "@/hooks/useAdminChallenges";
import { 
  Trophy, 
  Plus, 
  ArrowLeft,
  Loader2,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminChallenges() {
  const { user, loading: authLoading, isChallengeAdmin } = useAuth();
  const navigate = useNavigate();
  
  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [gameFilter, setGameFilter] = useState("all");

  // Data fetching
  const { data: challenges, isLoading, refetch, isRefetching } = useAdminChallenges();
  
  // Mutations
  const publishMutation = useAdminPublishChallenge();
  const unpublishMutation = useAdminUnpublishChallenge();
  const endMutation = useAdminEndChallenge();
  const deleteMutation = useAdminDeleteChallenge();

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && (!user || !isChallengeAdmin)) {
      toast.error("You don't have access to this page.");
      navigate("/settings", { replace: true });
    }
  }, [authLoading, user, isChallengeAdmin, navigate]);

  // Extract unique games for filter
  const availableGames = useMemo(() => {
    if (!challenges) return [];
    const games = new Set(challenges.map((c) => c.game).filter(Boolean));
    return Array.from(games).sort();
  }, [challenges]);

  // Filter challenges
  const filteredChallenges = useMemo(() => {
    if (!challenges) return [];
    
    return challenges.filter((challenge) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = challenge.title.toLowerCase().includes(query);
        const matchesGame = challenge.game?.toLowerCase().includes(query);
        const matchesSponsor = challenge.sponsor?.name?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesGame && !matchesSponsor) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "draft" && !challenge.isDraft) return false;
        if (statusFilter === "scheduled" && (challenge.isDraft || challenge.status !== "upcoming")) return false;
        if (statusFilter === "active" && (challenge.isDraft || challenge.status !== "active")) return false;
        if (statusFilter === "ended" && challenge.status !== "ended") return false;
      }

      // Type filter
      if (typeFilter !== "all") {
        if (typeFilter === "sponsored" && !challenge.isSponsored) return false;
        if (typeFilter === "community" && challenge.isSponsored) return false;
      }

      // Game filter
      if (gameFilter !== "all" && challenge.game !== gameFilter) return false;

      return true;
    });
  }, [challenges, searchQuery, statusFilter, typeFilter, gameFilter]);

  // Handlers
  const handleEdit = (id: string) => {
    // TODO: Navigate to edit page or open modal
    toast.info("Edit functionality coming soon");
  };

  const handlePublish = (id: string) => {
    publishMutation.mutate(id);
  };

  const handleUnpublish = (id: string) => {
    unpublishMutation.mutate(id);
  };

  const handleEnd = (id: string) => {
    endMutation.mutate(id);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleCreateChallenge = () => {
    // TODO: Navigate to create page or open modal
    toast.info("Create challenge functionality coming soon");
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Show 403 if not admin (fallback before redirect)
  if (!isChallengeAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">
              You don't have permission to access the challenge admin panel.
            </p>
            <Button onClick={() => navigate("/settings")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isMutating = 
    publishMutation.isPending || 
    unpublishMutation.isPending || 
    endMutation.isPending || 
    deleteMutation.isPending;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Page Header */}
      <div className="border-b border-border/30 bg-card/30">
        <div className="container py-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2"
              onClick={() => navigate("/settings")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Settings
            </Button>
            <span>/</span>
            <span>Admin</span>
            <span>/</span>
            <span className="text-foreground">Challenges</span>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl font-bold">Admin — Challenges</h1>
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                    Admin
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Create, manage, and judge challenges
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button onClick={handleCreateChallenge}>
                <Plus className="h-4 w-4 mr-2" />
                Create Challenge
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container flex-1 py-6 space-y-6">
        {/* Filters */}
        <ChallengesFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          gameFilter={gameFilter}
          onGameChange={setGameFilter}
          availableGames={availableGames}
        />

        {/* Stats summary */}
        {challenges && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Showing <span className="text-foreground font-medium">{filteredChallenges.length}</span> of{" "}
              <span className="text-foreground font-medium">{challenges.length}</span> challenges
            </span>
            {isMutating && (
              <span className="flex items-center gap-1 text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating...
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <ChallengesTable
          challenges={filteredChallenges}
          isLoading={isLoading}
          onEdit={handleEdit}
          onPublish={handlePublish}
          onUnpublish={handleUnpublish}
          onEnd={handleEnd}
          onDelete={handleDelete}
        />
      </main>
    </div>
  );
}
