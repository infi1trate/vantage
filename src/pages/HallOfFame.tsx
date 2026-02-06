/**
 * Hall of Fame - Archive of challenge winners
 * 
 * Displays past winners grouped by challenge/week with prominent winner cards.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { ChallengeEntryCard } from "@/components/challenges/ChallengeEntryCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Calendar, Crown, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";

interface WinnerEntry {
  id: string;
  challenge_id: string;
  session_id: string | null;
  user_id: string;
  title: string | null;
  rank: number | null;
  status: string;
  created_at: string;
  challenge: {
    id: string;
    title: string;
    game_name: string | null;
    thumbnail_url: string | null;
    starts_at: string | null;
    ends_at: string | null;
    difficulty: number | null;
  };
  profile: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  session: {
    id: string;
    thumbnail_url: string | null;
    video_url: string | null;
    duration_seconds: number | null;
  } | null;
}

interface ChallengeGroup {
  challengeId: string;
  challengeTitle: string;
  gameName: string | null;
  thumbnailUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  difficulty: number | null;
  winners: WinnerEntry[];
}

async function fetchHallOfFame(): Promise<WinnerEntry[]> {
  const { data, error } = await supabase
    .from("challenge_submissions")
    .select(`
      id,
      challenge_id,
      session_id,
      user_id,
      title,
      rank,
      status,
      created_at,
      challenges!inner (
        id,
        title,
        game_name,
        thumbnail_url,
        starts_at,
        ends_at,
        difficulty
      ),
      profiles!challenge_submissions_user_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      ),
      capture_sessions (
        id,
        thumbnail_url,
        video_url,
        duration_seconds
      )
    `)
    .eq("status", "winner")
    .order("rank", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Transform to expected shape
  return (data || []).map((row: any) => ({
    id: row.id,
    challenge_id: row.challenge_id,
    session_id: row.session_id,
    user_id: row.user_id,
    title: row.title,
    rank: row.rank,
    status: row.status,
    created_at: row.created_at,
    challenge: row.challenges,
    profile: row.profiles,
    session: row.capture_sessions,
  }));
}

function groupWinnersByChallenge(winners: WinnerEntry[]): ChallengeGroup[] {
  const grouped = new Map<string, ChallengeGroup>();

  for (const winner of winners) {
    const key = winner.challenge_id;
    
    if (!grouped.has(key)) {
      grouped.set(key, {
        challengeId: winner.challenge_id,
        challengeTitle: winner.challenge.title,
        gameName: winner.challenge.game_name,
        thumbnailUrl: winner.challenge.thumbnail_url,
        startDate: winner.challenge.starts_at,
        endDate: winner.challenge.ends_at,
        difficulty: winner.challenge.difficulty,
        winners: [],
      });
    }
    
    grouped.get(key)!.winners.push(winner);
  }

  // Sort groups by end date (most recent first)
  return Array.from(grouped.values()).sort((a, b) => {
    const dateA = a.endDate ? new Date(a.endDate).getTime() : 0;
    const dateB = b.endDate ? new Date(b.endDate).getTime() : 0;
    return dateB - dateA;
  });
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return "Date not set";
  
  try {
    if (startDate && endDate) {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    }
    if (endDate) {
      return `Ended ${format(parseISO(endDate), "MMM d, yyyy")}`;
    }
    return format(parseISO(startDate!), "MMM d, yyyy");
  } catch {
    return "Date unavailable";
  }
}

function DifficultyFlames({ difficulty }: { difficulty: number | null }) {
  const level = Math.min(5, Math.max(1, difficulty || 3));
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Flame
          key={i}
          className={cn(
            "h-3 w-3",
            i < level ? "text-destructive fill-destructive/50" : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

function ChallengeGroupHeader({ group }: { group: ChallengeGroup }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div className="flex items-start gap-4">
        {/* Challenge thumbnail */}
        {group.thumbnailUrl && (
          <div className="hidden sm:block w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted">
            <img
              src={group.thumbnailUrl}
              alt={group.challengeTitle}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="space-y-1">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {group.challengeTitle}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {group.gameName && (
              <Badge variant="secondary" className="text-xs">
                {group.gameName}
              </Badge>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateRange(group.startDate, group.endDate)}
            </span>
            {group.difficulty && (
              <DifficultyFlames difficulty={group.difficulty} />
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline" 
          className="bg-primary/10 text-primary border-primary/30"
        >
          <Crown className="h-3 w-3 mr-1" />
          {group.winners.length} Winner{group.winners.length !== 1 ? "s" : ""}
        </Badge>
      </div>
    </div>
  );
}

function WinnersGrid({ winners }: { winners: WinnerEntry[] }) {
  // Sort by rank (1, 2, 3, etc.)
  const sortedWinners = [...winners].sort((a, b) => (a.rank || 99) - (b.rank || 99));
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
      {sortedWinners.slice(0, 3).map((winner) => (
        <ChallengeEntryCard
          key={winner.id}
          id={winner.id}
          sessionId={winner.session_id || undefined}
          title={winner.title || "Untitled Entry"}
          thumbnailUrl={winner.session?.thumbnail_url}
          videoUrl={winner.session?.video_url}
          clipDurationMs={winner.session?.duration_seconds ? winner.session.duration_seconds * 1000 : undefined}
          creatorId={winner.user_id}
          creatorUsername={winner.profile?.display_name || winner.profile?.username || "Unknown"}
          creatorAvatarUrl={winner.profile?.avatar_url}
          rank={winner.rank as 1 | 2 | 3 | null}
          voteCount={0}
          isChallengeEnded={true}
          status="winner"
        />
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-12">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center gap-4">
            <Skeleton className="hidden sm:block w-16 h-16 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          
          {/* Cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {[1, 2, 3].map((j) => (
              <div key={j} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Trophy className="h-10 w-10 text-primary" />
      </div>
      <h3 className="text-xl font-semibold mb-2">No Winners Yet</h3>
      <p className="text-muted-foreground max-w-md">
        When challenges end and winners are announced, they'll appear here for all to see.
        Be the first to claim glory!
      </p>
    </div>
  );
}

export default function HallOfFame() {
  const { data: winners = [], isLoading, error } = useQuery({
    queryKey: ["hall-of-fame"],
    queryFn: fetchHallOfFame,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const challengeGroups = useMemo(() => groupWinnersByChallenge(winners), [winners]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Hero section */}
      <div className="border-b border-border/30 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container py-8 md:py-12">
          <div className="flex items-center gap-4 mb-3">
            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
                Hall of Fame
              </h1>
              <p className="text-muted-foreground mt-1">
                Celebrating the legends who conquered our challenges
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container flex-1 py-8">
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive">Failed to load Hall of Fame</p>
          </div>
        ) : challengeGroups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-12">
            {challengeGroups.map((group) => (
              <section key={group.challengeId} className="space-y-4">
                <ChallengeGroupHeader group={group} />
                <WinnersGrid winners={group.winners} />
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
