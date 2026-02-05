import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Trophy, Clock, User } from "lucide-react";
import { type ChallengeSubmission } from "@/lib/challenges";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface SubmissionCardProps {
  submission: ChallengeSubmission;
  sessionThumbnail?: string | null;
  authorName?: string;
  isOwn?: boolean;
  onClick?: () => void;
}

export function SubmissionCard({
  submission,
  sessionThumbnail,
  authorName,
  isOwn = false,
  onClick,
}: SubmissionCardProps) {
  const isWinner = submission.status === 'winner';
  const isPending = submission.status === 'pending';

  return (
    <Card
      className={cn(
        "group overflow-hidden transition-all duration-200 cursor-pointer",
        "border-border/50 bg-card/50 backdrop-blur-sm",
        "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
        isWinner && "border-primary ring-2 ring-primary/20"
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative">
        <AspectRatio ratio={16 / 9}>
          {sessionThumbnail ? (
            <img
              src={sessionThumbnail}
              alt={submission.title || "Submission"}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center">
              <Trophy className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
        </AspectRatio>

        {/* Winner Badge */}
        {isWinner && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-primary text-primary-foreground font-semibold">
              <Trophy className="mr-1 h-3 w-3" />
              Winner
              {submission.rank && submission.rank <= 3 && ` #${submission.rank}`}
            </Badge>
          </div>
        )}

        {/* Status Badge (for own submissions) */}
        {isOwn && isPending && (
          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
              <Clock className="mr-1 h-3 w-3" />
              Pending Review
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-4 space-y-2">
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

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          {authorName && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{authorName}</span>
            </div>
          )}
          <span>{formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}</span>
        </div>
      </CardContent>
    </Card>
  );
}
