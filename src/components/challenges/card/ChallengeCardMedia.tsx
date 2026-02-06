import { useState, useRef, useEffect, memo } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Clock, Trophy, Star, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Challenge } from "@/lib/challenges/types";

interface ChallengeCardMediaProps {
  challenge: Challenge;
  isHovered: boolean;
  cardStatus: CardStatus;
}

export type CardStatus = 'active' | 'upcoming' | 'endingSoon' | 'ended';

interface TimeDisplay {
  label: string;
  value: string;
  urgency: 'normal' | 'warning' | 'critical';
}

function getTimeDisplay(challenge: Challenge, cardStatus: CardStatus): TimeDisplay | null {
  const now = new Date();
  
  if (cardStatus === 'ended') {
    return null; // No time badge for ended
  }
  
  if (cardStatus === 'upcoming') {
    const startsAt = new Date(challenge.startAt);
    const diff = startsAt.getTime() - now.getTime();
    return {
      label: 'Starts in',
      value: formatTimeDiff(diff),
      urgency: 'normal',
    };
  }
  
  // Active or ending soon
  const endsAt = new Date(challenge.endAt);
  const diff = endsAt.getTime() - now.getTime();
  const hoursRemaining = diff / (1000 * 60 * 60);
  
  return {
    label: 'Ends in',
    value: formatTimeDiff(diff),
    urgency: hoursRemaining <= 2 ? 'critical' : hoursRemaining <= 48 ? 'warning' : 'normal',
  };
}

function formatTimeDiff(diffMs: number): string {
  if (diffMs <= 0) return '0m';
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getUrgencyStyles(urgency: TimeDisplay['urgency']) {
  switch (urgency) {
    case 'critical':
      return 'bg-destructive text-destructive-foreground animate-pulse';
    case 'warning':
      return 'bg-amber-500/90 text-amber-50';
    default:
      return 'bg-background/80 backdrop-blur-sm text-foreground';
  }
}

export const ChallengeCardMedia = memo(function ChallengeCardMedia({
  challenge,
  isHovered,
  cardStatus,
}: ChallengeCardMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeDisplay = getTimeDisplay(challenge, cardStatus);
  const isEnded = cardStatus === 'ended';

  // Handle video preview on hover
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !challenge.heroMediaUrl) return;

    if (isHovered && !isEnded) {
      video.play().catch(() => {
        // Ignore autoplay errors
      });
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isHovered, isEnded, challenge.heroMediaUrl]);

  return (
    <div className="relative overflow-hidden">
      <AspectRatio ratio={16 / 9}>
        {/* Static Image */}
        {challenge.thumbnailUrl ? (
          <img
            src={challenge.thumbnailUrl}
            alt={challenge.title}
            loading="lazy"
            decoding="async"
            className={cn(
              "h-full w-full object-cover transition-all duration-500",
              isHovered && "scale-105",
              challenge.heroMediaUrl && isHovered && "opacity-0"
            )}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Trophy className="h-12 w-12 text-primary/50" />
          </div>
        )}
        
        {/* Video Preview (on hover) */}
        {challenge.heroMediaUrl && (
          <video
            ref={videoRef}
            src={challenge.heroMediaUrl}
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
          {/* Game Pill - Top Left */}
          {challenge.game && (
            <Badge 
              variant="secondary" 
              className="bg-background/80 backdrop-blur-sm shadow-lg text-xs"
            >
              <Gamepad2 className="mr-1 h-3 w-3" />
              {challenge.game}
            </Badge>
          )}

          {/* Time Badge - Top Right */}
          {timeDisplay && (
            <Badge 
              className={cn(
                "shadow-lg font-mono text-xs ml-auto",
                getUrgencyStyles(timeDisplay.urgency)
              )}
            >
              {timeDisplay.urgency === 'critical' ? (
                <Hourglass className="mr-1 h-3 w-3" />
              ) : (
                <Clock className="mr-1 h-3 w-3" />
              )}
              <span className="hidden sm:inline mr-1">{timeDisplay.label}</span>
              {timeDisplay.value}
            </Badge>
          )}

          {/* Ended Badge */}
          {isEnded && (
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm ml-auto">
              <Trophy className="mr-1 h-3 w-3 text-amber-500" />
              Ended
            </Badge>
          )}
        </div>

        {/* Bottom Row */}
        <div className="flex items-end justify-between gap-2">
          {/* Sponsored Label */}
          {challenge.isSponsored && (
            <Badge 
              variant="outline" 
              className="bg-background/80 backdrop-blur-sm text-xs border-primary/30"
            >
              <Star className="mr-1 h-2.5 w-2.5 text-primary fill-primary" />
              Sponsored
              {challenge.sponsor?.name && (
                <span className="hidden sm:inline ml-1">by {challenge.sponsor.name}</span>
              )}
            </Badge>
          )}

          {/* Status Badge */}
          {cardStatus === 'active' && (
            <Badge className="ml-auto font-semibold uppercase tracking-wider text-xs shadow-lg bg-primary text-primary-foreground">
              Open
            </Badge>
          )}
          {cardStatus === 'upcoming' && (
            <Badge variant="outline" className="ml-auto font-semibold uppercase tracking-wider text-xs shadow-lg bg-background/80 backdrop-blur-sm">
              Coming Soon
            </Badge>
          )}
          {cardStatus === 'endingSoon' && (
            <Badge className="ml-auto font-semibold uppercase tracking-wider text-xs shadow-lg bg-destructive text-destructive-foreground">
              Ending Soon
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
});
