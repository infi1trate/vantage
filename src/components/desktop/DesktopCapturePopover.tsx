/**
 * DesktopCapturePopover
 * 
 * Main popover component that orchestrates all states.
 * This is the primary UI for the desktop capture experience.
 */

import { PopoverShell } from "./PopoverShell";
import { PrimaryCTA } from "./PrimaryCTA";
import { HUDMini } from "./HUDMini";
import { PopoverToast } from "./PopoverToast";
import { WindowPickerGrid } from "./WindowPickerGrid";
import { SourceTypeSheet } from "./SourceTypeSheet";
import { IdleStateBody } from "./IdleStateBody";
import { usePopoverState } from "./usePopoverState";
import { MOCK_WINDOWS } from "./types";
import { Shield } from "lucide-react";

interface DesktopCapturePopoverProps {
  className?: string;
  onClose?: () => void;
  onHome?: () => void;
}

export function DesktopCapturePopover({ className, onClose, onHome }: DesktopCapturePopoverProps) {
  const popover = usePopoverState();

  // ============= RECORDING STATE - Show HUD =============
  if (popover.state === "recording" || (popover.state === "countdown" && popover.countdown === null)) {
    return (
      <div className={className}>
        <HUDMini
          duration={popover.duration}
          isPaused={popover.isPaused}
          micEnabled={popover.config.micEnabled}
          cameraEnabled={popover.config.cameraEnabled}
          onPause={popover.pauseRecording}
          onResume={popover.resumeRecording}
          onStop={popover.stopRecording}
          onToggleMic={() => popover.setMicEnabled(!popover.config.micEnabled)}
          onToggleCamera={() => popover.setCameraEnabled(!popover.config.cameraEnabled)}
        />
      </div>
    );
  }

  // ============= COUNTDOWN STATE =============
  if (popover.state === "countdown" && popover.countdown !== null) {
    return (
      <div className={className}>
        <PopoverShell onClose={onClose} onHome={onHome}>
          <div className="py-8 text-center">
            <div className="text-6xl font-bold text-vantage-green mb-2 animate-pulse">
              {popover.countdown}
            </div>
            <p className="text-sm text-muted-foreground">
              Recording starts in...
            </p>
          </div>
        </PopoverShell>
      </div>
    );
  }

  // ============= PROCESSING STATE =============
  if (popover.state === "processing") {
    return (
      <div className={className}>
        <PopoverShell onClose={onClose} onHome={onHome}>
          <div className="space-y-4">
            <PopoverToast
              variant="loading"
              title="Processing your recording..."
              message="This usually takes a few seconds"
            />
            
            <div className="text-center text-xs text-muted-foreground">
              Your video will be available in the library
            </div>
          </div>
        </PopoverShell>
      </div>
    );
  }

  // ============= ERROR STATE =============
  if (popover.state === "error" && popover.error) {
    return (
      <div className={className}>
        <PopoverShell onClose={onClose} onHome={onHome}>
          <div className="space-y-4">
            <PopoverToast
              variant="error"
              title="Recording failed"
              message={popover.error.message}
              onDismiss={popover.retry}
            />
            
            <PrimaryCTA
              variant="retry"
              onClick={popover.retry}
              helperText="Don't worry, we'll try again"
            />
          </div>
        </PopoverShell>
      </div>
    );
  }

  // ============= UNAUTHORIZED STATE =============
  if (popover.state === "unauthorized") {
    return (
      <div className={className}>
        <PopoverShell onClose={onClose} onHome={onHome}>
          <div className="space-y-4">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-vantage-green/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-vantage-green" />
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                Permissions Required
              </h3>
              <p className="text-xs text-muted-foreground">
                Vantage needs access to your screen and microphone to record gameplay.
              </p>
            </div>

            {/* Permission list */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-vantage-green" />
                Screen recording access
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-vantage-green" />
                Microphone access
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-vantage-green" />
                Camera access (optional)
              </div>
            </div>

            <PrimaryCTA
              variant="authorize"
              onClick={popover.authorize}
              helperText="You can change this anytime in System Preferences"
            />
          </div>
        </PopoverShell>
      </div>
    );
  }

  // ============= SOURCE TYPE PICKER STATE =============
  if (popover.state === "selecting_source_type") {
    return (
      <div className={className}>
        <PopoverShell onClose={onClose} onHome={onHome}>
          <SourceTypeSheet
            selectedType={popover.config.selectedSource?.type || "screen"}
            onSelect={popover.selectSourceType}
            onBack={popover.closeSourceTypePicker}
            onSelectWindow={popover.openWindowPicker}
          />
        </PopoverShell>
      </div>
    );
  }

  // ============= WINDOW PICKER STATE =============
  if (popover.state === "selecting_source") {
    return (
      <div className={className}>
        <PopoverShell onClose={onClose} onHome={onHome}>
          <WindowPickerGrid
            windows={MOCK_WINDOWS}
            selectedWindowId={popover.selectedWindow?.id || null}
            onSelect={popover.selectWindow}
            onBack={popover.closeWindowPicker}
          />
        </PopoverShell>
      </div>
    );
  }

  // ============= IDLE STATE - Main Configuration =============
  return (
    <div className={className}>
      <PopoverShell onClose={onClose} onHome={onHome}>
        <IdleStateBody
          sourceType={popover.config.selectedSource?.type || "screen"}
          selectedWindowName={popover.selectedWindow?.name}
          onSourceRowClick={popover.openSourceTypePicker}
          cameraEnabled={popover.config.cameraEnabled}
          onToggleCamera={() => popover.setCameraEnabled(!popover.config.cameraEnabled)}
          micEnabled={popover.config.micEnabled}
          onToggleMic={() => popover.setMicEnabled(!popover.config.micEnabled)}
          selectedMicId={popover.config.selectedMicId}
          onMicDeviceChange={popover.setMicDevice}
          onStartRecording={popover.startRecording}
          canStartRecording={popover.canStartRecording}
          onEffectsClick={() => console.log("Effects clicked - stub")}
          onNotesClick={() => console.log("Notes clicked - stub")}
          onMoreClick={() => console.log("More clicked - stub")}
        />
      </PopoverShell>
    </div>
  );
}
