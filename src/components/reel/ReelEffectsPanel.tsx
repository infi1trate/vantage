/**
 * Reel Effects Panel
 * 
 * Sidebar panel for VFX/SFX in the Reel Editor.
 * Contains draggable effect chips organized by category.
 */

import { memo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { EffectChip } from "@/components/player/effects/EffectChip";
import { VFX_CATALOG, SFX_CATALOG } from "@/lib/effectEvents";
import { SnapSettings } from "@/components/player/effects/EffectsTray";
import {
  Wand2,
  Volume2,
  Sparkles,
  Magnet,
  Music,
  Loader2,
  Info,
  Trash2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ReelEffectsPanelProps {
  sessionId: string;
  effectCount: number;
  snapSettings: SnapSettings;
  onSnapSettingsChange: (settings: SnapSettings) => void;
  onDragStart: (e: React.DragEvent, effectKey: string, type: "vfx" | "sfx") => void;
  onAutoEnhance: () => void;
  isAutoEnhancing: boolean;
  hasAudioAnalysis?: boolean;
  onClearAll?: () => void;
  className?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  impact: "Impact",
  transition: "Transition",
  emphasis: "Emphasis",
  timing: "Timing",
  comedic: "Comedic",
  hype: "Hype",
  ambient: "Ambient",
};

const CATEGORY_ORDER = ["impact", "emphasis", "transition", "timing", "comedic", "hype", "ambient"];

export const ReelEffectsPanel = memo(function ReelEffectsPanel({
  sessionId,
  effectCount,
  snapSettings,
  onSnapSettingsChange,
  onDragStart,
  onAutoEnhance,
  isAutoEnhancing,
  hasAudioAnalysis = false,
  onClearAll,
  className,
}: ReelEffectsPanelProps) {
  const [activeTab, setActiveTab] = useState<"vfx" | "sfx">("vfx");

  // Group effects by category
  const vfxByCategory = VFX_CATALOG.reduce((acc, vfx) => {
    if (!acc[vfx.category]) acc[vfx.category] = [];
    acc[vfx.category].push(vfx);
    return acc;
  }, {} as Record<string, typeof VFX_CATALOG>);

  const sfxByCategory = SFX_CATALOG.reduce((acc, sfx) => {
    if (!acc[sfx.category]) acc[sfx.category] = [];
    acc[sfx.category].push(sfx);
    return acc;
  }, {} as Record<string, typeof SFX_CATALOG>);

  const handleToggleSnapMoments = useCallback(() => {
    onSnapSettingsChange({
      ...snapSettings,
      snapToMoments: !snapSettings.snapToMoments,
    });
  }, [snapSettings, onSnapSettingsChange]);

  const handleToggleSnapAudio = useCallback(() => {
    onSnapSettingsChange({
      ...snapSettings,
      snapToAudioPeaks: !snapSettings.snapToAudioPeaks,
    });
  }, [snapSettings, onSnapSettingsChange]);

  const sortedCategories = (categories: Record<string, any[]>) => {
    return CATEGORY_ORDER.filter(cat => categories[cat]?.length > 0);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with effect count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Effects</span>
          {effectCount > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {effectCount}
            </Badge>
          )}
        </div>
        {effectCount > 0 && onClearAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Auto-enhance button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onAutoEnhance}
        disabled={isAutoEnhancing}
        className="w-full gap-2 border-primary/30 hover:bg-primary/10"
      >
        {isAutoEnhancing ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Auto-enhance with AI
          </>
        )}
      </Button>

      {/* Snap settings */}
      <div className="p-3 bg-muted/20 rounded-lg space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Magnet className="h-3 w-3" />
          Snap Settings
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="snap-moments" className="text-xs">
              Snap to Moments
            </Label>
            <Switch
              id="snap-moments"
              checked={snapSettings.snapToMoments}
              onCheckedChange={handleToggleSnapMoments}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Label htmlFor="snap-audio" className="text-xs">
                Snap to Audio
              </Label>
              {!hasAudioAnalysis && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Music className="h-3 w-3 text-muted-foreground/50" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    Audio analysis not available
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <Switch
              id="snap-audio"
              checked={snapSettings.snapToAudioPeaks}
              onCheckedChange={handleToggleSnapAudio}
              disabled={!hasAudioAnalysis}
            />
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="flex items-start gap-2 p-2 bg-primary/5 rounded-lg border border-primary/10">
        <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Drag effects onto the Effects Lane below the video. 
          Effects are stored as metadata and rendered during export.
        </p>
      </div>

      <Separator />

      {/* VFX / SFX Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "vfx" | "sfx")}>
        <TabsList className="w-full h-9">
          <TabsTrigger value="vfx" className="flex-1 gap-1.5 text-xs">
            <Wand2 className="h-3.5 w-3.5" />
            Visual FX
          </TabsTrigger>
          <TabsTrigger value="sfx" className="flex-1 gap-1.5 text-xs">
            <Volume2 className="h-3.5 w-3.5" />
            Sound FX
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vfx" className="mt-3 space-y-4">
          <ScrollArea className="h-[280px] pr-2">
            {sortedCategories(vfxByCategory).map((category) => (
              <div key={category} className="mb-4">
                <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  {CATEGORY_LABELS[category] || category}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {vfxByCategory[category].map((vfx) => (
                    <EffectChip
                      key={vfx.key}
                      effectKey={vfx.key}
                      name={vfx.name}
                      description={vfx.description}
                      category={vfx.category}
                      type="vfx"
                      icon={vfx.icon}
                      onDragStart={onDragStart}
                    />
                  ))}
                </div>
              </div>
            ))}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="sfx" className="mt-3 space-y-4">
          <ScrollArea className="h-[280px] pr-2">
            {sortedCategories(sfxByCategory).map((category) => (
              <div key={category} className="mb-4">
                <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  {CATEGORY_LABELS[category] || category}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {sfxByCategory[category].map((sfx) => (
                    <EffectChip
                      key={sfx.key}
                      effectKey={sfx.key}
                      name={sfx.name}
                      description={sfx.description}
                      category={sfx.category}
                      type="sfx"
                      icon={sfx.icon}
                      onDragStart={onDragStart}
                    />
                  ))}
                </div>
              </div>
            ))}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
});

export default ReelEffectsPanel;
