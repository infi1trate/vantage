import { useState, memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Crown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Challenge as DbChallenge } from "@/lib/challenges";
import type { Challenge as UiChallenge } from "@/lib/challenges/types";
import { 
  ChallengeCardMedia, 
  DifficultyIndicator, 
  PrizeDisplay,
  type CardStatus,
} from "./card";

// Support both DB and UI challenge types
type ChallengeInput = DbChallenge | UiChallenge;

interface ChallengeCardProps {
  challenge: ChallengeInput;
  className?: string;
}

/**
 * Check if challenge is the new UI type or old DB type
 */
function isUiChallenge(c: ChallengeInput): c is UiChallenge {
  return 'game' in c && 'startAt' in c;
}

/**
 * Normalize challenge to UI format for internal use
 */
function normalizeChallenge(input: ChallengeInput): UiChallenge {
  if (isUiChallenge(input)) {
    return input;
  }

  // Transform DB type to UI type
  const db = input;
  const now = new Date();
  const startsAt = db.starts_at ? new Date(db.starts_at) : null;
  const endsAt = db.ends_at ? new Date(db.ends_at) : null;

  // Compute UI status
  let status: UiChallenge['status'] = 'ended';
  if (db.status === 'draft') {
    status = 'upcoming';
  } else if (db.status === 'active') {
    if (startsAt && now < startsAt) {
      status = 'upcoming';
    } else if (endsAt && now > endsAt) {
      status = 'ended';
    } else {
      status = 'active';
    }
  } else if (db.status === 'completed' || db.status === 'judging') {
    status = 'ended';
  }

  // Build prize pool string
  let prizePool: string | null = null;
  if (db.prize_crypto && db.prize_crypto_amount) {
    prizePool = `${db.prize_crypto_amount} ${db.prize_crypto}`;
  } else if (db.prize_description) {
    prizePool = db.prize_description;
  }

  return {
    id: db.id,
    title: db.title,
    game: db.game_name || 'Unknown Game',
    gameId: null,
    rulesSummary: null,
    rulesFull: db.rules,
    difficulty: Math.min(5, Math.max(1, db.difficulty || 3)) as 1 | 2 | 3 | 4 | 5,
    sponsor: db.is_sponsored ? { name: db.sponsor_name || 'Sponsor' } : null,
    prizePool,
    prizesTop3: [],
    startAt: db.starts_at || db.created_at,
    endAt: db.ends_at || '',
    status,
    submissionsCount: db.submission_count || 0,
    isSponsored: db.is_sponsored || false,
    heroMediaUrl: db.preview_video_url,
    thumbnailUrl: db.thumbnail_url,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

/**
 * Compute the card's display status based on challenge data and timing.
 */
function getCardStatus(challenge: UiChallenge): CardStatus {
  const now = new Date();
  const startsAt = new Date(challenge.startAt);
  const endsAt = challenge.endAt ? new Date(challenge.endAt) : null;

  // Check if ended
  if (challenge.status === 'ended') {
    return 'ended';
  }
  
  // Check if upcoming
  if (challenge.status === 'upcoming' || now < startsAt) {
    return 'upcoming';
  }

  // Check if ending soon (within 48 hours)
  if (endsAt) {
    const hoursRemaining = (endsAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursRemaining <= 0) {
      return 'ended';
    }
    if (hoursRemaining <= 48) {
      return 'endingSoon';
    }
  }

  return 'active';
}

export const ChallengeCard = memo(function ChallengeCard({ 
  challenge: inputChallenge, 
  className,
}: ChallengeCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Normalize to UI type
  const challenge = useMemo(() => normalizeChallenge(inputChallenge), [inputChallenge]);
  
  const cardStatus = useMemo(() => getCardStatus(challenge), [challenge]);
  const isEnded = cardStatus === 'ended';
  const isEndingSoon = cardStatus === 'endingSoon';

  // CTA text based on status
  const ctaText = isEnded ? "View Winners" : "View Challenge";
  const CtaIcon = isEnded ? Crown : Trophy;

  return (
    <Link to={`/challenges/${challenge.id}`}>
      <Card
        className={cn(
          "group relative overflow-hidden transition-all duration-300",
          "border-border/50 bg-card/50 backdrop-blur-sm",
          "hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10",
          "hover:-translate-y-1",
          "active:scale-[0.98]",
          // Ended state - desaturated
          isEnded && "opacity-80 hover:opacity-100",
          // Ending soon - emphasized border
          isEndingSoon && "ring-2 ring-destructive/50",
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Media Header */}
        <ChallengeCardMedia 
          challenge={challenge}
          isHovered={isHovered}
          cardStatus={cardStatus}
        />

        {/* Content */}
        <CardContent className="p-4 space-y-3">
          {/* Title - 2 lines max */}
          <h3 className="font-display text-lg font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors min-h-[3.5rem]">
            {challenge.title}
          </h3>

          {/* Meta Row: Difficulty + Submissions */}
          <div className="flex items-center justify-between gap-2">
            <DifficultyIndicator level={challenge.difficulty} />
            
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{challenge.submissionsCount || 0} entries</span>
            </div>
          </div>

          {/* Prize Pool Display */}
          <PrizeDisplay 
            prizePool={challenge.prizePool}
            prizesTop3={challenge.prizesTop3}
          />

          {/* CTA Button */}
          <Button 
            variant={isEnded ? "outline" : "default"}
            size="sm"
            className={cn(
              "w-full font-display uppercase tracking-wider transition-all",
              "group-hover:shadow-md",
              !isEnded && "group-hover:shadow-primary/20",
              // Touch-friendly sizing
              "min-h-[44px]"
            )}
            tabIndex={-1} // Card is the clickable element
          >
            <CtaIcon className={cn(
              "mr-2 h-4 w-4",
              isEnded && "text-amber-500"
            )} />
            {ctaText}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
});

export default ChallengeCard;
