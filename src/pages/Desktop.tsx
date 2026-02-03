/**
 * Desktop Capture Popover Page
 * 
 * Renders the desktop capture popover as a real menubar-style UI.
 * Requires authentication — redirects to /auth if not logged in.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DesktopCapturePopover, HUDMini, usePopoverState } from "@/components/desktop";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

export default function DesktopPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?returnTo=/desktop", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0b] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated — will redirect
  if (!user) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0b] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Authenticated — render popover
  return <AuthenticatedDesktopView />;
}

/** Separate component to ensure usePopoverState only runs when authenticated */
function AuthenticatedDesktopView() {
  // Start popover in idle state (authenticated context)
  const popover = usePopoverState({ startAuthenticated: true });
  const isRecording = popover.state === "recording" || popover.state === "paused";

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0a0b] flex justify-center pt-3 px-3">
      {/* Container for popover + HUD */}
      <div className="relative w-[380px] max-h-[calc(100vh-24px)]">
        {/* Mini HUD - floating pill to the left during recording */}
        <div className={cn(
          "absolute -left-20 top-4 z-10",
          "transition-all duration-300",
          isRecording 
            ? "opacity-100 translate-x-0" 
            : "opacity-0 -translate-x-4 pointer-events-none"
        )}>
          <HUDMini
            duration={popover.duration}
            isPaused={popover.isPaused}
            onPause={popover.pauseRecording}
            onResume={popover.resumeRecording}
            onStop={popover.stopRecording}
          />
        </div>

        {/* Popover with internal scroll */}
        <ScrollArea className="h-full">
          <DesktopCapturePopover externalState={popover} />
        </ScrollArea>
      </div>
    </div>
  );
}
