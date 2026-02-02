/**
 * Frames Tab
 * 
 * Main container for the Frames section in the Effects modal.
 * Contains four sections: Presets, AI Generate, Fine-tune, My Frames
 */

import { memo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { 
  LayoutGrid, 
  Sparkles, 
  SlidersHorizontal,
  Eye,
  EyeOff,
  Bookmark,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FramePresets, FRAME_PRESETS, type FramePreset } from "./FramePresets";
import { FrameAIGenerate } from "./FrameAIGenerate";
import { FrameFineTune } from "./FrameFineTune";
import { MyFramesLibrary } from "./MyFramesLibrary";
import { 
  DEFAULT_STYLE_PARAMS, 
  DEFAULT_LAYOUT_PARAMS,
  type FrameStyleParams,
  type FrameLayoutParams,
  type FrameOverlay,
} from "@/lib/frameOverlays";
import { useCreateFrameOverlay } from "@/hooks/useFrameOverlays";
import { useDefaultFrameData } from "@/hooks/useDefaultFrame";
import { toast } from "sonner";

export interface FrameConfig {
  enabled: boolean;
  presetKey: string | null;
  style: FrameStyleParams;
  layout: FrameLayoutParams;
  isAIGenerated: boolean;
  aiVariantId?: string;
  /** Saved frame ID if applied from library */
  savedFrameId?: string;
}

interface FramesTabProps {
  config: FrameConfig;
  onChange: (config: FrameConfig) => void;
  livePreviewEnabled: boolean;
  onLivePreviewChange: (enabled: boolean) => void;
  performanceMode: "high" | "balanced" | "minimal";
  disabled?: boolean;
  className?: string;
}

export const FramesTab = memo(function FramesTab({
  config,
  onChange,
  livePreviewEnabled,
  onLivePreviewChange,
  performanceMode,
  disabled = false,
  className,
}: FramesTabProps) {
  const [activeSection, setActiveSection] = useState("presets");
  const [showLibrary, setShowLibrary] = useState(false);
  
  const createFrame = useCreateFrameOverlay();
  const { data: defaultData } = useDefaultFrameData();
  const [localDefaultId, setLocalDefaultId] = useState<string | null>(null);
  
  // Use local state or fetched default
  const effectiveDefaultId = localDefaultId ?? defaultData?.defaultFrameId ?? null;

  const handlePresetSelect = useCallback((preset: FramePreset) => {
    const newStyle: FrameStyleParams = {
      ...DEFAULT_STYLE_PARAMS,
      ...preset.style,
    };
    onChange({
      ...config,
      enabled: true,
      presetKey: preset.key,
      style: newStyle,
      isAIGenerated: false,
      aiVariantId: undefined,
      savedFrameId: undefined,
    });
  }, [config, onChange]);

  const handleAISelect = useCallback((variant: { id: string; style: Partial<FrameStyleParams> }) => {
    const newStyle: FrameStyleParams = {
      ...DEFAULT_STYLE_PARAMS,
      ...variant.style,
    };
    onChange({
      ...config,
      enabled: true,
      presetKey: null,
      style: newStyle,
      isAIGenerated: true,
      aiVariantId: variant.id,
      savedFrameId: undefined,
    });
  }, [config, onChange]);

  const handleSaveSignature = useCallback((variant: { id: string; name: string }) => {
    toast.success(`"${variant.name}" saved as Signature Frame`);
    // TODO: Persist to user preferences
  }, []);

  const handleStyleChange = useCallback((updates: Partial<FrameStyleParams>) => {
    onChange({
      ...config,
      style: { ...config.style, ...updates },
      presetKey: null, // Clear preset when manually editing
      savedFrameId: undefined, // Clear saved reference
    });
  }, [config, onChange]);

  const handleLayoutChange = useCallback((updates: Partial<FrameLayoutParams>) => {
    onChange({
      ...config,
      layout: { ...config.layout, ...updates },
      savedFrameId: undefined,
    });
  }, [config, onChange]);

  // Apply a saved frame from library
  const handleApplySavedFrame = useCallback((frame: FrameOverlay) => {
    onChange({
      enabled: true,
      presetKey: frame.preset_key,
      style: frame.style_params,
      layout: frame.layout_params,
      isAIGenerated: frame.type === "ai",
      aiVariantId: frame.type === "ai" ? frame.id : undefined,
      savedFrameId: frame.id,
    });
    setShowLibrary(false);
    toast.success(`Applied "${frame.name || "Frame"}"`);
  }, [onChange]);

  // Edit a saved frame (load into fine-tune)
  const handleEditSavedFrame = useCallback((frame: FrameOverlay) => {
    onChange({
      enabled: true,
      presetKey: frame.preset_key,
      style: frame.style_params,
      layout: frame.layout_params,
      isAIGenerated: frame.type === "ai",
      savedFrameId: frame.id,
    });
    setShowLibrary(false);
    setActiveSection("tune");
    toast.info("Editing frame - changes will create a new version");
  }, [onChange]);

  // Save current config as new frame
  const handleSaveCurrentAsFrame = useCallback(async () => {
    if (!config.enabled) {
      toast.error("Enable a frame first");
      return;
    }

    try {
      const newFrame = await createFrame.mutateAsync({
        type: config.isAIGenerated ? "ai" : config.presetKey ? "preset" : "custom",
        presetKey: config.presetKey || undefined,
        name: config.presetKey 
          ? `My ${FRAME_PRESETS.find(p => p.key === config.presetKey)?.name || "Frame"}`
          : config.isAIGenerated 
            ? "AI Frame" 
            : "Custom Frame",
        styleParams: config.style,
        layoutParams: config.layout,
      });

      if (newFrame) {
        onChange({ ...config, savedFrameId: newFrame.id });
        toast.success("Frame saved to library");
      }
    } catch {
      toast.error("Failed to save frame");
    }
  }, [config, createFrame, onChange]);

  // Auto-disable live preview in minimal performance mode
  const canShowLivePreview = performanceMode !== "minimal";

  return (
    <div className={cn("space-y-4", className)}>
      {/* Live Preview Toggle */}
      <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg border border-border/20">
        <div className="flex items-center gap-2">
          {livePreviewEnabled && canShowLivePreview ? (
            <Eye className="h-4 w-4 text-primary" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">Live Preview</p>
            {!canShowLivePreview && (
              <p className="text-xs text-muted-foreground">
                Disabled in minimal mode
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* My Frames Button */}
          <Button
            variant={showLibrary ? "default" : "outline"}
            size="sm"
            onClick={() => setShowLibrary(!showLibrary)}
            className="h-8 px-2.5 text-xs"
          >
            <Bookmark className="h-3.5 w-3.5 mr-1" />
            My Frames
          </Button>
          <Switch
            checked={livePreviewEnabled && canShowLivePreview}
            onCheckedChange={onLivePreviewChange}
            disabled={disabled || !canShowLivePreview}
          />
        </div>
      </div>

      {/* My Frames Library (collapsible) */}
      {showLibrary && (
        <MyFramesLibrary
          selectedFrameId={config.savedFrameId || null}
          defaultFrameId={effectiveDefaultId}
          onApply={handleApplySavedFrame}
          onEdit={handleEditSavedFrame}
          onSaveNew={handleSaveCurrentAsFrame}
          onDefaultChange={setLocalDefaultId}
          disabled={disabled}
          className="pb-3 border-b border-border/20"
        />
      )}

      {/* Section Tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="presets" className="text-xs gap-1">
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Presets</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-xs gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI</span>
          </TabsTrigger>
          <TabsTrigger value="tune" className="text-xs gap-1">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Fine-tune</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="presets" className="mt-3">
          <FramePresets
            selectedKey={config.presetKey}
            onSelect={handlePresetSelect}
            disabled={disabled}
          />
        </TabsContent>

        <TabsContent value="ai" className="mt-3">
          <FrameAIGenerate
            onSelect={handleAISelect}
            onSaveAsSignature={handleSaveSignature}
            disabled={disabled}
          />
        </TabsContent>

        <TabsContent value="tune" className="mt-3">
          <FrameFineTune
            style={config.style}
            layout={config.layout}
            onStyleChange={handleStyleChange}
            onLayoutChange={handleLayoutChange}
            disabled={disabled}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
});

export const DEFAULT_FRAME_CONFIG: FrameConfig = {
  enabled: false,
  presetKey: null,
  style: DEFAULT_STYLE_PARAMS,
  layout: DEFAULT_LAYOUT_PARAMS,
  isAIGenerated: false,
};

export default FramesTab;
