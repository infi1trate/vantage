/**
 * Desktop Capture Popover Page
 * 
 * Renders the desktop capture popover as a real menubar-style UI.
 * No preview wrapper — just the popover itself.
 */

import { DesktopCapturePopover, HUDMini, usePopoverState } from "@/components/desktop";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DesktopPage() {
  const popover = usePopoverState();
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
