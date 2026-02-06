/**
 * ChallengeSubmitBanner
 * 
 * Non-invasive nudge shown when a user finishes a recording launched from a challenge.
 * Appears in the session review page if challengeContext is present.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, X, ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChallengeSubmitBannerProps {
  challengeId: string;
  challengeTitle: string;
  onSubmitNow: () => void;
  onDismiss: () => void;
  className?: string;
}

export function ChallengeSubmitBanner({
  challengeId,
  challengeTitle,
  onSubmitNow,
  onDismiss,
  className,
}: ChallengeSubmitBannerProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    // Wait for exit animation before calling onDismiss
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-primary/30 bg-primary/5",
        "transition-all duration-200",
        isExiting && "opacity-0 scale-95",
        className
      )}
    >
      {/* Subtle gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative p-4 flex items-start gap-3">
        {/* Icon */}
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <Trophy className="h-5 w-5 text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            Submit a moment from this recording to
          </p>
          <p className="text-sm text-primary font-semibold truncate mt-0.5">
            "{challengeTitle}"
          </p>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={onSubmitNow}
              className="gap-2"
            >
              <Trophy className="h-3.5 w-3.5" />
              Submit Now
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground"
            >
              <Clock className="h-3.5 w-3.5 mr-1" />
              Later
            </Button>
          </div>
        </div>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
