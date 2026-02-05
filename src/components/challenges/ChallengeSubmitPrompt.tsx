import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Clock, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChallengeSubmitPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengeId: string;
  challengeTitle: string;
  sessionId: string;
  onSubmitNow: () => void;
  onLater: () => void;
}

export function ChallengeSubmitPrompt({
  open,
  onOpenChange,
  challengeId,
  challengeTitle,
  sessionId,
  onSubmitNow,
  onLater,
}: ChallengeSubmitPromptProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="font-display text-xl">
              Recording Complete!
            </DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Want to submit a moment from this recording to{" "}
            <span className="font-medium text-foreground">"{challengeTitle}"</span>?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-4">
          {/* Submit Now - Primary action */}
          <Button
            size="lg"
            onClick={onSubmitNow}
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Submit Now
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>

          {/* Later - Secondary action */}
          <Button
            variant="ghost"
            size="lg"
            onClick={onLater}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <Clock className="h-4 w-4 mr-2" />
            I'll do it later
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          You can always submit from your Library or the Challenge page.
        </p>
      </DialogContent>
    </Dialog>
  );
}
