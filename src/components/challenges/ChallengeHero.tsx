import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Trophy, Gamepad2, ArrowLeft, Flame, Crown, Medal, Sparkles } from "lucide-react";
import { type Challenge, getChallengeStatus } from "@/lib/challenges";
import { cn } from "@/lib/utils";

interface ChallengeHeroProps {
  challenge: Challenge;
  onSubmit?: () => void;
  canSubmit?: boolean;
  hasSubmitted?: boolean;
}

// Difficulty indicator with flame icons (using semantic colors)
function DifficultyIndicator({ level }: { level: number }) {
  const maxLevel = 5;
  const normalizedLevel = Math.min(Math.max(level || 1, 1), maxLevel);
  const labels = ['Easy', 'Normal', 'Hard', 'Expert', 'Legendary'];
  
  return (
    <div 
      className="flex items-center gap-1" 
      title={`Difficulty: ${labels[normalizedLevel - 1]}`}
    >
      <span className="text-xs text-muted-foreground mr-1">Difficulty:</span>
      {Array.from({ length: maxLevel }).map((_, i) => (
        <Flame
          key={i}
          className={cn(
            "h-4 w-4 transition-colors",
            i < normalizedLevel 
              ? "text-primary fill-primary/30" 
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

// Countdown timer with live update - uses ref pattern for stability
function CountdownTimer({ endsAt, startsAt }: { endsAt: string | null; startsAt: string | null }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);
  const [urgency, setUrgency] = useState<"normal" | "warning" | "critical">("normal");
  
  // Use refs to avoid stale closure issues
  const endsAtRef = useRef(endsAt);
  const startsAtRef = useRef(startsAt);
  
  useEffect(() => {
    endsAtRef.current = endsAt;
    startsAtRef.current = startsAt;
  }, [endsAt, startsAt]);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      
      // Check if challenge hasn't started yet
      if (startsAtRef.current) {
        const start = new Date(startsAtRef.current);
        if (now < start) {
          const diff = start.getTime() - now.getTime();
          setIsStarting(true);
          setUrgency("normal");
          setTimeLeft(formatTimeLeft(diff));
          return;
        }
      }
      
      // Challenge is active, count down to end
      if (!endsAtRef.current) {
        setTimeLeft("No deadline");
        setUrgency("normal");
        return;
      }
      
      const end = new Date(endsAtRef.current);
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
  }, []);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm",
        urgency === "critical" && "bg-destructive/10 text-destructive border border-destructive/20",
        urgency === "warning" && "bg-primary/10 text-primary border border-primary/20",
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
interface PrizeEntry {
  rank: number;
  amount: number;
  currency: string;
}

function parsePrizeDescription(raw: string | null): PrizeEntry[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].rank != null) {
      return parsed as PrizeEntry[];
    }
  } catch {
    // Not JSON — treat as plain text (handled by caller)
  }
  return null;
}

const RANK_META: Record<number, { label: string; icon: typeof Crown; gold: boolean }> = {
  1: { label: "1st Place", icon: Crown, gold: true },
  2: { label: "2nd Place", icon: Medal, gold: false },
  3: { label: "3rd Place", icon: Medal, gold: false },
};

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

  // Try to parse structured prize data from prize_description JSON
  const structured = parsePrizeDescription(prizeDescription);

  // If structured prizes exist, render them directly
  if (structured && structured.length > 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="text-primary">Prize Breakdown</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {structured.sort((a, b) => a.rank - b.rank).map((prize) => {
            const meta = RANK_META[prize.rank] || { label: `#${prize.rank}`, icon: Medal, gold: false };
            const Icon = meta.icon;
            return (
              <div
                key={prize.rank}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
                  "border border-border/50 bg-card/30",
                  meta.gold && "border-primary/30 bg-primary/5"
                )}
              >
                <Icon className={cn("h-4 w-4", meta.gold ? "text-yellow-500" : "text-muted-foreground")} />
                <span className="text-muted-foreground">{meta.label}:</span>
                <span className="font-mono font-medium">{prize.amount} {prize.currency}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback: plain-text prize description (not JSON)
  if (prizeDescription && typeof prizeDescription === "string") {
    return (
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Trophy className="h-5 w-5 text-primary" />
        <span className="text-primary">{prizeDescription}</span>
      </div>
    );
  }

  // Fallback: crypto amount without structured breakdown
  if (prizeCrypto && prizeCryptoAmount) {
    return (
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Trophy className="h-5 w-5 text-primary" />
        <span className="font-mono text-primary">{prizeCryptoAmount} {prizeCrypto}</span>
      </div>
    );
  }

  // Nothing valid
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Trophy className="h-4 w-4" />
      <span>Prizes TBD</span>
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
        {(challenge.preview_video_url || challenge.thumbnail_url) ? (
          <img
            src={challenge.thumbnail_url || challenge.preview_video_url || ''}
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
              {(challenge.thumbnail_url || challenge.preview_video_url) ? (
                <img
                  src={challenge.thumbnail_url || challenge.preview_video_url || ''}
                  alt={challenge.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Trophy className="h-16 w-16 text-primary/50" />
                </div>
              )}
            </div>
            
            {/* Sponsored badge with optional logo */}
            {challenge.is_sponsored && challenge.sponsor_name && (
              <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border/50">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">
                  Sponsored by {challenge.sponsor_name}
                </span>
              </div>
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
