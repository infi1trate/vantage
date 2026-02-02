/**
 * Reel Editor Sidebar
 * 
 * Right sidebar containing the editing tools for the active tab.
 * - Effects: VFX/SFX library and placement
 * - Frames: Frame overlays and styling
 * - Package: Intro/outro/transitions and AI generation
 */

import { memo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FramesTab, FrameConfig, DEFAULT_FRAME_CONFIG } from "@/components/captures/frames/FramesTab";
import { ReelPackageSection } from "@/components/reel/ReelPackageSection";
import { ReelEffectsPanel } from "@/components/reel/ReelEffectsPanel";
import { SnapSettings } from "@/components/player/effects/EffectsTray";
import { useEffectsTimeline } from "@/hooks/useEffectsTimeline";
import { Annotation } from "@/lib/captures";
import { ReelPackageConfig } from "@/lib/reelPackageConfig";

type EditorTab = "effects" | "frames" | "package";

interface ReelEditorSidebarProps {
  reelId: string;
  sessionId: string;
  activeTab: EditorTab;
  reelPackage: ReelPackageConfig | null;
  annotations: Annotation[];
  duration: number;
  onChangesMade: () => void;
  onDragStart: (e: React.DragEvent, effectKey: string, type: "vfx" | "sfx") => void;
  snapSettings: SnapSettings;
  onSnapSettingsChange: (settings: SnapSettings) => void;
  effectCount: number;
  onAutoEnhance: () => void;
  isAutoEnhancing: boolean;
  onClearAllEffects?: () => void;
  className?: string;
}

export const ReelEditorSidebar = memo(function ReelEditorSidebar({
  reelId,
  sessionId,
  activeTab,
  reelPackage,
  annotations,
  duration,
  onChangesMade,
  onDragStart,
  snapSettings,
  onSnapSettingsChange,
  effectCount,
  onAutoEnhance,
  isAutoEnhancing,
  onClearAllEffects,
  className,
}: ReelEditorSidebarProps) {
  // Frame configuration state
  const [frameConfig, setFrameConfig] = useState<FrameConfig>(DEFAULT_FRAME_CONFIG);
  const [livePreview, setLivePreview] = useState(true);

  const handleFrameChange = useCallback((config: FrameConfig) => {
    setFrameConfig(config);
    onChangesMade();
  }, [onChangesMade]);

  return (
    <div className={cn(
      "w-80 border-l border-border/40 bg-card/30 flex flex-col",
      className
    )}>
      <ScrollArea className="flex-1">
        <div className="p-4">
          {activeTab === "effects" && (
            <ReelEffectsPanel
              sessionId={sessionId}
              effectCount={effectCount}
              snapSettings={snapSettings}
              onSnapSettingsChange={onSnapSettingsChange}
              onDragStart={onDragStart}
              onAutoEnhance={onAutoEnhance}
              isAutoEnhancing={isAutoEnhancing}
              hasAudioAnalysis={false}
              onClearAll={onClearAllEffects}
            />
          )}

          {activeTab === "frames" && (
            <FramesTab
              config={frameConfig}
              onChange={handleFrameChange}
              livePreviewEnabled={livePreview}
              onLivePreviewChange={setLivePreview}
              performanceMode="balanced"
            />
          )}

          {activeTab === "package" && (
            <ReelPackageSection
              sessionId={sessionId}
              defaultExpanded={true}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
});

export default ReelEditorSidebar;
