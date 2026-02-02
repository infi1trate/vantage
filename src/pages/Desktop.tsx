/**
 * Desktop Capture Preview Page
 * 
 * Preview page for the desktop capture popover UI.
 * Shows the popover centered on page with state controls.
 */

import { useState } from "react";
import { DesktopCapturePopover } from "@/components/desktop";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RotateCcw, 
  Monitor, 
  Smartphone, 
  Info,
  ExternalLink,
} from "lucide-react";

type PreviewSize = "small" | "medium" | "large";

const SIZE_WIDTHS: Record<PreviewSize, string> = {
  small: "360px",
  medium: "440px",
  large: "520px",
};

export default function DesktopPage() {
  const [size, setSize] = useState<PreviewSize>("small");
  const [key, setKey] = useState(0); // For resetting popover state

  const handleReset = () => {
    setKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Header */}
      <header className="border-b border-white/10 bg-background/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold uppercase tracking-wider">
                Desktop Capture UI
              </h1>
              <Badge variant="outline" className="text-xs uppercase tracking-wider">
                Preview Mode
              </Badge>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Size toggle */}
              <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSize("small")}
                  className={`h-7 px-2 text-xs ${size === "small" ? "bg-white/10" : ""}`}
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1" />
                  360px
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSize("medium")}
                  className={`h-7 px-2 text-xs ${size === "medium" ? "bg-white/10" : ""}`}
                >
                  <Monitor className="w-3.5 h-3.5 mr-1" />
                  440px
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSize("large")}
                  className={`h-7 px-2 text-xs ${size === "large" ? "bg-white/10" : ""}`}
                >
                  <Monitor className="w-3.5 h-3.5 mr-1" />
                  520px
                </Button>
              </div>

              {/* Reset button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="h-8 text-xs uppercase tracking-wider"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset State
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-12">
        <div className="max-w-4xl mx-auto">
          {/* Info banner */}
          <div className="mb-8 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                This is a UI preview of the desktop menubar popover
              </p>
              <p className="text-xs text-muted-foreground">
                All recording functionality is mocked. Click through the states to see the complete flow: 
                unauthorized → idle → window picker → countdown → recording → processing.
              </p>
            </div>
          </div>

          {/* Popover preview area */}
          <div className="flex flex-col items-center">
            {/* Fake menubar */}
            <div className="w-full max-w-xl mb-4 flex items-center justify-end gap-2 px-4 py-2 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Menubar Preview</span>
                <div className="w-2 h-2 rounded-full bg-vantage-green" />
              </div>
            </div>

            {/* Popover container with size control */}
            <div 
              className="transition-all duration-300"
              style={{ width: SIZE_WIDTHS[size] }}
            >
              <DesktopCapturePopover key={key} />
            </div>

            {/* Size indicator */}
            <p className="mt-4 text-xs text-muted-foreground">
              Current width: {SIZE_WIDTHS[size]}
            </p>
          </div>

          {/* State guide */}
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3">
                Available States
              </h3>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span><strong>Unauthorized:</strong> Initial state, request permissions</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-vantage-green" />
                  <span><strong>Idle:</strong> Ready to configure and start</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span><strong>Selecting Source:</strong> Window picker grid</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <span><strong>Countdown:</strong> 3-2-1 before recording</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <span><strong>Recording:</strong> Active capture with HUD</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span><strong>Processing:</strong> Upload after recording</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <span><strong>Error:</strong> Something went wrong (20% chance on stop)</span>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3">
                Interaction Guide
              </h3>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>1. Click <strong>"Grant Permissions"</strong> to enter idle state</li>
                <li>2. Select a capture source (Full screen, Window, Camera)</li>
                <li>3. For "Specific window", click to open the window picker</li>
                <li>4. Toggle mic/camera and select devices</li>
                <li>5. Click <strong>"Start Recording"</strong> for 3-2-1 countdown</li>
                <li>6. During recording, use the mini HUD to pause/stop</li>
                <li>7. After stopping, see processing or error state</li>
                <li>8. Use <strong>"Reset State"</strong> to start over</li>
              </ul>
            </div>
          </div>

          {/* Component list */}
          <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3">
              Reusable Components
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                "PopoverShell",
                "SourceRow", 
                "ToggleRow",
                "PrimaryCTA",
                "HUDMini",
                "PopoverToast",
                "WindowPickerGrid",
              ].map((name) => (
                <Badge 
                  key={name} 
                  variant="outline" 
                  className="text-xs font-mono"
                >
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
