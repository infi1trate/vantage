/**
 * Player with Effects Integration
 * 
 * Wrapper component that adds effects tray and lane to the CinematicPlayer.
 * Provides full drag-and-drop VFX/SFX functionality with smart pairing and AI suggestions.
 */

import { memo, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CinematicPlayer, VideoDecodeError, VideoMetaInfo, SelectionState } from "./CinematicPlayer";
import { EffectsTray, EffectsLane, AutoEnhanceModal, SnapSettings } from "./effects";
import { useEffectsTimeline } from "@/hooks/useEffectsTimeline";
import { Annotation, VoiceNote } from "@/lib/captures";
import { AnnotationSuggestion } from "./SuggestionMarkers";
import { FramePin } from "./FramePins";

interface PlayerWithEffectsProps {
  sessionId: string;
  videoUrl?: string | null;
  duration: number;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onSeek: (time: number) => void;
  annotations: Annotation[];
  voiceNotes: VoiceNote[];
  onMarkerClick?: (time: number) => void;
  videoMeta?: VideoMetaInfo | null;
  onVideoLoaded?: (duration: number) => void;
  onVideoError?: (error: VideoDecodeError) => void;
  onDownloadRequest?: () => void;
  selection?: SelectionState;
  onSelectionChange?: (selection: SelectionState) => void;
  onCreateMarker?: (type: "kill" | "death" | "highlight" | "marker", time: number, endTime?: number) => void;
  onOpenNote?: (time: number, endTime?: number) => void;
  onOpenVoice?: (time: number) => void;
  onFrameClick?: (x: number, y: number, time: number, endTime?: number) => void;
  framePins?: FramePin[];
  onPinClick?: (pin: FramePin) => void;
  suggestions?: AnnotationSuggestion[];
  onSuggestionAccept?: (suggestion: AnnotationSuggestion) => void;
  onSuggestionDismiss?: (suggestionId: string) => void;
  // Effects visibility
  showEffects?: boolean;
}

export const PlayerWithEffects = memo(function PlayerWithEffects({
  sessionId,
  videoUrl,
  duration,
  currentTime,
  onTimeUpdate,
  onSeek,
  annotations,
  voiceNotes,
  onMarkerClick,
  videoMeta,
  onVideoLoaded,
  onVideoError,
  onDownloadRequest,
  selection = { type: null },
  onSelectionChange,
  onCreateMarker,
  onOpenNote,
  onOpenVoice,
  onFrameClick,
  framePins = [],
  onPinClick,
  suggestions = [],
  onSuggestionAccept,
  onSuggestionDismiss,
  showEffects = false,
}: PlayerWithEffectsProps) {
  const [effectsTrayOpen, setEffectsTrayOpen] = useState(false);
  const [showAutoEnhance, setShowAutoEnhance] = useState(false);
  
  // Effects timeline state
  const {
    effects,
    isDragging,
    snapSettings,
    setSnapSettings,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleEffectUpdate,
    handleEffectDelete,
    handleEffectDuplicate,
    canUndo,
    canRedo,
    undo,
    redo,
    proposedEffects,
    isAutoEnhancing,
    generateSuggestions,
    applyProposedEffects,
    applyAllProposedEffects,
  } = useEffectsTimeline({
    sessionId,
    annotations,
    duration,
  });

  // Handle Auto-enhance button click
  const handleAutoEnhance = useCallback(() => {
    generateSuggestions();
    setShowAutoEnhance(true);
  }, [generateSuggestions]);

  // Handle global drag end
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };
    
    window.addEventListener("dragend", handleGlobalDragEnd);
    return () => window.removeEventListener("dragend", handleGlobalDragEnd);
  }, [isDragging, handleDragEnd]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey && canRedo) {
          redo();
        } else if (canUndo) {
          undo();
        }
      }
    };

    if (showEffects) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showEffects, canUndo, canRedo, undo, redo]);

  return (
    <div className="flex flex-col h-full">
      {/* Main player */}
      <div className="flex-1 min-h-0">
        <CinematicPlayer
          videoUrl={videoUrl}
          duration={duration}
          currentTime={currentTime}
          onTimeUpdate={onTimeUpdate}
          onSeek={onSeek}
          annotations={annotations}
          voiceNotes={voiceNotes}
          onMarkerClick={onMarkerClick}
          videoMeta={videoMeta}
          onVideoLoaded={onVideoLoaded}
          onVideoError={onVideoError}
          onDownloadRequest={onDownloadRequest}
          selection={selection}
          onSelectionChange={onSelectionChange}
          onCreateMarker={onCreateMarker}
          onOpenNote={onOpenNote}
          onOpenVoice={onOpenVoice}
          onFrameClick={onFrameClick}
          framePins={framePins}
          onPinClick={onPinClick}
          suggestions={suggestions}
          onSuggestionAccept={onSuggestionAccept}
          onSuggestionDismiss={onSuggestionDismiss}
        />
      </div>

      {/* Effects Lane - only visible when effects mode is active */}
      {showEffects && (
        <div className="shrink-0 px-4 md:px-6 pb-2 pt-1 bg-card/80 border-t border-border/20">
          <EffectsLane
            effects={effects}
            duration={duration}
            currentTime={currentTime}
            onSeek={onSeek}
            onEffectUpdate={handleEffectUpdate}
            onEffectDelete={handleEffectDelete}
            onEffectDuplicate={handleEffectDuplicate}
            onDrop={handleDrop}
            isDragging={isDragging}
          />
        </div>
      )}

      {/* Effects Tray */}
      {showEffects && (
        <EffectsTray
          sessionId={sessionId}
          isOpen={effectsTrayOpen}
          onToggle={() => setEffectsTrayOpen(!effectsTrayOpen)}
          snapSettings={snapSettings}
          onSnapSettingsChange={setSnapSettings}
          hasAudioAnalysis={false} // TODO: Connect to audio analysis
          onDragStart={handleDragStart}
          onAutoEnhance={handleAutoEnhance}
          isAutoEnhancing={isAutoEnhancing}
        />
      )}

      {/* Auto-enhance Modal */}
      {showEffects && (
        <AutoEnhanceModal
          isOpen={showAutoEnhance}
          onClose={() => setShowAutoEnhance(false)}
          proposedEffects={proposedEffects}
          isGenerating={isAutoEnhancing}
          onRegenerate={generateSuggestions}
          onApplySelected={applyProposedEffects}
          onApplyAll={applyAllProposedEffects}
        />
      )}
    </div>
  );
});

export default PlayerWithEffects;
