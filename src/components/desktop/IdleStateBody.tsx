/**
 * IdleStateBody
 * 
 * Body content for the idle/authorized state of the desktop capture popover.
 * Loom-style tappable rows for source, camera, mic.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Monitor, AppWindow, Video, VideoOff, Mic, MicOff, ChevronDown, Sparkles, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRecordingLimit, MOCK_MICS, CaptureSourceType } from "./types";
import { MoreMenu } from "./MoreMenu";
import { EffectsModal } from "./EffectsModal";

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
  // Account
  username: string;
  onSignOut: () => void;
  // Settings
  forceUploadError: boolean;
  onForceUploadErrorChange: (value: boolean) => void;
}

// Get source display info
function getSourceDisplay(type: CaptureSourceType, windowName?: string) {
  switch (type) {
    case "screen":
      return { 
        icon: Monitor, 
        label: "Full screen",
        sublabel: null,
      };
    case "window":
      return { 
        icon: AppWindow, 
        label: "Specific window",
        sublabel: windowName || null,
      };
    case "camera":
      return { 
        icon: Video, 
        label: "Camera only",
        sublabel: null,
      };
    default:
      return { icon: Monitor, label: "Select source", sublabel: null };
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
  username,
  onSignOut,
  forceUploadError,
  onForceUploadErrorChange,
}: IdleStateBodyProps) {
  const [effectsOpen, setEffectsOpen] = useState(false);
  
  const selectedMic = MOCK_MICS.find(m => m.id === selectedMicId) || MOCK_MICS[0];
  const sourceDisplay = getSourceDisplay(sourceType, selectedWindowName);
  const SourceIcon = sourceDisplay.icon;
  
  // Truncate device name (Loom-style: "Default - MacBo…")
  const formatMicName = (name: string, isDefault?: boolean) => {
    const prefix = isDefault ? "Default – " : "";
    const displayName = name.replace(/^Default\s*[-–]\s*/i, "");
    const maxLen = isDefault ? 12 : 18;
    const truncated = displayName.length > maxLen 
      ? displayName.slice(0, maxLen) + "…" 
      : displayName;
    return prefix + truncated;
  };

  return (
    <div className="flex flex-col relative">
      {/* Effects Modal */}
      <EffectsModal
        isOpen={effectsOpen}
        onClose={() => setEffectsOpen(false)}
        cameraEnabled={cameraEnabled}
      />

      {/* Configuration Rows */}
      <div className="space-y-0.5">
        {/* Source Row */}
        <button
          onClick={onSourceRowClick}
          aria-label={`Change capture source. Current: ${sourceDisplay.label}`}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
            "transition-all duration-150",
            "hover:bg-white/[0.04] active:bg-white/[0.06]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "group"
          )}
        >
          <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
            "bg-white/[0.06] border border-white/[0.08]",
            "group-hover:border-white/[0.12] transition-colors"
          )}>
            <SourceIcon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-medium text-foreground leading-tight">
              {sourceDisplay.label}
            </div>
            {sourceDisplay.sublabel && (
              <div className="text-xs text-vantage-green truncate mt-0.5 max-w-[180px]">
                {sourceDisplay.sublabel}
              </div>
            )}
          </div>
          <span className={cn(
            "text-xs font-medium text-vantage-green",
            "opacity-70 group-hover:opacity-100 transition-opacity"
          )}>
            Select
          </span>
        </button>

        {/* Divider */}
        <div className="h-px bg-white/[0.06] mx-3" aria-hidden="true" />

        {/* Camera Row - only show if source is not camera-only */}
        {sourceType !== "camera" && (
          <>
            <button
              onClick={onToggleCamera}
              aria-label={`Toggle camera. Currently ${cameraEnabled ? "on" : "off"}`}
              aria-pressed={cameraEnabled}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
                "transition-all duration-150",
                "hover:bg-white/[0.04] active:bg-white/[0.06]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "group"
              )}
            >
              <div className={cn(
                "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                "border transition-all duration-150",
                cameraEnabled 
                  ? "bg-vantage-green/15 border-vantage-green/30" 
                  : "bg-white/[0.06] border-white/[0.08] group-hover:border-white/[0.12]"
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
                "px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider",
                "transition-all duration-150",
                cameraEnabled 
                  ? "bg-vantage-green/20 text-vantage-green" 
                  : "bg-white/[0.08] text-muted-foreground"
              )}>
                {cameraEnabled ? "On" : "Off"}
              </div>
            </button>

            {/* Divider */}
            <div className="h-px bg-white/[0.06] mx-3" aria-hidden="true" />
          </>
        )}

        {/* Mic Row with Dropdown */}
        <div className="flex items-center gap-1 px-3 py-1.5">
          <button
            onClick={onToggleMic}
            aria-label={`Toggle microphone. Currently ${micEnabled ? "on" : "off"}`}
            aria-pressed={micEnabled}
            className={cn(
              "flex items-center gap-3 flex-1 py-1.5 px-0 rounded-xl",
              "transition-all duration-150",
              "hover:bg-white/[0.04] active:bg-white/[0.06]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "group"
            )}
          >
            <div className={cn(
              "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
              "border transition-all duration-150",
              micEnabled 
                ? "bg-vantage-green/15 border-vantage-green/30" 
                : "bg-white/[0.06] border-white/[0.08] group-hover:border-white/[0.12]"
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
                <div className="text-[11px] text-muted-foreground truncate mt-0.5 max-w-[160px]">
                  {formatMicName(selectedMic?.name || "Select device", selectedMic?.isDefault)}
                </div>
              )}
            </div>
          </button>
          
          {/* Status chip + dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider",
              "transition-all duration-150",
              micEnabled 
                ? "bg-vantage-green/20 text-vantage-green" 
                : "bg-white/[0.08] text-muted-foreground"
            )}>
              {micEnabled ? "On" : "Off"}
            </div>
            
            {micEnabled && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Select microphone device"
                    className={cn(
                      "h-8 w-8 p-0 rounded-lg",
                      "hover:bg-white/[0.08] active:bg-white/[0.12]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    )}
                  >
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  sideOffset={4}
                  className="w-56 bg-background/95 backdrop-blur-xl border-white/10 z-50"
                >
                  {MOCK_MICS.map((mic) => (
                    <DropdownMenuItem
                      key={mic.id}
                      onClick={() => onMicDeviceChange(mic.id)}
                      className={cn(
                        "text-xs cursor-pointer py-2.5",
                        "focus:bg-vantage-green/10 focus:text-vantage-green",
                        mic.id === selectedMicId && "bg-vantage-green/10 text-vantage-green"
                      )}
                    >
                      <Mic className="w-3.5 h-3.5 mr-2 shrink-0" />
                      <span className="truncate flex-1">{mic.name}</span>
                      {mic.isDefault && (
                        <span className="ml-2 text-[10px] text-muted-foreground shrink-0">
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
      <div className="h-px bg-white/[0.08] my-4" aria-hidden="true" />

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
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          Start Recording
        </Button>
        <p className="text-center text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">
          {formatRecordingLimit()}
        </p>
      </div>

      {/* Footer tabs */}
      <div className="h-px bg-white/[0.08] my-4" aria-hidden="true" />
      
      <nav className="flex items-center justify-center gap-8" aria-label="Quick actions">
        <button
          onClick={() => setEffectsOpen(true)}
          aria-label="Open effects settings"
          className={cn(
            "flex flex-col items-center gap-1.5 px-6 py-2 rounded-xl",
            "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
            "transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-wider font-medium">Effects</span>
        </button>
        
        <MoreMenu
          trigger={
            <button
              aria-label="Open more options"
              className={cn(
                "flex flex-col items-center gap-1.5 px-6 py-2 rounded-xl",
                "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
                "transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] uppercase tracking-wider font-medium">More</span>
            </button>
          }
          username={username}
          onSignOut={onSignOut}
          forceUploadError={forceUploadError}
          onForceUploadErrorChange={onForceUploadErrorChange}
        />
      </nav>
    </div>
  );
}
