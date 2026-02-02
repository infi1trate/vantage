/**
 * QuickStartSheet
 * 
 * Modal sheet showing quick start guide and keyboard shortcuts.
 */

import { cn } from "@/lib/utils";
import { Monitor, Play, Upload, Command, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuickStartSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    icon: Monitor,
    text: "Choose what to record (full screen or a window)",
  },
  {
    icon: Play,
    text: "Start recording from the menubar",
  },
  {
    icon: Upload,
    text: "Stop to upload and open the editor automatically",
  },
];

const SHORTCUTS = [
  { label: "Start/Stop", keys: "⌥⌘R" },
  { label: "Pause/Resume", keys: "⌥⌘P" },
];

export function QuickStartSheet({ isOpen, onClose }: QuickStartSheetProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={cn(
          "sm:max-w-[380px] p-0 gap-0",
          "bg-background/95 backdrop-blur-xl border-white/[0.08]",
          "shadow-2xl shadow-black/50"
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold text-foreground">
            Quick start
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {/* Steps */}
          <div className="space-y-3">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div 
                  key={index} 
                  className="flex items-start gap-3"
                >
                  <div className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                    "bg-vantage-green/10 border border-vantage-green/20"
                  )}>
                    <Icon className="w-4 h-4 text-vantage-green" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed pt-1.5">
                    {step.text}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.08]" aria-hidden="true" />

          {/* Shortcuts section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
              <Keyboard className="w-3.5 h-3.5" />
              Shortcuts
            </div>
            
            <div className="space-y-2">
              {SHORTCUTS.map((shortcut) => (
                <div 
                  key={shortcut.label}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-sm text-foreground">
                    {shortcut.label}
                  </span>
                  <kbd className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-mono",
                    "bg-white/[0.06] border border-white/[0.1]",
                    "text-muted-foreground"
                  )}>
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Done button */}
          <Button
            onClick={onClose}
            className={cn(
              "w-full bg-vantage-green hover:bg-vantage-green/90 text-background font-medium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
