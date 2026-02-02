/**
 * Reel Editor State Machine
 * 
 * Enforces a strict state machine for the Reel Editor lifecycle:
 * 
 * 1) COMPILING (assembling)
 *    - No FX interaction
 *    - Loading preview + placeholders
 *    - Editor controls disabled
 * 
 * 2) READY  
 *    - Full preview available
 *    - FX / Frames / Package enabled
 *    - All editing tools active
 * 
 * 3) EXPORTING
 *    - Editor locked
 *    - Progress shown in UI
 *    - Cannot modify effects/frames
 * 
 * 4) FAILED
 *    - Assembly failed
 *    - Show error + retry option
 */

import { useMemo } from "react";
import { ReelStatus } from "@/lib/reels";
import { useExportState } from "@/hooks/useRenderQueue";
import { AssemblyState, AssemblyProgress } from "@/hooks/useReelAssembly";

/**
 * Editor-specific lifecycle states
 * Maps reel database status to UI behavior
 */
export type EditorState = "compiling" | "ready" | "exporting" | "failed" | "needs_attention";

export interface EditorStateConfig {
  /** Current editor state */
  state: EditorState;
  
  /** Whether the preview player is available */
  previewAvailable: boolean;
  
  /** Whether FX interactions are enabled */
  fxEnabled: boolean;
  
  /** Whether Frames tab is enabled */
  framesEnabled: boolean;
  
  /** Whether Package tab is enabled */
  packageEnabled: boolean;
  
  /** Whether export button is enabled */
  exportEnabled: boolean;
  
  /** Whether timeline is interactive */
  timelineInteractive: boolean;
  
  /** Status label to display */
  statusLabel: string;
  
  /** Whether to show progress indicator */
  showProgress: boolean;
  
  /** Progress percentage (0-100) */
  progressPercent: number;
}

/**
 * Derive editor state from assembly state and export state
 */
export function deriveEditorState(
  assemblyState: AssemblyState,
  isVideoLoaded: boolean,
  isExporting: boolean,
  exportProgress: number,
  assemblyProgress?: AssemblyProgress
): EditorStateConfig {
  // EXPORTING: Editor locked, progress shown
  if (isExporting) {
    return {
      state: "exporting",
      previewAvailable: true,
      fxEnabled: false,
      framesEnabled: false,
      packageEnabled: false,
      exportEnabled: false,
      timelineInteractive: false,
      statusLabel: "Exporting...",
      showProgress: true,
      progressPercent: exportProgress,
    };
  }
  
  // NEEDS_ATTENTION: Assembly stalled, user action needed (recoverable)
  if (assemblyState === "needs_attention") {
    return {
      state: "needs_attention",
      previewAvailable: false,
      fxEnabled: false,
      framesEnabled: false,
      packageEnabled: false,
      exportEnabled: false,
      timelineInteractive: false,
      statusLabel: "Needs attention",
      showProgress: false,
      progressPercent: 0,
    };
  }
  
  // FAILED: Assembly failed, show error state
  if (assemblyState === "failed") {
    return {
      state: "failed",
      previewAvailable: false,
      fxEnabled: false,
      framesEnabled: false,
      packageEnabled: false,
      exportEnabled: false,
      timelineInteractive: false,
      statusLabel: "Failed",
      showProgress: false,
      progressPercent: 0,
    };
  }
  
  // COMPILING: No interactions, placeholders shown
  // Note: We check assemblyState first - if ready, we enable editing even without video
  if (assemblyState === "assembling") {
    return {
      state: "compiling",
      previewAvailable: false,
      fxEnabled: false,
      framesEnabled: false,
      packageEnabled: false,
      exportEnabled: false,
      timelineInteractive: false,
      statusLabel: "Assembling...",
      showProgress: true,
      progressPercent: assemblyProgress?.percent ?? 0,
    };
  }
  
  // READY: Full editing enabled (manifest-first - enable even without preview video)
  // The preview may still be loading/rendering, but editing is unblocked
  const previewReady = isVideoLoaded;
  
  return {
    state: "ready",
    previewAvailable: previewReady,
    fxEnabled: true,
    framesEnabled: true,
    packageEnabled: true,
    exportEnabled: true,
    timelineInteractive: true,
    statusLabel: previewReady ? "Ready" : "Ready (preview loading...)",
    showProgress: false,
    progressPercent: 100,
  };
}

/**
 * Hook to get current editor state with all capabilities
 * 
 * @param assemblyState - Current assembly state from useReelAssembly
 * @param sessionId - Session ID for export state tracking
 * @param isVideoLoaded - Whether the video is loaded
 * @param assemblyProgress - Optional progress data from assembly hook
 */
export function useEditorState(
  assemblyState: AssemblyState,
  sessionId: string | undefined,
  isVideoLoaded: boolean,
  assemblyProgress?: AssemblyProgress
): EditorStateConfig {
  const exportState = useExportState(sessionId || "");
  
  const isExporting = exportState.state === "exporting";
  const exportProgress = exportState.progress || 0;
  
  return useMemo(
    () => deriveEditorState(assemblyState, isVideoLoaded, isExporting, exportProgress, assemblyProgress),
    [assemblyState, isVideoLoaded, isExporting, exportProgress, assemblyProgress]
  );
}

/**
 * State badge colors for UI
 */
export const STATE_BADGE_STYLES: Record<EditorState, { bg: string; text: string; border: string }> = {
  compiling: {
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    border: "border-border/50",
  },
  ready: {
    bg: "bg-vantage-success/10",
    text: "text-vantage-success",
    border: "border-vantage-success/30",
  },
  exporting: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/30",
  },
  failed: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/30",
  },
  needs_attention: {
    bg: "bg-vantage-warning/10",
    text: "text-vantage-warning",
    border: "border-vantage-warning/30",
  },
};
