/**
 * Desktop Capture Popover Preview Page
 * 
 * Preview page for the desktop capture popover UI.
 * Shows the popover centered at 380px fixed width.
 * Includes Mini HUD that syncs with popover state during recording.
 */

import { DesktopCapturePopover, HUDMini, usePopoverState } from "@/components/desktop";
import { Button } from "@/components/ui/button";
import { RotateCcw, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DesktopPage() {
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
          <div className="w-[380px]">
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
      </main>
    </div>
  );
}
