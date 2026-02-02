/**
 * DesktopCapturePopover
 * 
 * Main popover component that orchestrates all states.
 * This is the primary UI for the desktop capture experience.
 * 
 * Can accept external popover state for syncing with other UI components (e.g., HUD).
 */

import { PopoverShell } from "./PopoverShell";
import { PrimaryCTA } from "./PrimaryCTA";
import { PopoverToast } from "./PopoverToast";
import { WindowPickerGrid } from "./WindowPickerGrid";
import { SourceTypeSheet } from "./SourceTypeSheet";
import { IdleStateBody } from "./IdleStateBody";
import { RecordingStateBody } from "./RecordingStateBody";
import { UnauthorizedStateBody } from "./UnauthorizedStateBody";
import { MoreMenu } from "./MoreMenu";
import { usePopoverState, type UsePopoverStateReturn } from "./usePopoverState";
import { MOCK_WINDOWS } from "./types";

interface DesktopCapturePopoverProps {
  className?: string;
  onClose?: () => void;
  onHome?: () => void;
  /** External popover state for syncing with other components */
  externalState?: UsePopoverStateReturn;
}

export function DesktopCapturePopover({ 
  className, 
  onClose, 
  onHome,
  externalState,
}: DesktopCapturePopoverProps) {
  // Use internal state only if external state not provided
  const internalState = usePopoverState();
  const popover = externalState || internalState;

  // ============= RECORDING/PAUSED STATE =============
  if (popover.state === "recording" || popover.state === "paused") {
    return (
      <div className={className}>
        <PopoverShell onClose={onClose} onHome={onHome}>
          <RecordingStateBody
            duration={popover.duration}
            isPaused={popover.isPaused}
            sourceType={popover.config.selectedSource?.type || "screen"}
            sourceName={popover.selectedWindow?.name}
            onPause={popover.pauseRecording}
            onResume={popover.resumeRecording}
            onStop={popover.stopRecording}
          />
        </PopoverShell>
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

  // ============= UNAUTHORIZED / AUTHORIZING STATE =============
  if (popover.state === "unauthorized" || popover.state === "authorizing") {
    return (
      <div className={className}>
        <PopoverShell onClose={onClose} onHome={onHome}>
          <UnauthorizedStateBody
            isAuthorizing={popover.state === "authorizing"}
            onAuthorize={popover.authorize}
            onLearnMore={() => console.log("Learn more clicked - stub")}
          />
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
          onNotesClick={() => console.log("Notes clicked - stub")}
          username={popover.username}
          onSignOut={popover.signOut}
        />
      </PopoverShell>
    </div>
  );
}
