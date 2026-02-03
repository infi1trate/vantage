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
import { PostRecordingStateBody } from "./PostRecordingStateBody";
import { usePopoverState, type UsePopoverStateReturn } from "./usePopoverState";
import { toast } from "sonner";

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

  // ============= POST-RECORDING STATES (processing, uploading, error) =============
  // Note: success state removed - Electron opens web app automatically after upload
  if (popover.state === "processing" || popover.state === "uploading" || (popover.state === "error" && popover.postRecordingPhase !== null)) {
    const phase = popover.postRecordingPhase || "processing";
    
    return (
      <div className={className}>
        <PopoverShell onClose={onClose} onHome={onHome}>
          <PostRecordingStateBody
            state={phase}
            uploadProgress={popover.uploadProgress}
            onOpenEditor={() => {
              toast("Opening editor...", {
                description: "Your session is ready to view",
                duration: 2000,
              });
              popover.openEditor();
            }}
            onCopyLink={() => {
              toast.success("Link copied!", {
                description: "Share link copied to clipboard",
                duration: 2000,
              });
              popover.copyLink();
            }}
            onRetryUpload={popover.retryUpload}
            onOpenRecordingsFolder={() => {
              toast("Opening recordings folder...", {
                duration: 2000,
              });
              popover.openRecordingsFolder();
            }}
          />
        </PopoverShell>
      </div>
    );
  }

  // ============= ERROR STATE (non-post-recording) =============
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
          {popover.isLoadingSources ? (
            <div className="py-8 text-center">
              <div className="w-6 h-6 border-2 border-vantage-green border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading sources...</p>
            </div>
          ) : (
            <WindowPickerGrid
              windows={popover.availableSources}
              selectedWindowId={popover.selectedWindow?.id || null}
              onSelect={popover.selectWindow}
              onBack={popover.closeWindowPicker}
            />
          )}
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
          username={popover.username}
          onSignOut={popover.signOut}
          forceUploadError={popover.forceUploadError}
          onForceUploadErrorChange={popover.setForceUploadError}
        />
      </PopoverShell>
    </div>
  );
}
