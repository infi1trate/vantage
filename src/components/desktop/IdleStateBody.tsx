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

  // Shared pill row styles
  const pillRowBase = cn(
    "w-full flex items-center gap-3 px-3 py-4 rounded-2xl",
    "bg-white/[0.03]",
    "transition-all duration-150",
    "hover:bg-white/[0.06] active:bg-white/[0.08] active:scale-[0.99]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "group cursor-pointer"
  );

  const iconContainerBase = cn(
    "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center",
    "transition-all duration-150"
  );

  const statusChip = (isActive: boolean) => cn(
    "px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wide",
    "transition-all duration-150",
    isActive 
      ? "bg-vantage-green/20 text-vantage-green shadow-sm shadow-vantage-green/10" 
      : "bg-white/[0.06] text-muted-foreground"
  );

  return (
    <div className="flex flex-col h-full">
      {/* Effects Modal */}
      <EffectsModal
        isOpen={effectsOpen}
        onClose={() => setEffectsOpen(false)}
        cameraEnabled={cameraEnabled}
      />

      {/* Configuration Rows - compact spacing */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {/* Source Row */}
        <button
          onClick={onSourceRowClick}
          aria-label={`Change capture source. Current: ${sourceDisplay.label}`}
          className={pillRowBase}
        >
          <div className={cn(
            iconContainerBase,
            "bg-white/[0.06] border border-white/[0.08]",
            "group-hover:border-white/[0.15] group-hover:bg-white/[0.08]"
          )}>
            <SourceIcon className="w-5 h-5 text-foreground/80" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-medium text-foreground">
              {sourceDisplay.label}
            </div>
            {sourceDisplay.sublabel && (
              <div className="text-xs text-vantage-green truncate mt-0.5 max-w-[180px]">
                {sourceDisplay.sublabel}
              </div>
            )}
          </div>
          <span className={cn(
            "text-xs font-semibold text-vantage-green px-3 py-1.5 rounded-full",
            "bg-vantage-green/10",
            "opacity-80 group-hover:opacity-100 transition-opacity"
          )}>
            Select
          </span>
        </button>

        {/* Camera Row - only show if source is not camera-only */}
        {sourceType !== "camera" && (
          <button
            onClick={onToggleCamera}
            aria-label={`Toggle camera. Currently ${cameraEnabled ? "on" : "off"}`}
            aria-pressed={cameraEnabled}
            className={pillRowBase}
          >
            <div className={cn(
              iconContainerBase,
              cameraEnabled 
                ? "bg-vantage-green/15 border border-vantage-green/30" 
                : "bg-white/[0.06] border border-white/[0.08] group-hover:border-white/[0.15]"
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
              <div className="text-xs text-muted-foreground mt-0.5">
                {cameraEnabled ? "Record with facecam" : "No facecam"}
              </div>
            </div>
            <div className={statusChip(cameraEnabled)}>
              {cameraEnabled ? "On" : "Off"}
            </div>
          </button>
        )}

        {/* Mic Row */}
        <div className={cn(pillRowBase, "pr-2")}>
          {/* Main clickable area */}
          <button
            onClick={onToggleMic}
            aria-label={`Toggle microphone. Currently ${micEnabled ? "on" : "off"}`}
            aria-pressed={micEnabled}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <div className={cn(
              iconContainerBase,
              micEnabled 
                ? "bg-vantage-green/15 border border-vantage-green/30" 
                : "bg-white/[0.06] border border-white/[0.08] group-hover:border-white/[0.15]"
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
              <div className="text-xs text-muted-foreground truncate mt-0.5 max-w-[160px]">
                {micEnabled 
                  ? formatMicName(selectedMic?.name || "Select device", selectedMic?.isDefault)
                  : "Audio muted"
                }
              </div>
            </div>
          </button>
          
          {/* Status chip + dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onToggleMic}
              className={statusChip(micEnabled)}
            >
              {micEnabled ? "On" : "Off"}
            </button>
            
            {micEnabled && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Select microphone device"
                    className={cn(
                      "h-9 w-9 p-0 rounded-xl",
                      "bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12]",
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

      {/* ============= PERSISTENT CTA DOCK ============= */}
      <div className="flex-shrink-0 pt-3 mt-2">
        {/* Primary CTA Button */}
        <Button
          onClick={onStartRecording}
          disabled={!canStartRecording}
          className={cn(
            "w-full h-14 text-base font-bold tracking-wide",
            "bg-vantage-green hover:bg-vantage-green-bright text-background",
            "shadow-lg shadow-vantage-green/30",
            "rounded-xl",
            "transition-all duration-150",
            "hover:shadow-xl hover:shadow-vantage-green/40 hover:scale-[1.01]",
            "active:scale-[0.98] active:shadow-md",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          Start Recording
        </Button>
        
        {/* Recording limit helper text */}
        <p className="text-center text-[11px] text-muted-foreground mt-2">
          {formatRecordingLimit()}
        </p>

        {/* Footer action bar */}
        <div className="h-px bg-white/[0.06] mt-3 mb-2" aria-hidden="true" />
        
        <nav 
          className="flex items-center justify-between" 
          aria-label="Quick actions"
        >
          {/* Effects button */}
          <button
            onClick={() => setEffectsOpen(true)}
            aria-label="Open effects settings"
            aria-haspopup="dialog"
            className={cn(
              "group flex items-center gap-2 px-4 py-2 rounded-xl",
              "text-muted-foreground",
              "transition-all duration-150 ease-out",
              "hover:text-foreground hover:bg-white/[0.06]",
              "active:scale-[0.97] active:bg-white/[0.08]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              effectsOpen && "text-vantage-green bg-vantage-green/10"
            )}
          >
            <Sparkles className={cn(
              "w-4 h-4 transition-transform duration-150",
              "group-hover:scale-110",
              effectsOpen && "text-vantage-green"
            )} />
            <span className="text-xs font-medium">Effects</span>
          </button>
          
          {/* More button */}
          <MoreMenu
            trigger={
              <button
                aria-label="Open more options menu"
                aria-haspopup="menu"
                className={cn(
                  "group flex items-center gap-2 px-4 py-2 rounded-xl",
                  "text-muted-foreground",
                  "transition-all duration-150 ease-out",
                  "hover:text-foreground hover:bg-white/[0.06]",
                  "active:scale-[0.97] active:bg-white/[0.08]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <MoreHorizontal className={cn(
                  "w-4 h-4 transition-transform duration-150",
                  "group-hover:scale-110"
                )} />
                <span className="text-xs font-medium">More</span>
              </button>
            }
            username={username}
            onSignOut={onSignOut}
            forceUploadError={forceUploadError}
            onForceUploadErrorChange={onForceUploadErrorChange}
          />
        </nav>
      </div>
    </div>
  );
}
