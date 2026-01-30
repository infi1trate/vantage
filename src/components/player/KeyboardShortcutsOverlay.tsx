import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Keyboard, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Undo2,
  X,
  Target,
  MessageSquare,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortcutCategory {
  title: string;
  shortcuts: {
    keys: string[];
    description: string;
    icon?: React.ReactNode;
  }[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: "Playback",
    shortcuts: [
      { keys: ["Space", "K"], description: "Play / Pause", icon: <Play className="h-3.5 w-3.5" /> },
      { keys: ["M"], description: "Mute / Unmute", icon: <Volume2 className="h-3.5 w-3.5" /> },
      { keys: ["F"], description: "Fullscreen", icon: <Maximize2 className="h-3.5 w-3.5" /> },
      { keys: ["J"], description: "Skip back 10s", icon: <SkipBack className="h-3.5 w-3.5" /> },
      { keys: ["L"], description: "Skip forward 10s", icon: <SkipForward className="h-3.5 w-3.5" /> },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["←"], description: "Frame step back", icon: <ChevronLeft className="h-3.5 w-3.5" /> },
      { keys: ["→"], description: "Frame step forward", icon: <ChevronRight className="h-3.5 w-3.5" /> },
      { keys: ["Shift", "←"], description: "Skip back 1s" },
      { keys: ["Shift", "→"], description: "Skip forward 1s" },
      { keys: ["["], description: "Previous marker" },
      { keys: ["]"], description: "Next marker" },
    ],
  },
  {
    title: "Selection & Marking",
    shortcuts: [
      { keys: ["I"], description: "Set In point (range start)", icon: <Target className="h-3.5 w-3.5" /> },
      { keys: ["O"], description: "Set Out point (range end)" },
      { keys: ["Esc"], description: "Clear selection", icon: <X className="h-3.5 w-3.5" /> },
      { keys: ["⌘", "Z"], description: "Undo", icon: <Undo2 className="h-3.5 w-3.5" /> },
    ],
  },
  {
    title: "Speed",
    shortcuts: [
      { keys: ["<"], description: "Decrease playback speed" },
      { keys: [">"], description: "Increase playback speed" },
      { keys: [","], description: "Frame back" },
      { keys: ["."], description: "Frame forward" },
    ],
  },
  {
    title: "General",
    shortcuts: [
      { keys: ["?"], description: "Show this help", icon: <Keyboard className="h-3.5 w-3.5" /> },
      { keys: ["Esc"], description: "Close dialogs / Exit focus mode" },
    ],
  },
];

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsOverlay({ 
  open, 
  onOpenChange,
}: KeyboardShortcutsOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {SHORTCUT_CATEGORIES.map((category) => (
            <div key={category.title} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {category.title}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      {shortcut.icon && (
                        <span className="text-muted-foreground">
                          {shortcut.icon}
                        </span>
                      )}
                      <span>{shortcut.description}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <kbd 
                          key={keyIdx}
                          className={cn(
                            "inline-flex items-center justify-center",
                            "min-w-[28px] h-7 px-2",
                            "text-xs font-mono font-medium",
                            "bg-background border border-border rounded-md shadow-sm",
                            "text-foreground"
                          )}
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-foreground font-mono text-xs">?</kbd> anytime to show this help
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage keyboard shortcuts overlay state
export function useKeyboardShortcuts() {
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Show shortcuts on "?" key
      if (e.key === "?" || (e.shiftKey && e.code === "Slash")) {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    showShortcuts,
    setShowShortcuts,
  };
}
