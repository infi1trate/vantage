import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Trophy, Gamepad2, ArrowLeft, Flame, Crown, Medal } from "lucide-react";
import { type Challenge, getChallengeStatus } from "@/lib/challenges";
import { cn } from "@/lib/utils";

interface ChallengeHeroProps {
  challenge: Challenge;
  onSubmit?: () => void;
  canSubmit?: boolean;
  hasSubmitted?: boolean;
}

// Difficulty indicator with flame icons
function DifficultyIndicator({ level }: { level: number }) {
  const maxLevel = 5;
  const normalizedLevel = Math.min(Math.max(level || 1, 1), maxLevel);
  
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1">Difficulty:</span>
      {Array.from({ length: maxLevel }).map((_, i) => (
        <Flame
          key={i}
          className={cn(
            "h-4 w-4 transition-colors",
            i < normalizedLevel ? "text-primary fill-primary" : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

// Countdown timer with live update
function CountdownTimer({ endsAt, startsAt }: { endsAt: string | null; startsAt: string | null }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);
  const [urgency, setUrgency] = useState<"normal" | "warning" | "critical">("normal");

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      
      // Check if challenge hasn't started yet
      if (startsAt) {
        const start = new Date(startsAt);
        if (now < start) {
          const diff = start.getTime() - now.getTime();
          setIsStarting(true);
          setUrgency("normal");
          setTimeLeft(formatTimeLeft(diff));
          return;
        }
      }
      
      // Challenge is active, count down to end
      if (!endsAt) {
        setTimeLeft("No deadline");
        return;
      }
      
      const end = new Date(endsAt);
      const diff = end.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft("Ended");
        setUrgency("critical");
        return;
      }
      
      // Determine urgency
      const hoursLeft = diff / (1000 * 60 * 60);
      if (hoursLeft <= 1) {
        setUrgency("critical");
      } else if (hoursLeft <= 24) {
        setUrgency("warning");
      } else {
        setUrgency("normal");
      }
      
      setIsStarting(false);
      setTimeLeft(formatTimeLeft(diff));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endsAt, startsAt]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm",
        urgency === "critical" && "bg-destructive/10 text-destructive border border-destructive/20",
        urgency === "warning" && "bg-orange-500/10 text-orange-400 border border-orange-500/20",
        urgency === "normal" && "bg-muted/50 text-foreground border border-border/50"
      )}
    >
      <Clock className={cn("h-4 w-4", urgency === "critical" && "animate-pulse")} />
      <span>{isStarting ? "Starts in:" : "Ends in:"}</span>
      <span className="font-bold">{timeLeft}</span>
    </div>
  );
}

function formatTimeLeft(diff: number): string {
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

// Prize breakdown component
function PrizeBreakdown({ 
  prizeDescription, 
  prizeCrypto, 
  prizeCryptoAmount 
}: { 
  prizeDescription: string | null;
  prizeCrypto: string | null;
  prizeCryptoAmount: number | null;
}) {
  if (!prizeDescription && !prizeCrypto) return null;

  // Mock top 3 breakdown (in real app, this would come from challenge data)
  const prizes = prizeCryptoAmount ? [
    { place: 1, icon: Crown, amount: Math.floor(prizeCryptoAmount * 0.5), label: "1st Place" },
    { place: 2, icon: Medal, amount: Math.floor(prizeCryptoAmount * 0.3), label: "2nd Place" },
    { place: 3, icon: Medal, amount: Math.floor(prizeCryptoAmount * 0.2), label: "3rd Place" },
  ] : [];

  return (
    <div className="space-y-3">
      {/* Main prize */}
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Trophy className="h-5 w-5 text-primary" />
        {prizeDescription ? (
          <span className="text-primary">{prizeDescription}</span>
        ) : prizeCrypto && prizeCryptoAmount ? (
          <span className="font-mono text-primary">{prizeCryptoAmount} {prizeCrypto}</span>
        ) : null}
      </div>
      
      {/* Top 3 breakdown */}
      {prizes.length > 0 && prizeCrypto && (
        <div className="flex flex-wrap gap-3">
          {prizes.map((prize) => (
            <div
              key={prize.place}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
                "border border-border/50 bg-card/30",
                prize.place === 1 && "border-primary/30 bg-primary/5"
              )}
            >
              <prize.icon className={cn(
                "h-4 w-4",
                prize.place === 1 ? "text-yellow-500" : "text-muted-foreground"
              )} />
              <span className="text-muted-foreground">{prize.label}:</span>
              <span className="font-mono font-medium">{prize.amount} {prizeCrypto}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChallengeHero({
  challenge,
  onSubmit,
  canSubmit = true,
  hasSubmitted = false,
}: ChallengeHeroProps) {
  const status = getChallengeStatus(challenge);

  return (
    <div className="relative">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        {challenge.thumbnail_url ? (
          <img
            src={challenge.thumbnail_url}
            alt=""
            className="h-full w-full object-cover opacity-20 blur-xl"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/10 to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      <div className="px-4 md:px-6 pt-6 pb-8 space-y-6 max-w-7xl mx-auto">
        {/* Back Link */}
        <Link
          to="/challenges"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Challenges
        </Link>

        {/* Main Header */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Thumbnail */}
          <div className="relative w-full lg:w-80 xl:w-96 shrink-0">
            <div className="aspect-video rounded-xl overflow-hidden border border-border/50 shadow-lg">
              {challenge.thumbnail_url ? (
                <img
                  src={challenge.thumbnail_url}
                  alt={challenge.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Trophy className="h-16 w-16 text-primary/50" />
                </div>
              )}
            </div>
            
            {/* Sponsored badge */}
            {challenge.is_sponsored && challenge.sponsor_name && (
              <Badge variant="secondary" className="absolute bottom-3 left-3">
                Sponsored by {challenge.sponsor_name}
              </Badge>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={status.variant}
                className={cn(
                  "font-semibold uppercase tracking-wider",
                  status.isOpen && "bg-primary text-primary-foreground"
                )}
              >
                {status.label}
              </Badge>

              {challenge.game_name && (
                <Badge variant="secondary">
                  <Gamepad2 className="mr-1 h-3 w-3" />
                  {challenge.game_name}
                </Badge>
              )}
            </div>

            {/* Title */}
            <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">
              {challenge.title}
            </h1>

            {/* Description */}
            {challenge.description && (
              <p className="text-muted-foreground text-lg max-w-2xl">
                {challenge.description}
              </p>
            )}

            {/* Difficulty */}
            <DifficultyIndicator level={challenge.difficulty} />

            {/* Countdown Timer */}
            <CountdownTimer endsAt={challenge.ends_at} startsAt={challenge.starts_at} />

            {/* Prize Breakdown */}
            <PrizeBreakdown 
              prizeDescription={challenge.prize_description}
              prizeCrypto={challenge.prize_crypto}
              prizeCryptoAmount={challenge.prize_crypto_amount}
            />

            {/* Submission Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{challenge.submission_count || 0} submissions</span>
              {challenge.max_submissions_per_user && (
                <span>• Max {challenge.max_submissions_per_user} per person</span>
              )}
            </div>

            {/* CTA Section */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              {status.isOpen ? (
                canSubmit ? (
                  <Button
                    size="lg"
                    onClick={onSubmit}
                    className="font-display uppercase tracking-wider"
                  >
                    <Trophy className="mr-2 h-5 w-5" />
                    Submit a Moment
                  </Button>
                ) : (
                  <Button size="lg" disabled className="font-display uppercase tracking-wider">
                    Max Submissions Reached
                  </Button>
                )
              ) : (
                <Button size="lg" variant="secondary" disabled className="font-display uppercase tracking-wider">
                  Challenge Ended
                </Button>
              )}

              {hasSubmitted && (
                <p className="text-sm text-muted-foreground">
                  You've submitted {hasSubmitted ? "an entry" : ""} to this challenge.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
