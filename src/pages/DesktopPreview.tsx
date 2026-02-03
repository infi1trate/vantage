/**
 * Desktop Capture Popover Preview Page (Dev-Only)
 * 
 * Preview page for testing the desktop capture popover UI states.
 * Shows the popover with helper text and dev controls.
 * Not auth-guarded — purely for development/testing.
 */

import { DesktopCapturePopover, HUDMini, usePopoverState } from "@/components/desktop";
import { Button } from "@/components/ui/button";
import { RotateCcw, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DesktopPreviewPage() {
  // Shared state for both popover and HUD
  const popover = usePopoverState();

  const isRecording = popover.state === "recording" || popover.state === "paused";

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col">
      {/* Page Header */}
      <header className="py-8 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wider text-foreground mb-2">
          Vantage Desktop Popover UI
          <span className="text-muted-foreground font-normal ml-2">(Preview)</span>
        </h1>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          All recording functionality is stubbed. Click through to explore the UI states.
        </p>
      </header>

      {/* Centered Popover with HUD */}
      <main className="flex-1 flex flex-col items-center px-4">
        {/* Container for popover + HUD */}
        <div className="relative">
          {/* Mini HUD - floating pill to the left during recording */}
          <div className={cn(
            "absolute -left-20 top-1/2 -translate-y-1/2 z-10",
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

          {/* Popover at fixed 380px - uses shared external state */}
          <div 
            className="w-[380px]"
            style={{ height: '560px' }}
          >
            <DesktopCapturePopover externalState={popover} />
          </div>
        </div>

        {/* Reset button below */}
        <Button
          variant="ghost"
          size="sm"
          onClick={popover.reset}
          className="mt-6 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          Reset State
        </Button>

        {/* State flow hint */}
        <p className="mt-4 text-[10px] text-muted-foreground/60 max-w-xs text-center">
          Flow: Grant Permissions → Configure → Start → Recording HUD → Stop → Processing
        </p>

        {/* Current state indicator */}
        <div className="mt-4 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
          <p className="text-[10px] font-mono text-muted-foreground">
            State: <span className="text-vantage-green">{popover.state}</span>
            {popover.postRecordingPhase && (
              <span className="text-muted-foreground/60"> → {popover.postRecordingPhase}</span>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
