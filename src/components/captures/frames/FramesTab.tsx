/**
 * Frames Tab
 * 
 * Main container for the Frames section in the Effects modal.
 * Contains three sections: Presets, AI Generate, Fine-tune
 */

import { memo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { 
  LayoutGrid, 
  Sparkles, 
  SlidersHorizontal,
  Eye,
  EyeOff,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FramePresets, FRAME_PRESETS, type FramePreset } from "./FramePresets";
import { FrameAIGenerate } from "./FrameAIGenerate";
import { FrameFineTune } from "./FrameFineTune";
import { 
  DEFAULT_STYLE_PARAMS, 
  DEFAULT_LAYOUT_PARAMS,
  type FrameStyleParams,
  type FrameLayoutParams,
} from "@/lib/frameOverlays";
import { toast } from "sonner";

export interface FrameConfig {
  enabled: boolean;
  presetKey: string | null;
  style: FrameStyleParams;
  layout: FrameLayoutParams;
  isAIGenerated: boolean;
  aiVariantId?: string;
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
    });
  }, [config, onChange]);

  const handleLayoutChange = useCallback((updates: Partial<FrameLayoutParams>) => {
    onChange({
      ...config,
      layout: { ...config.layout, ...updates },
    });
  }, [config, onChange]);

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
        <Switch
          checked={livePreviewEnabled && canShowLivePreview}
          onCheckedChange={onLivePreviewChange}
          disabled={disabled || !canShowLivePreview}
        />
      </div>

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
