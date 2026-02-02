/**
 * IdleStateBody
 * 
 * Body content for the idle/authorized state of the desktop capture popover.
 * Loom-style tappable rows for source, camera, mic.
 */

import { cn } from "@/lib/utils";
import { Monitor, AppWindow, Video, VideoOff, Mic, MicOff, ChevronDown, ChevronRight, Sparkles, StickyNote, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRecordingLimit, MOCK_MICS, CaptureSourceType } from "./types";

interface IdleStateBodyProps {
  // Source
  sourceType: CaptureSourceType;
  selectedWindowName?: string;
  onSourceRowClick: () => void;
  // Camera
  cameraEnabled: boolean;
  onToggleCamera: () => void;
  // Mic
  micEnabled: boolean;
  onToggleMic: () => void;
  selectedMicId: string | null;
  onMicDeviceChange: (deviceId: string) => void;
  // CTA
  onStartRecording: () => void;
  canStartRecording: boolean;
  // Footer
  onEffectsClick?: () => void;
  onNotesClick?: () => void;
  onMoreClick?: () => void;
}

// Get source display info
function getSourceDisplay(sourceType: CaptureSourceType, windowName?: string) {
  switch (sourceType) {
    case "screen":
      return {
        icon: Monitor,
        label: "Full screen",
        sublabel: undefined,
      };
    case "window":
      return {
        icon: AppWindow,
        label: "Specific window",
        sublabel: windowName,
      };
    case "camera":
      return {
        icon: Video,
        label: "Camera only",
        sublabel: undefined,
      };
  }
}

export function IdleStateBody({
  sourceType,
  selectedWindowName,
  onSourceRowClick,
  cameraEnabled,
  onToggleCamera,
  micEnabled,
  onToggleMic,
  selectedMicId,
  onMicDeviceChange,
  onStartRecording,
  canStartRecording,
  onEffectsClick,
  onNotesClick,
  onMoreClick,
}: IdleStateBodyProps) {
  const selectedMic = MOCK_MICS.find(m => m.id === selectedMicId) || MOCK_MICS[0];
  const sourceDisplay = getSourceDisplay(sourceType, selectedWindowName);
  const SourceIcon = sourceDisplay.icon;
  
  // Truncate device name
  const truncateDeviceName = (name: string, maxLen = 20) => {
    if (name.length <= maxLen) return name;
    return name.slice(0, maxLen) + "…";
  };

  return (
    <div className="flex flex-col">
      {/* Body rows */}
      <div className="space-y-1">
        {/* Source Row */}
        <button
          onClick={onSourceRowClick}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-3 rounded-lg",
            "transition-all duration-150",
            "hover:bg-white/5 active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green/50"
          )}
        >
          <div className={cn(
            "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
            sourceType === "camera" && cameraEnabled ? "bg-vantage-green/20" : "bg-white/5"
          )}>
            <SourceIcon className={cn(
              "w-5 h-5",
              sourceType === "camera" && cameraEnabled ? "text-vantage-green" : "text-muted-foreground"
            )} />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-medium text-foreground">
              {sourceDisplay.label}
            </div>
            {sourceDisplay.sublabel && (
              <div className="text-xs text-vantage-green truncate">
                {sourceDisplay.sublabel}
              </div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Divider */}
        <div className="h-px bg-white/5 mx-3" />

        {/* Camera Row - only show if source is not camera-only */}
        {sourceType !== "camera" && (
          <>
            <button
              onClick={onToggleCamera}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-lg",
                "transition-all duration-150",
                "hover:bg-white/5 active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green/50"
              )}
            >
              <div className={cn(
                "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                cameraEnabled ? "bg-vantage-green/20" : "bg-white/5"
              )}>
                {cameraEnabled ? (
                  <Video className="w-5 h-5 text-vantage-green" />
                ) : (
                  <VideoOff className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-foreground">
                  Camera
                </div>
              </div>
              <div className={cn(
                "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                cameraEnabled 
                  ? "bg-vantage-green/20 text-vantage-green" 
                  : "bg-white/10 text-muted-foreground"
              )}>
                {cameraEnabled ? "On" : "Off"}
              </div>
            </button>

            {/* Divider */}
            <div className="h-px bg-white/5 mx-3" />
          </>
        )}

        {/* Mic Row with Dropdown */}
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            onClick={onToggleMic}
            className={cn(
              "flex items-center gap-3 flex-1 py-1 rounded-lg",
              "transition-all duration-150",
              "hover:bg-white/5 active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green/50"
            )}
          >
            <div className={cn(
              "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
              micEnabled ? "bg-vantage-green/20" : "bg-white/5"
            )}>
              {micEnabled ? (
                <Mic className="w-5 h-5 text-vantage-green" />
              ) : (
                <MicOff className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium text-foreground">
                Microphone
              </div>
              {micEnabled && (
                <div className="text-[11px] text-muted-foreground truncate">
                  {truncateDeviceName(selectedMic?.name || "Select device")}
                </div>
              )}
            </div>
          </button>
          
          {/* Status chip + dropdown */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
              micEnabled 
                ? "bg-vantage-green/20 text-vantage-green" 
                : "bg-white/10 text-muted-foreground"
            )}>
              {micEnabled ? "On" : "Off"}
            </div>
            
            {micEnabled && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-white/10"
                  >
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-56 bg-background border-white/10 z-50"
                >
                  {MOCK_MICS.map((mic) => (
                    <DropdownMenuItem
                      key={mic.id}
                      onClick={() => onMicDeviceChange(mic.id)}
                      className={cn(
                        "text-xs cursor-pointer",
                        mic.id === selectedMicId && "bg-vantage-green/10 text-vantage-green"
                      )}
                    >
                      {mic.name}
                      {mic.isDefault && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          Default
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Divider before CTA */}
      <div className="h-px bg-white/10 my-4" />

      {/* Primary CTA */}
      <div className="px-1">
        <Button
          onClick={onStartRecording}
          disabled={!canStartRecording}
          className={cn(
            "w-full h-12 text-sm font-bold uppercase tracking-wider",
            "bg-vantage-green hover:bg-vantage-green/90 text-background",
            "shadow-lg shadow-vantage-green/25",
            "rounded-xl",
            "transition-all duration-150 active:scale-[0.98]",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          )}
        >
          Start Recording
        </Button>
        <p className="text-center text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">
          {formatRecordingLimit()}
        </p>
      </div>

      {/* Footer tabs */}
      <div className="h-px bg-white/10 my-4" />
      
      <div className="flex items-center justify-around">
        <button
          onClick={onEffectsClick}
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-2 rounded-lg",
            "text-muted-foreground hover:text-foreground hover:bg-white/5",
            "transition-all duration-150"
          )}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-wider">Effects</span>
        </button>
        
        <button
          onClick={onNotesClick}
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-2 rounded-lg",
            "text-muted-foreground hover:text-foreground hover:bg-white/5",
            "transition-all duration-150"
          )}
        >
          <StickyNote className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-wider">Notes</span>
        </button>
        
        <button
          onClick={onMoreClick}
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-2 rounded-lg",
            "text-muted-foreground hover:text-foreground hover:bg-white/5",
            "transition-all duration-150"
          )}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-wider">More</span>
        </button>
      </div>
    </div>
  );
}
