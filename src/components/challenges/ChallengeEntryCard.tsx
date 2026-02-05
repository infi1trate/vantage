import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Trophy,
  ThumbsUp,
  MoreVertical,
  Flag,
  Play,
  Crown,
  Medal,
  Award,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLazyLoad } from "@/hooks/useLazyLoad";

type EntryRank = "winner" | "first" | "second" | "third" | number | null;

interface ChallengeEntryCardProps {
  id: string;
  sessionId?: string;
  title: string;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  clipDurationMs?: number;
  creatorId: string;
  creatorUsername?: string;
  creatorAvatarUrl?: string | null;
  rank: EntryRank;
  voteCount: number;
  hasVoted?: boolean;
  isChallengeEnded?: boolean;
  onVote?: (entryId: string) => void;
  onReport?: (entryId: string) => void;
  onClick?: (entryId: string) => void;
}

// Rank configuration
const getRankConfig = (rank: EntryRank) => {
  if (rank === "winner" || rank === "first" || rank === 1) {
    return {
      label: "Winner",
      icon: Crown,
      className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
      ringClassName: "ring-yellow-500/50",
    };
  }
  if (rank === "second" || rank === 2) {
    return {
      label: "2nd",
      icon: Medal,
      className: "bg-slate-300/20 text-slate-300 border-slate-300/30",
      ringClassName: "ring-slate-300/50",
    };
  }
  if (rank === "third" || rank === 3) {
    return {
      label: "3rd",
      icon: Award,
      className: "bg-amber-600/20 text-amber-600 border-amber-600/30",
      ringClassName: "ring-amber-600/50",
    };
  }
  if (typeof rank === "number" && rank > 3) {
    return {
      label: `#${rank}`,
      icon: null,
      className: "bg-muted text-muted-foreground border-border",
      ringClassName: "",
    };
  }
  return null;
};

// Format duration
const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Memoized card component for scroll performance
export const ChallengeEntryCard = memo(function ChallengeEntryCard({
  id,
  sessionId,
  title,
  thumbnailUrl,
  videoUrl,
  clipDurationMs,
  creatorId,
  creatorUsername,
  creatorAvatarUrl,
  rank,
  voteCount,
  hasVoted = false,
  isChallengeEnded = false,
  onVote,
  onReport,
  onClick,
}: ChallengeEntryCardProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isHovering, setIsHovering] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Lazy load video when card is in viewport
  const { ref: cardRef, isVisible, hasBeenVisible } = useLazyLoad<HTMLDivElement>({
    rootMargin: "100px",
    threshold: 0.1,
  });

  const rankConfig = getRankConfig(rank);
  const isWinner = rank === "winner" || rank === "first" || rank === 1;

  // Handle video play on hover with debounce
  const handleMouseEnter = useCallback(() => {
    if (!videoUrl || !hasBeenVisible) return;

    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovering(true);
      if (videoRef.current && isVideoLoaded) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {
          // Autoplay blocked - ignore
        });
        setIsVideoPlaying(true);
      }
    }, 200); // 200ms debounce to prevent flickering during scroll
  }, [videoUrl, hasBeenVisible, isVideoLoaded]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsVideoPlaying(false);
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Handle video loaded
  const handleVideoLoaded = useCallback(() => {
    setIsVideoLoaded(true);
  }, []);

  // Handle card click
  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    if ((e.target as HTMLElement).closest("button, [role='menuitem']")) {
      return;
    }
    onClick?.(id);
  };

  // Handle vote
  const handleVote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isChallengeEnded) {
      onVote?.(id);
    }
  };

  // Handle report
  const handleReport = () => {
    onReport?.(id);
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative rounded-lg overflow-hidden border bg-card transition-all duration-200",
        "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
        isWinner && "ring-2 ring-yellow-500/30"
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.(id)}
    >
      {/* Video/Thumbnail Container */}
      <AspectRatio ratio={16 / 9} className="bg-muted">
        {/* Thumbnail (always rendered as fallback) */}
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={title}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
              isVideoPlaying ? "opacity-0" : "opacity-100"
            )}
            loading="lazy"
            decoding="async"
          />
        )}

        {/* Video (lazy loaded, only when visible) */}
        {videoUrl && hasBeenVisible && (
          <video
            ref={videoRef}
            src={videoUrl}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
              isVideoPlaying ? "opacity-100" : "opacity-0"
            )}
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedData={handleVideoLoaded}
          />
        )}

        {/* Placeholder when no thumbnail */}
        {!thumbnailUrl && !videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Play className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        {/* Play indicator on hover */}
        {isHovering && !isVideoPlaying && videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/20">
            <div className="h-12 w-12 rounded-full bg-background/80 flex items-center justify-center">
              <Play className="h-5 w-5 text-foreground" fill="currentColor" />
            </div>
          </div>
        )}

        {/* Rank Badge */}
        {rankConfig && (
          <Badge
            className={cn(
              "absolute top-2 left-2 border font-semibold",
              rankConfig.className
            )}
          >
            {rankConfig.icon && (
              <rankConfig.icon className="h-3 w-3 mr-1" />
            )}
            {rankConfig.label}
          </Badge>
        )}

        {/* Duration Badge */}
        {clipDurationMs && (
          <Badge
            variant="secondary"
            className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-xs font-mono"
          >
            <Clock className="h-3 w-3 mr-1" />
            {formatDuration(clipDurationMs)}
          </Badge>
        )}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
      </AspectRatio>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Title */}
        <h4 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
          {title}
        </h4>

        {/* Creator & Actions Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Creator */}
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6">
              <AvatarImage src={creatorAvatarUrl || undefined} />
              <AvatarFallback className="text-xs">
                {creatorUsername?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground truncate">
              {creatorUsername || "Anonymous"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Vote Button */}
            <Button
              variant={hasVoted ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-8 px-2 gap-1.5",
                hasVoted && "bg-primary/20 text-primary hover:bg-primary/30",
                isChallengeEnded && "opacity-50 cursor-not-allowed"
              )}
              onClick={handleVote}
              disabled={isChallengeEnded}
              title={isChallengeEnded ? "Voting has ended" : "Vote for this entry"}
            >
              <ThumbsUp
                className={cn("h-4 w-4", hasVoted && "fill-current")}
              />
              <span className="text-xs font-medium">{voteCount}</span>
            </Button>

            {/* More Options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleReport}
                  className="text-destructive focus:text-destructive"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Winner glow effect */}
      {isWinner && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/10 to-transparent" />
        </div>
      )}
    </div>
  );
});
