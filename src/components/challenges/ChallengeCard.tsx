import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Clock, Trophy, Users, Gamepad2 } from "lucide-react";
import { type Challenge, getChallengeStatus, getTimeRemaining } from "@/lib/challenges";
import { cn } from "@/lib/utils";

interface ChallengeCardProps {
  challenge: Challenge;
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const status = getChallengeStatus(challenge);
  const timeRemaining = getTimeRemaining(challenge.ends_at);

  return (
    <Link to={`/challenges/${challenge.id}`}>
      <Card className={cn(
        "group overflow-hidden transition-all duration-200",
        "border-border/50 bg-card/50 backdrop-blur-sm",
        "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
        "hover:scale-[1.02]"
      )}>
        {/* Thumbnail */}
        <div className="relative">
          <AspectRatio ratio={16 / 9}>
            {challenge.thumbnail_url ? (
              <img
                src={challenge.thumbnail_url}
                alt={challenge.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Trophy className="h-12 w-12 text-primary/50" />
              </div>
            )}
          </AspectRatio>

          {/* Status Badge */}
          <div className="absolute top-3 left-3">
            <Badge
              variant={status.variant}
              className={cn(
                "font-semibold uppercase tracking-wider text-xs",
                status.isOpen && "bg-primary text-primary-foreground animate-pulse"
              )}
            >
              {status.label}
            </Badge>
          </div>

          {/* Time Remaining */}
          {timeRemaining && status.isOpen && (
            <div className="absolute top-3 right-3">
              <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
                <Clock className="mr-1 h-3 w-3" />
                {timeRemaining}
              </Badge>
            </div>
          )}

          {/* Game Tag */}
          {challenge.game_name && (
            <div className="absolute bottom-3 left-3">
              <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                <Gamepad2 className="mr-1 h-3 w-3" />
                {challenge.game_name}
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-4 space-y-3">
          <h3 className="font-display text-lg font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {challenge.title}
          </h3>

          {challenge.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {challenge.description}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            {challenge.prize_description && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Trophy className="h-3.5 w-3.5 text-primary" />
                <span className="truncate max-w-[120px]">{challenge.prize_description}</span>
              </div>
            )}

            {challenge.max_submissions_per_user && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                <Users className="h-3.5 w-3.5" />
                <span>{challenge.max_submissions_per_user} entry max</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
