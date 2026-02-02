/**
 * Reel Editor Intro Modal
 * 
 * One-time modal shown on first entry to the Reel Editor.
 * Helps users understand the mental model difference between
 * Session Detail (review) and Reel Editor (polish).
 * 
 * Persisted via localStorage - never shown again after dismissal.
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Film, Sparkles } from "lucide-react";

const STORAGE_KEY = "vantage_reel_editor_intro_seen";

interface ReelEditorIntroModalProps {
  /** Only show if reel is ready (not compiling) */
  isReelReady: boolean;
}

export function ReelEditorIntroModal({ isReelReady }: ReelEditorIntroModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only check/show when reel is ready
    if (!isReelReady) return;

    // Check if user has already seen the intro
    const hasSeen = localStorage.getItem(STORAGE_KEY);
    if (!hasSeen) {
      // Small delay so the editor loads first
      const timer = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isReelReady]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleDismiss();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-vantage-warning/10 border border-vantage-warning/20">
              <Film className="h-5 w-5 text-vantage-warning" />
            </div>
            <DialogTitle className="text-xl">You're in the Reel Editor</DialogTitle>
          </div>
          <DialogDescription className="text-base leading-relaxed">
            This is where you polish your reel. Add effects, frames, and packages — your session stays untouched.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center gap-2 mt-2 p-3 rounded-lg bg-muted/50 border border-border/50">
          <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            All edits are non-destructive. Export when you're ready.
          </p>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={handleDismiss} className="px-6">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
