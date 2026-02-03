/**
 * AboutModal
 * 
 * Simple modal showing version info and links for the desktop app.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Github, Globe, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// App version - in production this would come from package.json or build config
const APP_VERSION = "1.0.0-beta";
const BUILD_DATE = "2026";

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const openExternal = (url: string) => {
    // If in Electron context, open in system browser
    if (typeof window !== "undefined" && (window as any).vantage?.openExternal) {
      (window as any).vantage.openExternal(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[340px] bg-background/95 backdrop-blur-xl border-white/10">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            {/* Logo placeholder */}
            <div className="w-16 h-16 rounded-2xl bg-vantage-green/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-vantage-green">V</span>
            </div>
          </div>
          <DialogTitle className="text-xl font-bold">Vantage</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Version {APP_VERSION}
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Description */}
          <p className="text-sm text-muted-foreground text-center px-2">
            Capture, review, and share your gameplay moments with powerful editing tools.
          </p>

          {/* Links */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-sm h-10 hover:bg-white/5"
              onClick={() => openExternal("https://getvantage.lovable.app")}
            >
              <Globe className="w-4 h-4 mr-3 text-muted-foreground" />
              Website
              <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground/50" />
            </Button>
            
            <Button
              variant="ghost"
              className="w-full justify-start text-sm h-10 hover:bg-white/5"
              onClick={() => openExternal("https://github.com/vantage-gg")}
            >
              <Github className="w-4 h-4 mr-3 text-muted-foreground" />
              GitHub
              <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground/50" />
            </Button>
          </div>

          {/* Copyright */}
          <div className="pt-4 border-t border-white/5">
            <p className="text-xs text-muted-foreground/60 text-center flex items-center justify-center gap-1">
              Made with <Heart className="w-3 h-3 text-destructive" /> © {BUILD_DATE} Vantage
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
