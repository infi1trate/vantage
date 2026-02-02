/**
 * Desktop Capture Popover Preview Page
 * 
 * Preview page for the desktop capture popover UI.
 * Shows the popover centered at 380px fixed width.
 */

import { useState } from "react";
import { DesktopCapturePopover } from "@/components/desktop";
import { Button } from "@/components/ui/button";
import { RotateCcw, Info } from "lucide-react";

export default function DesktopPage() {
  const [key, setKey] = useState(0);

  const handleReset = () => {
    setKey(prev => prev + 1);
  };

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

      {/* Centered Popover */}
      <main className="flex-1 flex flex-col items-center px-4">
        {/* Popover at fixed 380px */}
        <div className="w-[380px]">
          <DesktopCapturePopover key={key} />
        </div>

        {/* Reset button below */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
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
