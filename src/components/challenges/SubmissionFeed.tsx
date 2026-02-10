import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { 
  Trophy, 
  Clock, 
  User, 
  TrendingUp, 
  Sparkles, 
  ThumbsUp,
  Crown,
  Medal,
  Play,
} from "lucide-react";
import { type ChallengeSubmission, type SubmissionMoment } from "@/lib/challenges";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface SubmissionFeedProps {
  submissions: ChallengeSubmission[];
  isLoading?: boolean;
  isEnded?: boolean;
  currentUserId?: string;
  onVote?: (submissionId: string) => void;
}

interface EnhancedSubmission extends ChallengeSubmission {
  // These would come from a join in real implementation
  authorName?: string;
  authorAvatar?: string;
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  voteCount?: number;
  hasVoted?: boolean;
}

function getRankIcon(rank: number | null) {
  if (!rank) return null;
  if (rank === 1) return <Crown className="h-4 w-4 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />;
  return null;
}

function SubmissionCardEnhanced({
  submission,
  isEnded,
  isOwn,
  onVote,
}: {
  submission: EnhancedSubmission;
  isEnded: boolean;
  isOwn: boolean;
  onVote?: () => void;
}) {
  const [isHovering, setIsHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isWinner = submission.status === 'winner';
  const isPending = submission.status === 'pending';

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current && submission.previewVideoUrl) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <Card
      className={cn(
        "group overflow-hidden transition-all duration-200",
        "border-border/50 bg-card/50 backdrop-blur-sm",
        "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
        isWinner && "border-primary ring-2 ring-primary/20"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thumbnail with hover preview */}
      <div className="relative">
        <AspectRatio ratio={16 / 9}>
          {submission.thumbnailUrl ? (
            <>
              <img
                src={submission.thumbnailUrl}
                alt={submission.title || "Submission"}
                className={cn(
                  "h-full w-full object-cover transition-all duration-300",
                  isHovering && submission.previewVideoUrl && "opacity-0"
                )}
              />
              {submission.previewVideoUrl && (
                <video
                  ref={videoRef}
                  src={submission.previewVideoUrl}
                  muted
                  loop
                  playsInline
                  className={cn(
                    "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                    isHovering ? "opacity-100" : "opacity-0"
                  )}
                />
              )}
            </>
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center">
              <Trophy className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
        </AspectRatio>

        {/* Play indicator on hover (only if has video) */}
        {submission.previewVideoUrl && !isHovering && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <Play className="h-5 w-5 text-primary ml-0.5" />
            </div>
          </div>
        )}

        {/* Rank Badge */}
        {submission.rank && submission.rank <= 3 && (
          <div className="absolute top-3 left-3">
            <Badge 
              className={cn(
                "font-semibold",
                submission.rank === 1 && "bg-yellow-500/90 text-yellow-950",
                submission.rank === 2 && "bg-gray-400/90 text-gray-900",
                submission.rank === 3 && "bg-amber-600/90 text-amber-950"
              )}
            >
              {getRankIcon(submission.rank)}
              <span className="ml-1">#{submission.rank}</span>
            </Badge>
          </div>
        )}

        {/* Winner Badge */}
        {isWinner && !submission.rank && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-primary text-primary-foreground font-semibold">
              <Trophy className="mr-1 h-3 w-3" />
              Winner
            </Badge>
          </div>
        )}

        {/* Status Badge (for own submissions) */}
        {isOwn && isPending && (
          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
              <Clock className="mr-1 h-3 w-3" />
              Pending
            </Badge>
          </div>
        )}

        {/* Moments count badge */}
        {submission.moments && (submission.moments as unknown as SubmissionMoment[]).length > 1 && (
          <Badge
            variant="secondary"
            className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm text-xs"
          >
            {(submission.moments as unknown as SubmissionMoment[]).length} moments
          </Badge>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-4 space-y-3">
        {submission.title && (
          <h4 className="font-medium line-clamp-1 group-hover:text-primary transition-colors">
            {submission.title}
          </h4>
        )}

        {submission.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {submission.description}
          </p>
        )}

        {/* Footer with vote button */}
        <div className="flex items-center justify-between pt-2">
          {/* Author info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {submission.authorAvatar ? (
              <img 
                src={submission.authorAvatar} 
                alt={submission.authorName || "User"} 
                className="h-5 w-5 rounded-full"
              />
            ) : (
              <User className="h-4 w-4" />
            )}
            <span>{submission.authorName || "Anonymous"}</span>
          </div>

          {/* Vote button */}
          {!isEnded && onVote && (
            <Button
              variant={submission.hasVoted ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={(e) => {
                e.preventDefault();
                onVote();
              }}
            >
              <ThumbsUp className={cn("h-3.5 w-3.5", submission.hasVoted && "fill-current")} />
              {submission.voteCount !== undefined && (
                <span className="ml-1">{submission.voteCount}</span>
              )}
            </Button>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptySubmissions({ isWinners }: { isWinners?: boolean }) {
  return (
    <div className="text-center py-12">
      <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
      <h3 className="font-medium mb-2">
        {isWinners ? "Winners not announced yet" : "No submissions yet"}
      </h3>
      <p className="text-sm text-muted-foreground">
        {isWinners 
          ? "Check back after the challenge ends to see who won!"
          : "Be the first to submit your moment!"
        }
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function SubmissionFeed({
  submissions,
  isLoading = false,
  isEnded = false,
  currentUserId,
  onVote,
}: SubmissionFeedProps) {
  // Filter and sort submissions
  const approvedSubmissions = submissions.filter(
    s => s.status === 'approved' || s.status === 'winner'
  ) as EnhancedSubmission[];
  
  const winnerSubmissions = approvedSubmissions.filter(s => s.status === 'winner');
  
  // Sort by rank for "Leading" tab
  const rankedSubmissions = [...approvedSubmissions].sort((a, b) => {
    // Winners first
    if (a.status === 'winner' && b.status !== 'winner') return -1;
    if (b.status === 'winner' && a.status !== 'winner') return 1;
    // Then by rank
    if (a.rank && b.rank) return a.rank - b.rank;
    if (a.rank && !b.rank) return -1;
    if (!a.rank && b.rank) return 1;
    // Then by vote count (mock)
    return (b.voteCount || 0) - (a.voteCount || 0);
  });

  // Sort by newest for "New" tab
  const newSubmissions = [...approvedSubmissions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl md:text-2xl font-bold tracking-wide flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Submissions
          <Badge variant="secondary" className="font-mono ml-2">
            {approvedSubmissions.length}
          </Badge>
        </h2>
      </div>

      {/* Pinned Winners (when ended) */}
      {isEnded && winnerSubmissions.length > 0 && (
        <div className="space-y-4 p-4 rounded-xl border border-primary/30 bg-primary/5">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Challenge Winners
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {winnerSubmissions.map((submission) => (
              <SubmissionCardEnhanced
                key={submission.id}
                submission={submission}
                isEnded={isEnded}
                isOwn={submission.user_id === currentUserId}
              />
            ))}
          </div>
          
          <div className="pt-2">
            <Button variant="outline" asChild>
              <Link to="/challenges/hall-of-fame" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                View Hall of Fame
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Tabs for sorting */}
      <Tabs defaultValue="leading">
        <TabsList>
          <TabsTrigger value="leading" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Leading
          </TabsTrigger>
          <TabsTrigger value="new" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            New
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leading" className="mt-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : rankedSubmissions.length === 0 ? (
            <EmptySubmissions />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {rankedSubmissions.map((submission) => (
                <SubmissionCardEnhanced
                  key={submission.id}
                  submission={submission}
                  isEnded={isEnded}
                  isOwn={submission.user_id === currentUserId}
                  onVote={onVote && !isEnded ? () => onVote(submission.id) : undefined}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="new" className="mt-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : newSubmissions.length === 0 ? (
            <EmptySubmissions />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {newSubmissions.map((submission) => (
                <SubmissionCardEnhanced
                  key={submission.id}
                  submission={submission}
                  isEnded={isEnded}
                  isOwn={submission.user_id === currentUserId}
                  onVote={onVote && !isEnded ? () => onVote(submission.id) : undefined}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
