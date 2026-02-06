/**
 * Desktop Capture Popover Page
 * 
 * Renders the desktop capture popover as a real menubar-style UI.
 * Requires authentication — redirects to /desktop/auth if not logged in.
 * 
 * IMPORTANT: This page is part of the isolated desktop router.
 * All navigation must stay within /desktop/* routes.
 */

import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DesktopCapturePopover, HUDMini, usePopoverState } from "@/components/desktop";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DESKTOP_ROUTES } from "@/lib/desktopMode";

export default function DesktopPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  // Redirect to desktop auth if not logged in (NOT /auth)
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(DESKTOP_ROUTES.AUTH, { replace: true });
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
  return <AuthenticatedDesktopView user={user} />;
}

interface AuthenticatedDesktopViewProps {
  user: { id: string; email?: string };
}

/** Separate component to ensure usePopoverState only runs when authenticated */
function AuthenticatedDesktopView({ user }: AuthenticatedDesktopViewProps) {
  const navigate = useNavigate();

  // Sign out handler - signs out of Supabase and redirects to desktop auth (NOT /auth)
  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate(DESKTOP_ROUTES.AUTH, { replace: true });
  }, [navigate]);

  // Home button handler - navigates to /desktop (NOT /library)
  const handleHome = useCallback(() => {
    navigate(DESKTOP_ROUTES.ROOT);
  }, [navigate]);

  // Extract username from email
  const userInfo = {
    username: user.email?.split("@")[0] || "User",
    email: user.email || "",
  };

  // Start popover in idle state (authenticated context) with user info
  const popover = usePopoverState({ 
    startAuthenticated: true,
    user: userInfo,
    onSignOut: handleSignOut,
  });
  const isRecording = popover.state === "recording" || popover.state === "paused";

  return (
    <div className="h-screen w-screen overflow-hidden bg-background flex justify-center items-start">
      {/* Container for popover + HUD - constrained to Electron dimensions */}
      <div className="relative flex">
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

        {/* Popover - fills Electron window dimensions */}
        <div 
          className="w-[380px] max-w-[100vw]"
          style={{ 
            height: 'min(560px, 100vh)',
            maxHeight: '100vh',
          }}
        >
          <DesktopCapturePopover externalState={popover} onHome={handleHome} />
        </div>
      </div>
    </div>
  );
}
