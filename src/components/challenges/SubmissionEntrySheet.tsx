import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Video, 
  Library, 
  ArrowRight, 
  AlertTriangle, 
  Clock,
  Ban,
} from "lucide-react";
import { type Challenge, getChallengeStatus } from "@/lib/challenges";
import { cn } from "@/lib/utils";

interface SubmissionEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: Challenge;
  onSelectFromLibrary: () => void;
}

function getTimeUrgency(endsAt: string | null): {
  isEndingSoon: boolean;
  timeLeft: string | null;
  hoursLeft: number;
} {
  if (!endsAt) return { isEndingSoon: false, timeLeft: null, hoursLeft: Infinity };
  
  const now = new Date();
  const end = new Date(endsAt);
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return { isEndingSoon: false, timeLeft: null, hoursLeft: 0 };
  
  const hoursLeft = diff / (1000 * 60 * 60);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  let timeLeft: string;
  if (days > 0) {
    timeLeft = `${days}d ${hours}h`;
  } else if (hours > 0) {
    timeLeft = `${hours}h ${minutes}m`;
  } else {
    timeLeft = `${minutes}m`;
  }
  
  return {
    isEndingSoon: hoursLeft <= 2, // 2 hours or less
    timeLeft,
    hoursLeft,
  };
}

export function SubmissionEntrySheet({
  open,
  onOpenChange,
  challenge,
  onSelectFromLibrary,
}: SubmissionEntrySheetProps) {
  const navigate = useNavigate();
  const [showEndingSoonWarning, setShowEndingSoonWarning] = useState(false);
  
  const status = getChallengeStatus(challenge);
  const urgency = useMemo(() => getTimeUrgency(challenge.ends_at), [challenge.ends_at]);
  const isEnded = !status.isOpen;

  const handleRecordNew = () => {
    // If ending soon, show warning first
    if (urgency.isEndingSoon && !showEndingSoonWarning) {
      setShowEndingSoonWarning(true);
      return;
    }
    
    // Navigate to capture with challenge context
    onOpenChange(false);
    setShowEndingSoonWarning(false);
    navigate("/dashboard", { 
      state: { 
        challengeId: challenge.id,
        challengeTitle: challenge.title 
      } 
    });
  };

  const handleSelectFromLibrary = () => {
    onOpenChange(false);
    setShowEndingSoonWarning(false);
    onSelectFromLibrary();
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setShowEndingSoonWarning(false);
    }
    onOpenChange(open);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="font-display text-xl sm:text-2xl">
            Submit to "{challenge.title}"
          </SheetTitle>
          <SheetDescription>
            {isEnded 
              ? "This challenge has ended. Submissions are closed."
              : "Choose how you want to submit your moment"
            }
          </SheetDescription>
        </SheetHeader>

        {/* Ending Soon Warning Banner */}
        {showEndingSoonWarning && urgency.isEndingSoon && (
          <div className="mb-4 p-4 rounded-lg border border-orange-500/30 bg-orange-500/10 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-orange-400">
                Challenge ends in {urgency.timeLeft}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                You may not have enough time to record, edit, and submit. Consider using an existing clip instead.
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowEndingSoonWarning(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    setShowEndingSoonWarning(false);
                    navigate("/dashboard", { 
                      state: { 
                        challengeId: challenge.id,
                        challengeTitle: challenge.title 
                      } 
                    });
                  }}
                >
                  Record Anyway
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Challenge Ended State */}
        {isEnded && (
          <div className="mb-4 p-4 rounded-lg border border-border/50 bg-muted/30 flex items-center gap-3">
            <Ban className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              This challenge is no longer accepting submissions.
            </p>
          </div>
        )}

        {/* Options Grid */}
        {!showEndingSoonWarning && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
            {/* Record Now (Primary) */}
            <button
              className={cn(
                "relative h-auto p-5 flex flex-col items-start gap-3 text-left",
                "rounded-xl border-2 transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isEnded
                  ? "border-border/30 bg-muted/20 opacity-50 cursor-not-allowed"
                  : "border-primary/50 bg-primary/5 hover:border-primary hover:bg-primary/10 active:scale-[0.98]"
              )}
              onClick={handleRecordNew}
              disabled={isEnded}
            >
              {/* Primary badge */}
              {!isEnded && (
                <Badge className="absolute top-3 right-3 bg-primary/20 text-primary border-0 text-xs">
                  Recommended
                </Badge>
              )}
              
              <div className={cn(
                "h-12 w-12 rounded-lg flex items-center justify-center",
                isEnded ? "bg-muted" : "bg-primary/20"
              )}>
                <Video className={cn(
                  "h-6 w-6",
                  isEnded ? "text-muted-foreground" : "text-primary"
                )} />
              </div>
              
              <div>
                <div className={cn(
                  "font-semibold flex items-center gap-2",
                  isEnded && "text-muted-foreground"
                )}>
                  Record Now
                  {!isEnded && <ArrowRight className="h-4 w-4" />}
                </div>
                <p className="text-sm text-muted-foreground font-normal mt-1">
                  Record a new moment for this challenge
                </p>
                <p className="text-xs text-muted-foreground/70 font-normal mt-0.5">
                  Capture gameplay now, submit after.
                </p>
              </div>

              {/* Time warning indicator */}
              {!isEnded && urgency.isEndingSoon && (
                <div className="flex items-center gap-1.5 text-xs text-orange-400 mt-1">
                  <Clock className="h-3 w-3" />
                  <span>Only {urgency.timeLeft} left</span>
                </div>
              )}
            </button>

            {/* Choose from Library (Secondary) */}
            <button
              className={cn(
                "h-auto p-5 flex flex-col items-start gap-3 text-left",
                "rounded-xl border-2 transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isEnded
                  ? "border-border/30 bg-muted/20 opacity-50 cursor-not-allowed"
                  : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-card active:scale-[0.98]"
              )}
              onClick={handleSelectFromLibrary}
              disabled={isEnded}
            >
              <div className={cn(
                "h-12 w-12 rounded-lg flex items-center justify-center",
                isEnded ? "bg-muted" : "bg-secondary/50"
              )}>
                <Library className={cn(
                  "h-6 w-6",
                  isEnded ? "text-muted-foreground" : "text-foreground"
                )} />
              </div>
              
              <div>
                <div className={cn(
                  "font-semibold flex items-center gap-2",
                  isEnded && "text-muted-foreground"
                )}>
                  Choose from Library
                  {!isEnded && <ArrowRight className="h-4 w-4" />}
                </div>
                <p className="text-sm text-muted-foreground font-normal mt-1">
                  Submit an existing clip
                </p>
                <p className="text-xs text-muted-foreground/70 font-normal mt-0.5">
                  Use a past recording or annotation.
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Quick tip */}
        {!isEnded && !showEndingSoonWarning && (
          <p className="text-xs text-muted-foreground text-center pb-2">
            Tip: If you already have the perfect clip, choosing from library is faster.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
