/**
 * Effects Tray Component
 * 
 * Collapsible tray with VFX/SFX tabs for dragging effects onto the timeline.
 * Includes Auto-enhance button for AI suggestions.
 */

import { useState, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { EffectChip } from "./EffectChip";
import { VFX_CATALOG, SFX_CATALOG } from "@/lib/effectEvents";
import { 
  ChevronDown, 
  ChevronUp, 
  Wand2, 
  Volume2,
  Magnet,
  Music,
  Sparkles,
} from "lucide-react";

export interface SnapSettings {
  snapToMoments: boolean;
  snapToAudioPeaks: boolean;
}

interface EffectsTrayProps {
  sessionId: string;
  isOpen: boolean;
  onToggle: () => void;
  snapSettings: SnapSettings;
  onSnapSettingsChange: (settings: SnapSettings) => void;
  hasAudioAnalysis?: boolean;
  onDragStart: (e: React.DragEvent, effectKey: string, type: "vfx" | "sfx") => void;
  onAutoEnhance?: () => void;
  isAutoEnhancing?: boolean;
}

export const EffectsTray = memo(function EffectsTray({
  sessionId,
  isOpen,
  onToggle,
  snapSettings,
  onSnapSettingsChange,
  hasAudioAnalysis = false,
  onDragStart,
  onAutoEnhance,
  isAutoEnhancing = false,
}: EffectsTrayProps) {
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

  const categoryLabels: Record<string, string> = {
    impact: "Impact",
    transition: "Transition",
    emphasis: "Emphasis",
    timing: "Timing",
    comedic: "Comedic",
    hype: "Hype",
    ambient: "Ambient",
  };

  return (
    <div className={cn(
      "border-t border-border/30 bg-card/50 transition-all duration-200",
      isOpen ? "pb-3" : ""
    )}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-xs font-medium"
          onClick={onToggle}
        >
          <Wand2 className="h-3.5 w-3.5" />
          Effects
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </Button>

        {isOpen && (
          <div className="flex items-center gap-4">
            {/* Snap toggles */}
            <div className="flex items-center gap-2">
              <Magnet className="h-3 w-3 text-muted-foreground" />
              <div className="flex items-center gap-1.5">
                <Switch
                  id="snap-moments"
                  checked={snapSettings.snapToMoments}
                  onCheckedChange={(checked) => 
                    onSnapSettingsChange({ ...snapSettings, snapToMoments: checked })
                  }
                  className="scale-75"
                />
                <Label htmlFor="snap-moments" className="text-[10px] text-muted-foreground cursor-pointer">
                  Moments
                </Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch
                  id="snap-peaks"
                  checked={snapSettings.snapToAudioPeaks}
                  onCheckedChange={(checked) => 
                    onSnapSettingsChange({ ...snapSettings, snapToAudioPeaks: checked })
                  }
                  disabled={!hasAudioAnalysis}
                  className="scale-75"
                />
                <Label 
                  htmlFor="snap-peaks" 
                  className={cn(
                    "text-[10px] cursor-pointer flex items-center gap-1",
                    hasAudioAnalysis ? "text-muted-foreground" : "text-muted-foreground/40"
                  )}
                >
                  <Music className="h-2.5 w-2.5" />
                  Peaks
                </Label>
              </div>
            </div>

            {/* Auto-enhance button */}
            {onAutoEnhance && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={onAutoEnhance}
                disabled={isAutoEnhancing}
              >
                <Sparkles className={cn("h-3 w-3", isAutoEnhancing && "animate-pulse")} />
                Auto-enhance
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tray content */}
      {isOpen && (
        <div className="px-4 pt-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "vfx" | "sfx")}>
            <TabsList className="grid w-full grid-cols-2 max-w-[200px] h-8">
              <TabsTrigger value="vfx" className="text-xs gap-1.5">
                <Wand2 className="h-3 w-3" />
                VFX
              </TabsTrigger>
              <TabsTrigger value="sfx" className="text-xs gap-1.5">
                <Volume2 className="h-3 w-3" />
                SFX
              </TabsTrigger>
            </TabsList>

            <TabsContent value="vfx" className="mt-3">
              <ScrollArea className="w-full">
                <div className="flex flex-col gap-3 pb-2">
                  {Object.entries(vfxByCategory).map(([category, effects]) => (
                    <div key={category}>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-2 block">
                        {categoryLabels[category] || category}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {effects.map((effect) => (
                          <EffectChip
                            key={effect.key}
                            effectKey={effect.key}
                            name={effect.name}
                            description={effect.description}
                            icon={effect.icon}
                            type="vfx"
                            category={effect.category}
                            onDragStart={onDragStart}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="sfx" className="mt-3">
              <ScrollArea className="w-full">
                <div className="flex flex-col gap-3 pb-2">
                  {Object.entries(sfxByCategory).map(([category, effects]) => (
                    <div key={category}>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-2 block">
                        {categoryLabels[category] || category}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {effects.map((effect) => (
                          <EffectChip
                            key={effect.key}
                            effectKey={effect.key}
                            name={effect.name}
                            description={effect.description}
                            icon={effect.icon}
                            type="sfx"
                            category={effect.category}
                            onDragStart={onDragStart}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Drag hint */}
          <p className="text-[10px] text-muted-foreground/50 mt-3 text-center">
            Drag effects onto the timeline below
          </p>
        </div>
      )}
    </div>
  );
});
