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
import { EffectsTray } from "@/components/player/effects/EffectsTray";
import { ReelPackageConfig } from "@/lib/reelPackageConfig";

type EditorTab = "effects" | "frames" | "package";

interface ReelEditorSidebarProps {
  reelId: string;
  sessionId: string;
  activeTab: EditorTab;
  reelPackage: ReelPackageConfig | null;
  onChangesMade: () => void;
  className?: string;
}

export const ReelEditorSidebar = memo(function ReelEditorSidebar({
  reelId,
  sessionId,
  activeTab,
  reelPackage,
  onChangesMade,
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
            <div className="space-y-4">
              <div className="text-sm font-medium text-foreground/90">
                VFX & SFX Library
              </div>
              <p className="text-xs text-muted-foreground">
                Drag effects onto the timeline to add them to your reel.
                Effects will snap to moments automatically.
              </p>
              
              {/* Effects tray in sidebar mode */}
              <EffectsTray
                sessionId={sessionId}
                isOpen={true}
                onToggle={() => {}}
                snapSettings={{
                  snapToMoments: true,
                  snapToAudioPeaks: true,
                }}
                onSnapSettingsChange={() => {}}
                hasAudioAnalysis={false}
                onDragStart={() => {}}
                onAutoEnhance={() => {}}
                isAutoEnhancing={false}
              />
            </div>
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
