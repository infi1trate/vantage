/**
 * Auto-Enhance Modal
 * 
 * Displays AI-generated effect suggestions for user review.
 * Allows toggling individual effects, applying all, or regenerating.
 */

import { memo, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import * as LucideIcons from "lucide-react";
import { 
  Wand2, 
  Sparkles, 
  RefreshCw, 
  Check, 
  X,
  Zap,
  Volume2,
  Crosshair,
  Skull,
  Star,
  Music,
  Scissors,
} from "lucide-react";
import { ProposedEffect } from "@/lib/effectSuggestions";
import { VFX_CATALOG, SFX_CATALOG } from "@/lib/effectEvents";

interface AutoEnhanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposedEffects: ProposedEffect[];
  isGenerating: boolean;
  onRegenerate: () => void;
  onApplySelected: (effects: ProposedEffect[]) => void;
  onApplyAll: () => void;
}

const REASON_ICONS: Record<string, React.ReactNode> = {
  moment: <Star className="h-3 w-3" />,
  audioPeak: <Music className="h-3 w-3" />,
  clipBoundary: <Scissors className="h-3 w-3" />,
};

const REASON_COLORS: Record<string, string> = {
  moment: "bg-primary/10 text-primary border-primary/20",
  audioPeak: "bg-accent/10 text-accent border-accent/20",
  clipBoundary: "bg-muted text-muted-foreground border-border",
};

export const AutoEnhanceModal = memo(function AutoEnhanceModal({
  isOpen,
  onClose,
  proposedEffects,
  isGenerating,
  onRegenerate,
  onApplySelected,
  onApplyAll,
}: AutoEnhanceModalProps) {
  // Track which effects are toggled on
  const [toggledEffects, setToggledEffects] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    proposedEffects.forEach(e => { initial[e.id] = e.enabled; });
    return initial;
  });

  // Update toggles when proposals change
  useMemo(() => {
    const newToggles: Record<string, boolean> = {};
    proposedEffects.forEach(e => { 
      newToggles[e.id] = toggledEffects[e.id] ?? e.enabled; 
    });
    setToggledEffects(newToggles);
  }, [proposedEffects]);

  const handleToggle = useCallback((effectId: string) => {
    setToggledEffects(prev => ({
      ...prev,
      [effectId]: !prev[effectId],
    }));
  }, []);

  const enabledCount = Object.values(toggledEffects).filter(Boolean).length;

  const handleApplySelected = useCallback(() => {
    const selected = proposedEffects.filter(e => toggledEffects[e.id]);
    onApplySelected(selected);
    onClose();
  }, [proposedEffects, toggledEffects, onApplySelected, onClose]);

  const handleApplyAll = useCallback(() => {
    onApplyAll();
    onClose();
  }, [onApplyAll, onClose]);

  const formatTime = (ms: number) => {
    const seconds = ms / 1000;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get icon for effect
  const getEffectIcon = (type: "vfx" | "sfx", key: string) => {
    const catalog = type === "vfx" ? VFX_CATALOG : SFX_CATALOG;
    const def = catalog.find(e => e.key === key);
    if (!def) return Sparkles;
    return (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[def.icon] || Sparkles;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Auto-Enhance
          </DialogTitle>
          <DialogDescription>
            AI-suggested effects based on your moments and audio. Review and apply.
          </DialogDescription>
        </DialogHeader>

        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Analyzing session...</p>
          </div>
        ) : proposedEffects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Sparkles className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground text-center">
              No moments detected. Add some kills, deaths, or highlights first.
            </p>
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/30 pb-2">
              <span>{proposedEffects.length} suggestions</span>
              <span>{enabledCount} selected</span>
            </div>

            {/* Effects list */}
            <ScrollArea className="max-h-[300px] -mx-2 px-2">
              <div className="space-y-2 py-2">
                {proposedEffects.map((effect) => {
                  const IconComponent = getEffectIcon(effect.type, effect.key);
                  const isEnabled = toggledEffects[effect.id] ?? effect.enabled;
                  
                  return (
                    <div
                      key={effect.id}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg border transition-colors",
                        isEnabled 
                          ? "bg-muted/30 border-border/50" 
                          : "bg-transparent border-transparent opacity-60"
                      )}
                    >
                      {/* Toggle */}
                      <Checkbox
                        checked={isEnabled}
                        onCheckedChange={() => handleToggle(effect.id)}
                        className="shrink-0"
                      />

                      {/* Type indicator */}
                      <div
                        className={cn(
                          "w-7 h-7 rounded flex items-center justify-center shrink-0",
                          effect.type === "vfx" 
                            ? "bg-primary/10 text-primary" 
                            : "bg-accent/10 text-accent"
                        )}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>

                      {/* Effect info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {effect.name}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={cn("text-[9px] px-1.5 py-0", REASON_COLORS[effect.reason])}
                          >
                            {REASON_ICONS[effect.reason]}
                            <span className="ml-1">{effect.reasonLabel}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="font-mono">{formatTime(effect.startTimeMs)}</span>
                          <span>•</span>
                          <span className="uppercase">{effect.type}</span>
                          {effect.intensity && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{effect.intensity}</span>
                            </>
                          )}
                          {effect.volume !== undefined && (
                            <>
                              <span>•</span>
                              <span>{effect.volume}%</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={isGenerating}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isGenerating && "animate-spin")} />
            Regenerate
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplySelected}
              disabled={enabledCount === 0 || isGenerating}
              className="gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Apply Selected ({enabledCount})
            </Button>
            <Button
              size="sm"
              onClick={handleApplyAll}
              disabled={proposedEffects.length === 0 || isGenerating}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Apply All
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
