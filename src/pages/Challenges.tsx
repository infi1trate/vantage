import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { ChallengeEmptyState } from "@/components/challenges/ChallengeEmptyState";
import { useChallenges } from "@/hooks/useChallenges";
import { type Challenge, getChallengeStatus } from "@/lib/challenges";
import { 
  Trophy, 
  HelpCircle, 
  Clock, 
  Flame, 
  Crown,
  ArrowRight,
  Sparkles,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Sort active challenges: ending soon first, then by prize, then by submissions
function sortActiveChallenges(challenges: Challenge[]): Challenge[] {
  return [...challenges].sort((a, b) => {
    // First: ending soon (by ends_at ascending)
    if (a.ends_at && b.ends_at) {
      const endA = new Date(a.ends_at).getTime();
      const endB = new Date(b.ends_at).getTime();
      if (endA !== endB) return endA - endB;
    } else if (a.ends_at && !b.ends_at) {
      return -1; // a has deadline, b doesn't
    } else if (!a.ends_at && b.ends_at) {
      return 1; // b has deadline, a doesn't
    }

    // Second: higher prize pools
    const prizeA = a.prize_crypto_amount || 0;
    const prizeB = b.prize_crypto_amount || 0;
    if (prizeA !== prizeB) return prizeB - prizeA;

    // Third: higher submission counts
    const subsA = a.submission_count || 0;
    const subsB = b.submission_count || 0;
    return subsB - subsA;
  });
}

// Sort upcoming by start date
function sortUpcomingChallenges(challenges: Challenge[]): Challenge[] {
  return [...challenges].sort((a, b) => {
    if (a.starts_at && b.starts_at) {
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    }
    return 0;
  });
}

function SectionHeader({ 
  icon: Icon, 
  title, 
  count,
  action,
}: { 
  icon: React.ElementType; 
  title: string; 
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-display text-xl md:text-2xl font-bold tracking-wide">
          {title}
        </h2>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="font-mono">
            {count}
          </Badge>
        )}
      </div>
      {action}
    </div>
  );
}

function ChallengeGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

function HallOfFamePreview({ challenges }: { challenges: Challenge[] }) {
  // Get challenges with winners
  const winnersToShow = challenges.slice(0, 3);

  if (winnersToShow.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {winnersToShow.map((challenge) => (
        <Link
          key={challenge.id}
          to={`/challenges/${challenge.id}`}
          className={cn(
            "group relative flex items-center gap-4 p-4 rounded-xl",
            "border border-border/50 bg-card/30 backdrop-blur-sm",
            "hover:border-primary/50 hover:bg-card/50 transition-all"
          )}
        >
          {/* Thumbnail */}
          <div className="relative h-16 w-24 rounded-lg overflow-hidden shrink-0">
            {challenge.thumbnail_url ? (
              <img
                src={challenge.thumbnail_url}
                alt={challenge.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-muted flex items-center justify-center">
                <Trophy className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <Crown className="absolute bottom-1 right-1 h-4 w-4 text-yellow-500" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
              {challenge.title}
            </h4>
            {challenge.game_name && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {challenge.game_name}
              </p>
            )}
            {challenge.prize_crypto && (
              <p className="text-xs text-primary font-mono mt-1">
                {challenge.prize_crypto_amount} {challenge.prize_crypto}
              </p>
            )}
          </div>

          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </Link>
      ))}
    </div>
  );
}

export default function Challenges() {
  const { data: allChallenges, isLoading } = useChallenges();

  // Categorize challenges
  const { active, upcoming, completed } = useMemo(() => {
    if (!allChallenges) return { active: [], upcoming: [], completed: [] };

    const now = new Date();
    const active: Challenge[] = [];
    const upcoming: Challenge[] = [];
    const completed: Challenge[] = [];

    allChallenges.forEach((challenge) => {
      const status = getChallengeStatus(challenge);
      const startsAt = challenge.starts_at ? new Date(challenge.starts_at) : null;

      if (challenge.status === 'completed') {
        completed.push(challenge);
      } else if (challenge.status === 'active') {
        // Check if it's upcoming (starts in future) or active now
        if (startsAt && now < startsAt) {
          upcoming.push(challenge);
        } else if (status.isOpen) {
          active.push(challenge);
        } else {
          // Ended but not marked completed yet
          completed.push(challenge);
        }
      } else if (challenge.status === 'judging') {
        completed.push(challenge); // Show judging in completed section
      } else if (challenge.status === 'draft' && startsAt && now < startsAt) {
        upcoming.push(challenge);
      }
    });

    return {
      active: sortActiveChallenges(active),
      upcoming: sortUpcomingChallenges(upcoming),
      completed: completed.slice(0, 6), // Limit for preview
    };
  }, [allChallenges]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="px-4 md:px-6 py-8 space-y-12 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <h1 className="font-display text-3xl md:text-4xl font-bold tracking-wide">
                  CHALLENGES
                </h1>
              </div>
              <p className="text-muted-foreground text-lg max-w-xl">
                Complete in-game feats. Submit the moment. Win rewards.
              </p>
            </div>

            {/* How it works link */}
            <Button variant="ghost" size="sm" className="self-start" asChild>
              <Link to="#how-it-works" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <HelpCircle className="h-4 w-4" />
                How it works
              </Link>
            </Button>
          </div>
        </div>

        {/* Active Challenges Section */}
        <section>
          <SectionHeader 
            icon={Flame} 
            title="Active Challenges" 
            count={active.length}
          />
          
          {isLoading ? (
            <ChallengeGridSkeleton count={4} />
          ) : active.length === 0 ? (
            <ChallengeEmptyState
              title="No active challenges right now"
              description="New challenges drop regularly. Check back soon or explore past winners for inspiration!"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {active.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Challenges Section */}
        {(isLoading || upcoming.length > 0) && (
          <section>
            <SectionHeader 
              icon={CalendarClock} 
              title="Upcoming Challenges" 
              count={upcoming.length}
            />
            
            {isLoading ? (
              <ChallengeGridSkeleton count={2} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {upcoming.map((challenge) => (
                  <ChallengeCard 
                    key={challenge.id} 
                    challenge={challenge}
                    className="opacity-80"
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Hall of Fame Preview */}
        {(isLoading || completed.length > 0) && (
          <section className="pt-4 border-t border-border/50">
            <SectionHeader 
              icon={Crown} 
              title="Hall of Fame"
              action={
                completed.length > 3 && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/challenges/hall-of-fame" className="flex items-center gap-2">
                      View All
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )
              }
            />
            
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : completed.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Past challenges will appear here</p>
              </div>
            ) : (
              <HallOfFamePreview challenges={completed} />
            )}
          </section>
        )}

        {/* How it Works (anchor target) */}
        <section id="how-it-works" className="scroll-mt-24 pt-8 border-t border-border/50">
          <SectionHeader icon={HelpCircle} title="How It Works" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Find a Challenge",
                description: "Browse active challenges that match your game and skill level.",
                icon: Trophy,
              },
              {
                step: "2",
                title: "Capture the Moment",
                description: "Record your gameplay and capture the feat required by the challenge.",
                icon: Flame,
              },
              {
                step: "3",
                title: "Submit & Win",
                description: "Submit your clip before the deadline. Winners are selected by the host.",
                icon: Crown,
              },
            ].map((item) => (
              <div
                key={item.step}
                className={cn(
                  "relative p-6 rounded-xl",
                  "border border-border/50 bg-card/30 backdrop-blur-sm"
                )}
              >
                <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-primary text-primary-foreground font-display font-bold text-lg flex items-center justify-center">
                  {item.step}
                </div>
                <item.icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-display text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
