import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Trophy, Flame, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface HowItWorksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  {
    step: "1",
    title: "Find a Challenge",
    description: "Browse active challenges that match your game and skill level. Each challenge has specific rules and a deadline.",
    icon: Trophy,
  },
  {
    step: "2",
    title: "Capture the Moment",
    description: "Record your gameplay and capture the feat required by the challenge. Mark your best moment with a Reaction or Moment tag.",
    icon: Flame,
  },
  {
    step: "3",
    title: "Submit & Win",
    description: "Trim your clip to the highlight and submit before the deadline. Winners are selected by the host and announced when judging ends.",
    icon: Crown,
  },
];

export function HowItWorksModal({ open, onOpenChange }: HowItWorksModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">How Challenges Work</DialogTitle>
          <DialogDescription>
            Compete in gameplay feats, submit your best moments, and win prizes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {STEPS.map((item) => (
            <div
              key={item.step}
              className={cn(
                "relative flex gap-4 p-4 rounded-xl",
                "border border-border/50 bg-card/30"
              )}
            >
              <div className="shrink-0 h-10 w-10 rounded-full bg-primary text-primary-foreground font-display font-bold text-lg flex items-center justify-center">
                {item.step}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <item.icon className="h-4 w-4 text-primary" />
                  <h3 className="font-display font-bold">{item.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
          All challenges are judged by the host. Play fair, submit honest clips.
        </div>
      </DialogContent>
    </Dialog>
  );
}
