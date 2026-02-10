import { useState, useMemo, useCallback } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChallengeHero } from "@/components/challenges/ChallengeHero";
import { ChallengeRulesSection } from "@/components/challenges/ChallengeRulesSection";
import { HowToParticipate } from "@/components/challenges/HowToParticipate";
import { ChallengeEntryCard } from "@/components/challenges/ChallengeEntryCard";
import { 
  SubmissionEntrySheet,
  SubmissionModal,
  SessionPickerModal,
} from "@/components/challenges";
import { useChallenge, useChallengeSubmissions, useUserSubmissions } from "@/hooks/useChallenges";
import { useAuth } from "@/contexts/AuthContext";
import { getChallengeStatus, type ChallengeSubmission } from "@/lib/challenges";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, 
  Clock, 
  Crown, 
  Trophy, 
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectedSession {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
  annotations?: Array<{
    id: string;
    annotation_type: string;
    title?: string | null;
    content?: string | null;
    timestamp_seconds: number;
  }>;
}

// Transform submission to entry card props
function getEntryCardProps(
  submission: ChallengeSubmission,
  profiles?: Map<string, { username: string | null; display_name: string | null; avatar_url: string | null }>
) {
  const profile = profiles?.get(submission.user_id);
  const clipStartMs = submission.clip_start_ms || 0;
  const clipEndMs = submission.clip_end_ms || 0;
  const durationMs = clipEndMs - clipStartMs;

  return {
    id: submission.id,
    sessionId: submission.session_id || undefined,
    title: submission.title || 'Untitled Entry',
    thumbnailUrl: null as string | null, // Would come from session
    videoUrl: null as string | null, // Would come from session  
    clipDurationMs: durationMs,
    creatorId: submission.user_id,
    creatorUsername: profile?.display_name || profile?.username || 'Anonymous',
    creatorAvatarUrl: profile?.avatar_url || null,
    rank: submission.status === 'winner' 
      ? (submission.rank || 'winner' as const)
      : (submission.rank || null),
    voteCount: 0, // Would come from votes table
    hasVoted: false,
    status: submission.status as 'pending' | 'approved' | 'rejected' | 'winner',
    createdAt: submission.created_at,
  };
}

function WinnersPinnedSection({
  winners,
  currentUserId,
}: {
  winners: ChallengeSubmission[];
  currentUserId?: string;
}) {
  if (winners.length === 0) return null;

  // Sort by rank
  const sortedWinners = [...winners].sort((a, b) => (a.rank || 99) - (b.rank || 99));

  return (
    <div className="space-y-4 p-4 md:p-6 rounded-xl border border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-xl flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          Challenge Winners
        </h3>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/challenges/hall-of-fame" className="flex items-center gap-2">
            Hall of Fame
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedWinners.slice(0, 3).map((submission) => {
          const props = getEntryCardProps(submission);
          return (
            <ChallengeEntryCard
              key={submission.id}
              {...props}
              isChallengeEnded={true}
              isOwnEntry={submission.user_id === currentUserId}
            />
          );
        })}
      </div>
    </div>
  );
}

function SubmissionsGrid({
  submissions,
  isLoading,
  isEnded,
  currentUserId,
  onVote,
}: {
  submissions: ChallengeSubmission[];
  isLoading: boolean;
  isEnded: boolean;
  currentUserId?: string;
  onVote: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="font-medium mb-2">No submissions yet</h3>
        <p className="text-sm text-muted-foreground">
          Be the first to submit your moment!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {submissions.map((submission) => {
        const props = getEntryCardProps(submission);
        return (
          <ChallengeEntryCard
            key={submission.id}
            {...props}
            isChallengeEnded={isEnded}
            isOwnEntry={submission.user_id === currentUserId}
            onVote={isEnded ? undefined : () => onVote(submission.id)}
          />
        );
      })}
    </div>
  );
}

export default function ChallengeDetail() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const { user } = useAuth();

  // Data fetching
  const { data: challenge, isLoading: loadingChallenge } = useChallenge(challengeId);
  const { data: allSubmissions, isLoading: loadingSubmissions } = useChallengeSubmissions(challengeId);
  const { data: userSubmissions } = useUserSubmissions(challengeId);

  // UI state
  const [showEntrySheet, setShowEntrySheet] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SelectedSession | null>(null);

  // Derived state
  const status = challenge ? getChallengeStatus(challenge) : null;
  const isEnded = status ? !status.isOpen : false;
  const hasSubmitted = (userSubmissions?.length || 0) > 0;
  const canSubmit = status?.isOpen && 
    (!challenge?.max_submissions_per_user || 
     (userSubmissions?.length || 0) < challenge.max_submissions_per_user);

  // Categorize submissions
  const { approvedSubmissions, winnerSubmissions, rankedSubmissions, newSubmissions } = useMemo(() => {
    if (!allSubmissions) {
      return { 
        approvedSubmissions: [], 
        winnerSubmissions: [], 
        rankedSubmissions: [], 
        newSubmissions: [] 
      };
    }

    const approved = allSubmissions.filter(
      s => s.status === 'approved' || s.status === 'winner'
    );
    
    const winners = approved.filter(s => s.status === 'winner');
    
    // Sort by rank/votes for "Leading" tab
    const ranked = [...approved]
      .filter(s => s.status !== 'winner') // Winners shown separately when ended
      .sort((a, b) => {
        if (a.rank && b.rank) return a.rank - b.rank;
        if (a.rank && !b.rank) return -1;
        if (!a.rank && b.rank) return 1;
        return 0;
      });

    // Sort by newest for "New" tab
    const newest = [...approved]
      .filter(s => s.status !== 'winner')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      approvedSubmissions: approved,
      winnerSubmissions: winners,
      rankedSubmissions: ranked,
      newSubmissions: newest,
    };
  }, [allSubmissions]);

  // Handlers
  const handleSelectFromLibrary = () => {
    setShowSessionPicker(true);
  };

  const handleSessionSelected = useCallback(async (session: SelectedSession) => {
    // Fetch annotations for this session so SubmissionModal can auto-detect proof
    try {
      const { data: annotations } = await supabase
        .from("annotations")
        .select("id, annotation_type, title, content, timestamp_seconds")
        .eq("session_id", session.id)
        .in("annotation_type", ["kill", "death", "highlight", "objective", "save"])
        .order("timestamp_seconds", { ascending: true });

      setSelectedSession({
        ...session,
        annotations: annotations?.map(a => ({
          id: a.id,
          annotation_type: a.annotation_type || "highlight",
          title: a.title,
          content: a.content,
          timestamp_seconds: a.timestamp_seconds,
        })) || [],
      });
    } catch {
      setSelectedSession(session);
    }
    setShowSubmissionModal(true);
  }, []);

  const handleSubmissionSuccess = () => {
    setSelectedSession(null);
    setShowSubmissionModal(false);
  };

  const handleVote = (submissionId: string) => {
    if (isEnded) return;
    console.log("Vote for submission:", submissionId);
    // Would call voting API
  };

  // Redirect if no challenge ID
  if (!challengeId) {
    return <Navigate to="/challenges" replace />;
  }

  // Loading state
  if (loadingChallenge) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="px-4 md:px-6 py-8 space-y-6 max-w-7xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="aspect-video w-full max-w-xl rounded-xl" />
          <Skeleton className="h-12 w-96" />
          <Skeleton className="h-24 w-full max-w-2xl" />
        </div>
      </div>
    );
  }

  if (!challenge) {
    return <Navigate to="/challenges" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <ChallengeHero
        challenge={challenge}
        onSubmit={() => setShowEntrySheet(true)}
        canSubmit={canSubmit}
        hasSubmitted={hasSubmitted}
      />

      {/* Content */}
      <main className="px-4 md:px-6 py-8 space-y-8 max-w-7xl mx-auto">
        {/* Rules Section */}
        <ChallengeRulesSection 
          rules={challenge.rules}
          clipDurationMin={5}
          clipDurationMax={60}
          requiredMomentsMin={challenge.required_moments_min}
          requiredMomentsMax={challenge.required_moments_max}
          momentLabel={challenge.moment_label}
        />

        {/* How to Participate (Collapsible) */}
        <HowToParticipate />

        {/* Winners Section (when ended) */}
        {isEnded && winnerSubmissions.length > 0 && (
          <WinnersPinnedSection
            winners={winnerSubmissions}
            currentUserId={user?.id}
          />
        )}

        {/* Submissions Feed with Tabs */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl md:text-2xl font-bold tracking-wide">
              Submissions
            </h2>
            <Badge variant="secondary" className="font-mono">
              {approvedSubmissions.length}
            </Badge>
          </div>

          <Tabs defaultValue="leading">
            <TabsList>
              <TabsTrigger value="leading" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Leading
              </TabsTrigger>
              <TabsTrigger value="new" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                New
              </TabsTrigger>
            </TabsList>

            <TabsContent value="leading" className="mt-6">
              <SubmissionsGrid
                submissions={rankedSubmissions}
                isLoading={loadingSubmissions}
                isEnded={isEnded}
                currentUserId={user?.id}
                onVote={handleVote}
              />
            </TabsContent>

            <TabsContent value="new" className="mt-6">
              <SubmissionsGrid
                submissions={newSubmissions}
                isLoading={loadingSubmissions}
                isEnded={isEnded}
                currentUserId={user?.id}
                onVote={handleVote}
              />
            </TabsContent>
          </Tabs>
        </section>
      </main>

      {/* Entry Sheet (Decision point) */}
      <SubmissionEntrySheet
        open={showEntrySheet}
        onOpenChange={setShowEntrySheet}
        challenge={challenge}
        onSelectFromLibrary={handleSelectFromLibrary}
      />

      {/* Session Picker */}
      <SessionPickerModal
        open={showSessionPicker}
        onOpenChange={setShowSessionPicker}
        onSelect={handleSessionSelected}
        selectedSessionId={selectedSession?.id}
      />

      {/* Submission Modal */}
      <SubmissionModal
        open={showSubmissionModal}
        onOpenChange={setShowSubmissionModal}
        challenge={challenge}
        selectedSession={selectedSession}
        onSuccess={handleSubmissionSuccess}
        onChangeSession={() => {
          setShowSubmissionModal(false);
          setShowSessionPicker(true);
        }}
      />
    </div>
  );
}
