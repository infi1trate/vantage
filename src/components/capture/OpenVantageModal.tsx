import { useState, useCallback } from "react";
import { Monitor, RefreshCw, ChevronDown, ChevronUp, Apple } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { openVantageApp, trackCaptureCTAClick } from "@/lib/desktopDeepLink";

interface OpenVantageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenVantageModal({ open, onOpenChange }: OpenVantageModalProps) {
  const [attempting, setAttempting] = useState(false);
  const [showTips, setShowTips] = useState(false);

  const attemptDeepLink = useCallback(async () => {
    setAttempting(true);
    const result = await openVantageApp();
    setAttempting(false);

    if (result === "failed") {
      // Keep modal open — user can download or retry
    } else {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  const handleOpen = useCallback(() => {
    trackCaptureCTAClick();
    attemptDeepLink();
  }, [attemptDeepLink]);

  // Auto-attempt on first open
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (nextOpen) {
        // Small delay so modal renders before deep link fires
        setTimeout(() => handleOpen(), 200);
      } else {
        setShowTips(false);
        setAttempting(false);
      }
    },
    [onOpenChange, handleOpen]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Monitor className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center font-display text-xl tracking-wide">
            {attempting ? "Opening Vantage…" : "Open Vantage Desktop"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {attempting
              ? "Launching the desktop app. This may take a moment."
              : "If nothing happens, you may not have the desktop app installed."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            className="w-full gap-2"
            asChild
          >
            <a
              href="https://www.dropbox.com/scl/fi/nibofwti4pf9rtw591i6e/Vantage-Desktop-0.1.0-arm64-mac.zip?rlkey=vtcmh6zpanea8poou7lbqwtf8&dl=0"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Apple className="h-4 w-4" />
              Download for macOS
            </a>
          </Button>

          <Button
            variant="outline"
            onClick={() => attemptDeepLink()}
            disabled={attempting}
            className="w-full gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${attempting ? "animate-spin" : ""}`} />
            Try again
          </Button>
        </div>

        {/* Troubleshooting tips */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowTips((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            Having trouble?
            {showTips ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {showTips && (
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground list-disc list-inside">
              <li>
                If you already installed Vantage, make sure it's in your Applications
                folder and open it once.
              </li>
              <li>
                Your browser may block app opens — try clicking "Try again".
              </li>
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
