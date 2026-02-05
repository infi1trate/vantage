import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Trophy, Gamepad2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { type Challenge, getChallengeStatus, getTimeRemaining } from "@/lib/challenges";
import { cn } from "@/lib/utils";

interface ChallengeHeaderProps {
  challenge: Challenge;
  onSubmit?: () => void;
  canSubmit?: boolean;
  hasSubmitted?: boolean;
}

export function ChallengeHeader({
  challenge,
  onSubmit,
  canSubmit = true,
  hasSubmitted = false,
}: ChallengeHeaderProps) {
  const status = getChallengeStatus(challenge);
  const timeRemaining = getTimeRemaining(challenge.ends_at);

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

      <div className="px-4 md:px-6 pt-6 pb-8 space-y-6">
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

              {timeRemaining && status.isOpen && (
                <Badge variant="outline">
                  <Clock className="mr-1 h-3 w-3" />
                  {timeRemaining}
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

            {/* Prize */}
            {challenge.prize_description && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <Trophy className="h-5 w-5 text-primary" />
                <span className="font-medium text-primary">{challenge.prize_description}</span>
              </div>
            )}

            {/* Submit Button */}
            {status.isOpen && canSubmit && (
              <div className="pt-2">
                <Button
                  size="lg"
                  onClick={onSubmit}
                  className="font-display uppercase tracking-wider"
                >
                  {hasSubmitted ? "Submit Another Entry" : "Submit Entry"}
                </Button>
              </div>
            )}

            {hasSubmitted && (
              <p className="text-sm text-muted-foreground">
                You've already submitted to this challenge.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
