/**
 * Reel Components Index
 * 
 * Exports all reel-related UI components.
 */

export { ReelPackageSection } from "./ReelPackageSection";
export { StylePicker, StylePreview } from "./StylePicker";
export { AudioModePicker, AudioModeIndicator } from "./AudioModePicker";
export { ReelEditorToolbar } from "./ReelEditorToolbar";
export { ReelEditorSidebar } from "./ReelEditorSidebar";
export { ReelEffectsPanel } from "./ReelEffectsPanel";
export { ReelEditorModeBanner } from "./ReelEditorModeBanner";
export { ReelCompilationStatus } from "./ReelCompilationStatus";
export { ReelCompilingPlaceholder } from "./ReelCompilingPlaceholder";
export { ReelEditorIntroModal } from "./ReelEditorIntroModal";
export { PageTransitionOverlay } from "./PageTransitionOverlay";
export { EditorStateBadge } from "./EditorStateBadge";

// Re-export types
export type { ReelStatus } from "./ReelEditorModeBanner";
export type { CompilationPhase } from "./ReelCompilationStatus";
export type {
  StyleKey,
  AudioMode,
  BeatSource,
  GenerationStatus,
  EnergyProfile,
  ReelPackageConfig,
} from "@/lib/reelPackageConfig";
