import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { ChallengeEmptyState } from "@/components/challenges/ChallengeEmptyState";
import { HowItWorksModal } from "@/components/challenges/HowItWorksModal";
import { useChallenges } from "@/hooks/useChallenges";
import { type Challenge, getChallengeStatus } from "@/lib/challenges";
import { 
  Trophy, 
  HelpCircle, 
  Flame, 
  Crown,
  ArrowRight,
  Sparkles,
  CalendarClock,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Sorting Utilities
// ============================================================================

function sortActiveChallenges(challenges: Challenge[]): Challenge[] {
  return [...challenges].sort((a, b) => {
    // First: ending soon (by ends_at ascending)
    if (a.ends_at && b.ends_at) {
      const endA = new Date(a.ends_at).getTime();
      const endB = new Date(b.ends_at).getTime();
      if (endA !== endB) return endA - endB;
    } else if (a.ends_at && !b.ends_at) {
      return -1;
    } else if (!a.ends_at && b.ends_at) {
      return 1;
    }

    // Second: higher prize pools
    const prizeA = a.prize_crypto_amount || 0;
    const prizeB = b.prize_crypto_amount || 0;
    if (prizeA !== prizeB) return prizeB - prizeA;

    // Third: higher submission counts
    return (b.submission_count || 0) - (a.submission_count || 0);
  });
}

function sortUpcomingChallenges(challenges: Challenge[]): Challenge[] {
  return [...challenges].sort((a, b) => {
    if (a.starts_at && b.starts_at) {
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    }
    return 0;
  });
}

// ============================================================================
// Sub-components
// ============================================================================

function SectionHeader({ 
  icon: Icon, 
  title, 
  count,
  subtitle,
  action,
}: { 
  icon: React.ElementType; 
  title: string; 
  count?: number;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
      <div className="space-y-1">
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
        {subtitle && (
          <p className="text-sm text-muted-foreground ml-12">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function ChallengeGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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

function PastWinnersPreview({ challenges }: { challenges: Challenge[] }) {
  const winnersToShow = challenges.slice(0, 4);

  if (winnersToShow.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {winnersToShow.map((challenge) => (
        <Link
          key={challenge.id}
          to={`/challenges/${challenge.id}`}
          className={cn(
            "group relative flex items-center gap-3 p-3 rounded-xl",
            "border border-border/50 bg-card/30 backdrop-blur-sm",
            "hover:border-primary/50 hover:bg-card/50 transition-all"
          )}
        >
          {/* Thumbnail */}
          <div className="relative h-14 w-20 rounded-lg overflow-hidden shrink-0">
            {challenge.thumbnail_url ? (
              <img
                src={challenge.thumbnail_url}
                alt={challenge.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-muted flex items-center justify-center">
                <Trophy className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
            <Crown className="absolute bottom-1 right-1 h-3.5 w-3.5 text-primary" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
              {challenge.title}
            </h4>
            {challenge.game_name && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {challenge.game_name}
              </p>
            )}
            {challenge.prize_crypto && (
              <p className="text-xs text-primary font-mono mt-1">
                {challenge.prize_crypto_amount} {challenge.prize_crypto}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function Challenges() {
  const [showHowItWorks, setShowHowItWorks] = useState(false);
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
        if (startsAt && now < startsAt) {
          upcoming.push(challenge);
        } else if (status.isOpen) {
          active.push(challenge);
        } else {
          completed.push(challenge);
        }
      } else if (challenge.status === 'judging') {
        completed.push(challenge);
      } else if (challenge.status === 'draft' && startsAt && now < startsAt) {
        upcoming.push(challenge);
      }
    });

    return {
      active: sortActiveChallenges(active),
      upcoming: sortUpcomingChallenges(upcoming),
      completed,
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
                Compete in gameplay feats. Submit the moment. Win rewards.
              </p>
            </div>

            {/* How it works button */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="self-start text-muted-foreground hover:text-foreground"
              onClick={() => setShowHowItWorks(true)}
            >
              <HelpCircle className="h-4 w-4 mr-2" />
              How it works
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
            <ChallengeGridSkeleton count={3} />
          ) : active.length === 0 ? (
            <ChallengeEmptyState
              title="No active challenges right now"
              description="New challenges drop regularly. Check back soon or explore past winners for inspiration!"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
              subtitle="Submissions open when the challenge starts"
            />
            
            {isLoading ? (
              <ChallengeGridSkeleton count={2} />
            ) : (
              <>
                {/* Disabled submission notice */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>These challenges aren't accepting submissions yet. Check back when they go live!</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {upcoming.map((challenge) => (
                    <ChallengeCard 
                      key={challenge.id} 
                      challenge={challenge}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* Past Winners Preview */}
        {(isLoading || completed.length > 0) && (
          <section className="pt-4 border-t border-border/50">
            <SectionHeader 
              icon={Crown} 
              title="Past Winners"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/challenges/hall-of-fame" className="flex items-center gap-2">
                    View Hall of Fame
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              }
            />
            
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : completed.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Past challenges will appear here</p>
              </div>
            ) : (
              <PastWinnersPreview challenges={completed} />
            )}
          </section>
        )}
      </main>

      {/* How It Works Modal */}
      <HowItWorksModal 
        open={showHowItWorks} 
        onOpenChange={setShowHowItWorks} 
      />
    </div>
  );
}
