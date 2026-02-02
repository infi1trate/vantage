/**
 * Inline Effect Editor Component
 * 
 * Popover editor for adjusting effect parameters:
 * - Intensity (VFX) or Volume (SFX)
 * - Duration preset
 * - Delete action
 */

import { memo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { 
  EffectEvent, 
  EffectIntensity,
  getVFXDefinition, 
  getSFXDefinition,
  getDefaultDuration,
} from "@/lib/effectEvents";
import { Trash2, Copy, Zap, Volume2, Clock } from "lucide-react";

interface EffectEditorProps {
  effect: EffectEvent;
  onUpdate: (updates: Partial<EffectEvent>) => void;
  onDelete: () => void;
  onDuplicate: (newStartTimeMs: number) => void;
  onClose: () => void;
}

const INTENSITY_OPTIONS: { value: EffectIntensity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "med", label: "Med" },
  { value: "high", label: "High" },
];

const DURATION_PRESETS = [
  { id: "short", label: "Short", multiplier: 0.5 },
  { id: "auto", label: "Auto", multiplier: 1 },
  { id: "long", label: "Long", multiplier: 2 },
];

export const EffectEditor = memo(function EffectEditor({
  effect,
  onUpdate,
  onDelete,
  onDuplicate,
  onClose,
}: EffectEditorProps) {
  const definition = effect.type === "vfx" 
    ? getVFXDefinition(effect.key) 
    : getSFXDefinition(effect.key);

  const defaultDuration = getDefaultDuration(effect.type, effect.key);
  
  // Determine current duration preset
  const durationRatio = effect.duration_ms / defaultDuration;
  const currentPreset = durationRatio <= 0.6 ? "short" : durationRatio >= 1.5 ? "long" : "auto";

  const handleIntensityChange = useCallback((value: string) => {
    if (value) {
      onUpdate({ intensity: value as EffectIntensity });
    }
  }, [onUpdate]);

  const handleVolumeChange = useCallback((value: number[]) => {
    onUpdate({ volume: value[0] });
  }, [onUpdate]);

  const handleDurationPreset = useCallback((presetId: string) => {
    const preset = DURATION_PRESETS.find(p => p.id === presetId);
    if (preset) {
      onUpdate({ duration_ms: Math.round(defaultDuration * preset.multiplier) });
    }
  }, [defaultDuration, onUpdate]);

  const handleEnabledToggle = useCallback((enabled: boolean) => {
    onUpdate({ is_enabled: enabled });
  }, [onUpdate]);

  const handleDelete = useCallback(() => {
    onDelete();
    onClose();
  }, [onDelete, onClose]);

  const handleDuplicate = useCallback(() => {
    // Duplicate 500ms after current position
    onDuplicate(effect.start_time_ms + 500);
    onClose();
  }, [effect.start_time_ms, onDuplicate, onClose]);

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-6 h-6 rounded flex items-center justify-center",
              effect.type === "vfx" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
            )}
          >
            {effect.type === "vfx" ? <Zap className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </div>
          <span className="font-medium text-sm">{definition?.name || effect.key}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch
            checked={effect.is_enabled}
            onCheckedChange={handleEnabledToggle}
            className="scale-75"
          />
          <span className="text-[10px] text-muted-foreground">
            {effect.is_enabled ? "On" : "Off"}
          </span>
        </div>
      </div>

      {/* Intensity (VFX) or Volume (SFX) */}
      {effect.type === "vfx" ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Intensity
          </Label>
          <ToggleGroup
            type="single"
            value={effect.intensity || "med"}
            onValueChange={handleIntensityChange}
            className="justify-start"
          >
            {INTENSITY_OPTIONS.map((opt) => (
              <ToggleGroupItem
                key={opt.value}
                value={opt.value}
                size="sm"
                className="text-xs px-3"
              >
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Volume2 className="h-3 w-3" />
              Volume
            </Label>
            <span className="text-xs font-mono text-muted-foreground">
              {effect.volume ?? 70}%
            </span>
          </div>
          <Slider
            value={[effect.volume ?? 70]}
            onValueChange={handleVolumeChange}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
        </div>
      )}

      {/* Duration preset */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Duration
        </Label>
        <ToggleGroup
          type="single"
          value={currentPreset}
          onValueChange={handleDurationPreset}
          className="justify-start"
        >
          {DURATION_PRESETS.map((preset) => (
            <ToggleGroupItem
              key={preset.id}
              value={preset.id}
              size="sm"
              className="text-xs px-3"
            >
              {preset.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="text-[10px] text-muted-foreground block">
          {(effect.duration_ms / 1000).toFixed(1)}s
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={handleDuplicate}
        >
          <Copy className="h-3 w-3" />
          Duplicate
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleDelete}
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </Button>
      </div>
    </div>
  );
});
