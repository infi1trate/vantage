import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { 
  Clock, 
  Trophy, 
  Users, 
  Gamepad2, 
  Flame,
  Star,
  Sparkles,
  Crown,
} from "lucide-react";
import { type Challenge, getChallengeStatus, getTimeRemaining } from "@/lib/challenges";
import { cn } from "@/lib/utils";

interface ChallengeCardProps {
  challenge: Challenge;
  className?: string;
}

type UrgencyLevel = 'normal' | 'warning' | 'critical';

function getTimeUrgency(endsAt: string | null): UrgencyLevel {
  if (!endsAt) return 'normal';
  
  const now = new Date();
  const end = new Date(endsAt);
  const hoursRemaining = (end.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (hoursRemaining <= 2) return 'critical';
  if (hoursRemaining <= 24) return 'warning';
  return 'normal';
}

function getUrgencyStyles(urgency: UrgencyLevel) {
  switch (urgency) {
    case 'critical':
      return 'bg-destructive text-destructive-foreground animate-pulse';
    case 'warning':
      return 'bg-orange-500/90 text-white';
    default:
      return 'bg-background/80 backdrop-blur-sm text-foreground';
  }
}

function DifficultyIndicator({ level }: { level: number }) {
  const clampedLevel = Math.min(5, Math.max(1, level));
  
  return (
    <div className="flex items-center gap-0.5" title={`Difficulty: ${clampedLevel}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Flame
          key={i}
          className={cn(
            "h-3.5 w-3.5 transition-colors",
            i < clampedLevel 
              ? "text-orange-500 fill-orange-500/30" 
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

function CryptoPrize({ currency, amount }: { currency: string; amount: number | null }) {
  const formattedAmount = amount 
    ? amount >= 1 
      ? amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : amount.toFixed(4)
    : '???';
    
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/20">
      <Sparkles className="h-4 w-4 text-primary" />
      <span className="font-mono font-bold text-primary">
        {formattedAmount} {currency}
      </span>
    </div>
  );
}

export function ChallengeCard({ challenge, className }: ChallengeCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const status = getChallengeStatus(challenge);
  const timeRemaining = getTimeRemaining(challenge.ends_at);
  const timeUrgency = getTimeUrgency(challenge.ends_at);
  const isEnded = status.label === 'Ended' || status.label === 'Completed';
  const isEndingSoon = timeUrgency !== 'normal' && status.isOpen;

  // Handle video preview on hover
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !challenge.preview_video_url) return;

    if (isHovered && !isEnded) {
      video.play().catch(() => {
        // Ignore autoplay errors
      });
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isHovered, isEnded, challenge.preview_video_url]);

  const ctaText = isEnded ? "View Winners" : "View Challenge";

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
          isEnded && "grayscale-[30%] opacity-80 hover:grayscale-0 hover:opacity-100",
          // Ending soon - emphasized border
          isEndingSoon && "ring-2 ring-orange-500/50",
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Media Header */}
        <div className="relative overflow-hidden">
          <AspectRatio ratio={16 / 9}>
            {/* Static Image */}
            {challenge.thumbnail_url ? (
              <img
                src={challenge.thumbnail_url}
                alt={challenge.title}
                className={cn(
                  "h-full w-full object-cover transition-all duration-500",
                  isHovered && "scale-105",
                  challenge.preview_video_url && isHovered && "opacity-0"
                )}
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Trophy className="h-12 w-12 text-primary/50" />
              </div>
            )}
            
            {/* Video Preview (on hover) */}
            {challenge.preview_video_url && (
              <video
                ref={videoRef}
                src={challenge.preview_video_url}
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                  isHovered ? "opacity-100" : "opacity-0"
                )}
                loop
                muted
                playsInline
              />
            )}
          </AspectRatio>

          {/* Overlay Badges */}
          <div className="absolute inset-0 p-3 flex flex-col justify-between pointer-events-none">
            {/* Top Row */}
            <div className="flex items-start justify-between gap-2">
              {/* Game Name - Top Left */}
              {challenge.game_name && (
                <Badge 
                  variant="secondary" 
                  className="bg-background/80 backdrop-blur-sm shadow-lg"
                >
                  <Gamepad2 className="mr-1 h-3 w-3" />
                  {challenge.game_name}
                </Badge>
              )}

              {/* Time Remaining - Top Right */}
              {timeRemaining && status.isOpen && (
                <Badge 
                  className={cn(
                    "shadow-lg font-mono",
                    getUrgencyStyles(timeUrgency)
                  )}
                >
                  <Clock className="mr-1 h-3 w-3" />
                  {timeRemaining}
                </Badge>
              )}

              {/* Ended Badge */}
              {isEnded && (
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                  <Crown className="mr-1 h-3 w-3 text-yellow-500" />
                  Ended
                </Badge>
              )}
            </div>

            {/* Bottom Row */}
            <div className="flex items-end justify-between gap-2">
              {/* Sponsored Label */}
              {challenge.is_sponsored && (
                <Badge 
                  variant="outline" 
                  className="bg-background/80 backdrop-blur-sm text-xs border-primary/30"
                >
                  <Star className="mr-1 h-2.5 w-2.5 text-primary fill-primary" />
                  Sponsored{challenge.sponsor_name && ` by ${challenge.sponsor_name}`}
                </Badge>
              )}

              {/* Status Badge */}
              {!isEnded && (
                <Badge
                  variant={status.variant}
                  className={cn(
                    "ml-auto font-semibold uppercase tracking-wider text-xs shadow-lg",
                    status.isOpen && "bg-primary text-primary-foreground"
                  )}
                >
                  {status.label}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-4 space-y-3">
          {/* Title */}
          <h3 className="font-display text-lg font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors min-h-[3.5rem]">
            {challenge.title}
          </h3>

          {/* Meta Row: Difficulty + Submissions */}
          <div className="flex items-center justify-between">
            <DifficultyIndicator level={challenge.difficulty} />
            
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{challenge.submission_count || 0} entries</span>
            </div>
          </div>

          {/* Prize Pool */}
          {challenge.prize_crypto && (
            <CryptoPrize 
              currency={challenge.prize_crypto} 
              amount={challenge.prize_crypto_amount} 
            />
          )}

          {/* Fallback to text prize if no crypto */}
          {!challenge.prize_crypto && challenge.prize_description && (
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground truncate">
                {challenge.prize_description}
              </span>
            </div>
          )}

          {/* CTA Button */}
          <Button 
            variant={isEnded ? "outline" : "default"}
            size="sm"
            className={cn(
              "w-full font-display uppercase tracking-wider transition-all",
              "group-hover:shadow-md",
              !isEnded && "group-hover:shadow-primary/20"
            )}
            tabIndex={-1} // Card is the clickable element
          >
            {isEnded && <Crown className="mr-2 h-4 w-4 text-yellow-500" />}
            {!isEnded && <Trophy className="mr-2 h-4 w-4" />}
            {ctaText}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
