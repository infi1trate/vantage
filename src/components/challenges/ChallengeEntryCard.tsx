import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import type { SubmissionMoment } from "@/lib/challenges";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ThumbsUp,
  MoreVertical,
  Flag,
  Play,
  Crown,
  Medal,
  Award,
  Clock,
  Eye,
  Ban,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Share2,
  Link2,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLazyLoad } from "@/hooks/useLazyLoad";
import { toast } from "sonner";

type EntryRank = "winner" | "first" | "second" | "third" | number | null;
type EntryStatus = "pending" | "approved" | "rejected" | "removed" | "winner";

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
  status?: EntryStatus;
  isOwnEntry?: boolean;
  rejectionReason?: string;
  moments?: SubmissionMoment[] | null;
  onVote?: (entryId: string) => void;
  onReport?: (entryId: string) => Promise<void> | void;
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

// Status configuration
const getStatusConfig = (status: EntryStatus, isOwnEntry: boolean) => {
  switch (status) {
    case "pending":
      return {
        label: isOwnEntry ? "Pending Review" : null,
        icon: Eye,
        className: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 border-yellow-500/30",
        showOverlay: false,
      };
    case "rejected":
      return {
        label: "Rejected",
        icon: Ban,
        className: "bg-destructive/20 text-destructive border-destructive/30",
        showOverlay: true,
      };
    case "removed":
      return {
        label: "Removed",
        icon: AlertTriangle,
        className: "bg-destructive/20 text-destructive border-destructive/30",
        showOverlay: true,
      };
    default:
      return null;
  }
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
  status = "approved",
  isOwnEntry = false,
  rejectionReason,
  moments,
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
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  
  // Optimistic vote state
  const [optimisticVoteCount, setOptimisticVoteCount] = useState(voteCount);
  const [optimisticHasVoted, setOptimisticHasVoted] = useState(hasVoted);
  const [isVoting, setIsVoting] = useState(false);

  // Lazy load video when card is in viewport
  const { ref: cardRef, isVisible, hasBeenVisible } = useLazyLoad<HTMLDivElement>({
    rootMargin: "100px",
    threshold: 0.1,
  });

  const rankConfig = getRankConfig(rank);
  const statusConfig = getStatusConfig(status, isOwnEntry);
  const isWinner = rank === "winner" || rank === "first" || rank === 1;
  const isRejectedOrRemoved = status === "rejected" || status === "removed";

  // Handle video play on hover with debounce
  const handleMouseEnter = useCallback(() => {
    if (!videoUrl || !hasBeenVisible || isRejectedOrRemoved) return;

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
  }, [videoUrl, hasBeenVisible, isVideoLoaded, isRejectedOrRemoved]);

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
    // Don't allow clicking on rejected/removed entries
    if (isRejectedOrRemoved) return;
    onClick?.(id);
  };

  // Handle vote with optimistic update
  const handleVote = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isChallengeEnded || isRejectedOrRemoved || isVoting) return;
    
    // Optimistic update
    const wasVoted = optimisticHasVoted;
    setOptimisticHasVoted(!wasVoted);
    setOptimisticVoteCount(prev => wasVoted ? prev - 1 : prev + 1);
    setIsVoting(true);
    
    try {
      // Call the vote handler - it should return or throw if failed
      await onVote?.(id);
    } catch (error) {
      // Revert on error
      setOptimisticHasVoted(wasVoted);
      setOptimisticVoteCount(prev => wasVoted ? prev + 1 : prev - 1);
      toast.error("Failed to vote", { description: "Please try again." });
    } finally {
      setIsVoting(false);
    }
  }, [id, isChallengeEnded, isRejectedOrRemoved, isVoting, optimisticHasVoted, onVote]);

  // Handle share
  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const shareUrl = `${window.location.origin}/challenges/entry/${id}`;
    
    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `Check out this challenge entry: ${title}`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fall through to clipboard
        if ((err as Error).name === 'AbortError') return;
      }
    }
    
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!", {
        description: "Share link copied to clipboard",
        icon: <Link2 className="h-4 w-4" />,
      });
    } catch (err) {
      toast.error("Failed to copy link");
    }
  }, [id, title]);

  // Handle report confirmation
  const handleReportConfirm = async () => {
    setIsReporting(true);
    try {
      await onReport?.(id);
      setShowReportDialog(false);
      toast.success("Report submitted", {
        description: "Thank you for helping keep our community safe. We'll review this entry.",
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
    } catch (error) {
      toast.error("Failed to submit report", {
        description: "Please try again later.",
      });
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <>
      <div
        ref={cardRef}
        className={cn(
          "group relative rounded-lg overflow-hidden border bg-card transition-all duration-200",
          !isRejectedOrRemoved && "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
          isWinner && !isRejectedOrRemoved && "ring-2 ring-yellow-500/30",
          isRejectedOrRemoved && "opacity-60 cursor-default"
        )}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role={isRejectedOrRemoved ? undefined : "button"}
        tabIndex={isRejectedOrRemoved ? -1 : 0}
        onKeyDown={(e) => e.key === "Enter" && !isRejectedOrRemoved && onClick?.(id)}
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
                isVideoPlaying ? "opacity-0" : "opacity-100",
                isRejectedOrRemoved && "grayscale"
              )}
              loading="lazy"
              decoding="async"
            />
          )}

          {/* Video (lazy loaded, only when visible) */}
          {videoUrl && hasBeenVisible && !isRejectedOrRemoved && (
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
          {isHovering && !isVideoPlaying && videoUrl && !isRejectedOrRemoved && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/20">
              <div className="h-12 w-12 rounded-full bg-background/80 flex items-center justify-center">
                <Play className="h-5 w-5 text-foreground" fill="currentColor" />
              </div>
            </div>
          )}

          {/* Rejected/Removed overlay */}
          {statusConfig?.showOverlay && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
              <div className="text-center p-4">
                <div className="h-12 w-12 mx-auto mb-2 rounded-full bg-destructive/20 flex items-center justify-center">
                  {statusConfig.icon && <statusConfig.icon className="h-6 w-6 text-destructive" />}
                </div>
                <p className="text-sm font-medium text-destructive">
                  {statusConfig.label}
                </p>
                {isOwnEntry && rejectionReason && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                    {rejectionReason}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Rank Badge */}
          {rankConfig && !isRejectedOrRemoved && (
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

          {/* Status Badge (pending review) */}
          {statusConfig && !statusConfig.showOverlay && statusConfig.label && (
            <Badge
              className={cn(
                "absolute top-2 left-2 border font-medium",
                statusConfig.className
              )}
            >
              {statusConfig.icon && (
                <statusConfig.icon className="h-3 w-3 mr-1" />
              )}
              {statusConfig.label}
            </Badge>
          )}

          {/* Duration Badge */}
          {clipDurationMs && !isRejectedOrRemoved && (
            <Badge
              variant="secondary"
              className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-xs font-mono"
            >
              <Clock className="h-3 w-3 mr-1" />
              {formatDuration(clipDurationMs)}
            </Badge>
          )}

          {/* Moments Badge */}
          {moments && moments.length > 1 && !isRejectedOrRemoved && (
            <Badge
              variant="secondary"
              className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm text-xs"
            >
              {moments.length} moments
            </Badge>
          )}

          {/* Gradient overlay for text readability */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
        </AspectRatio>

        {/* Thumbnail strip for bundled moments */}
        {moments && moments.length > 1 && !isRejectedOrRemoved && thumbnailUrl && (
          <div className="flex gap-0.5 px-1 py-1 bg-muted/50">
            {moments.slice(0, 3).map((m, i) => (
              <div
                key={`${m.annotation_id}-${i}`}
                className="flex-1 h-8 rounded-sm overflow-hidden bg-muted"
              >
                <img
                  src={thumbnailUrl}
                  alt={m.label || `Moment ${i + 1}`}
                  className="w-full h-full object-cover opacity-80"
                  loading="lazy"
                />
              </div>
            ))}
            {moments.length > 3 && (
              <div className="flex-1 h-8 rounded-sm bg-muted flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground font-medium">
                  +{moments.length - 3}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Title */}
          <h4 className={cn(
            "font-medium text-sm line-clamp-1 transition-colors",
            !isRejectedOrRemoved && "group-hover:text-primary",
            isRejectedOrRemoved && "text-muted-foreground"
          )}>
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
              {/* Vote Button - hidden for rejected/removed */}
              {!isRejectedOrRemoved && (
                <Button
                  variant={optimisticHasVoted ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 px-2 gap-1.5 min-w-[52px]",
                    optimisticHasVoted && "bg-primary/20 text-primary hover:bg-primary/30",
                    isChallengeEnded && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={handleVote}
                  disabled={isChallengeEnded || isVoting}
                  title={isChallengeEnded ? "Voting has ended" : optimisticHasVoted ? "Remove vote" : "Vote for this entry"}
                >
                  {isVoting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsUp
                      className={cn("h-4 w-4", optimisticHasVoted && "fill-current")}
                    />
                  )}
                  <span className="text-xs font-medium">{optimisticVoteCount}</span>
                </Button>
              )}

              {/* Share Button */}
              {!isRejectedOrRemoved && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleShare}
                  title="Share this entry"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              )}

              {/* More Options (Report) */}
              {!isRejectedOrRemoved && (
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
                      onClick={() => setShowReportDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Report Entry
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

        {/* Winner glow effect */}
        {isWinner && !isRejectedOrRemoved && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/10 to-transparent" />
          </div>
        )}
      </div>

      {/* Report Confirmation Dialog */}
      <AlertDialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-destructive" />
              Report Entry
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to report this entry? Our moderation team will review it and take appropriate action if it violates our community guidelines.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReporting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReportConfirm}
              disabled={isReporting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isReporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
