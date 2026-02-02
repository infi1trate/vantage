/**
 * Frame Fine-Tune Controls
 * 
 * 6 essential controls for customizing frame appearance:
 * - Shape
 * - Stroke width
 * - Glow intensity
 * - Nameplate toggle
 * - Mic ring toggle + sensitivity
 * - Position anchor
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { 
  Circle, 
  Hexagon, 
  Square, 
  RectangleHorizontal,
  User,
  Mic,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import type { FrameStyleParams, FrameLayoutParams, FrameShape, PositionAnchor } from "@/lib/frameOverlays";

interface FrameFineTuneProps {
  style: FrameStyleParams;
  layout: FrameLayoutParams;
  onStyleChange: (updates: Partial<FrameStyleParams>) => void;
  onLayoutChange: (updates: Partial<FrameLayoutParams>) => void;
  disabled?: boolean;
  className?: string;
}

export const FrameFineTune = memo(function FrameFineTune({
  style,
  layout,
  onStyleChange,
  onLayoutChange,
  disabled = false,
  className,
}: FrameFineTuneProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Shape Selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Shape</label>
        <div className="flex gap-2">
          <ShapeButton
            shape="circle"
            icon={<Circle className="h-4 w-4" />}
            selected={style.shape === "circle"}
            onClick={() => onStyleChange({ shape: "circle" })}
            disabled={disabled}
          />
          <ShapeButton
            shape="rounded"
            icon={<Square className="h-4 w-4 rounded" />}
            selected={style.shape === "rounded"}
            onClick={() => onStyleChange({ shape: "rounded" })}
            disabled={disabled}
          />
          <ShapeButton
            shape="hex"
            icon={<Hexagon className="h-4 w-4" />}
            selected={style.shape === "hex"}
            onClick={() => onStyleChange({ shape: "hex" })}
            disabled={disabled}
          />
          <ShapeButton
            shape="pill"
            icon={<RectangleHorizontal className="h-4 w-4" />}
            selected={style.shape === "pill"}
            onClick={() => onStyleChange({ shape: "pill" })}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Stroke Width */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Stroke Width</label>
          <span className="text-xs text-muted-foreground/60">{style.strokeWidth}px</span>
        </div>
        <Slider
          value={[style.strokeWidth]}
          onValueChange={([v]) => onStyleChange({ strokeWidth: v })}
          min={0}
          max={6}
          step={1}
          disabled={disabled}
          className="w-full"
        />
      </div>

      {/* Glow Intensity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Glow Intensity</label>
          <span className="text-xs text-muted-foreground/60">{Math.round(style.glowIntensity * 100)}%</span>
        </div>
        <Slider
          value={[style.glowIntensity * 100]}
          onValueChange={([v]) => onStyleChange({ glowIntensity: v / 100 })}
          min={0}
          max={100}
          step={5}
          disabled={disabled}
          className="w-full"
        />
      </div>

      {/* Toggles Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Nameplate Toggle */}
        <div className="flex items-center justify-between p-2.5 bg-muted/10 rounded-lg border border-border/20">
          <div className="flex items-center gap-2">
            <User className={cn(
              "h-4 w-4",
              style.nameplateEnabled ? "text-primary" : "text-muted-foreground"
            )} />
            <span className="text-xs font-medium">Nameplate</span>
          </div>
          <Switch
            checked={style.nameplateEnabled}
            onCheckedChange={(v) => onStyleChange({ nameplateEnabled: v })}
            disabled={disabled}
          />
        </div>

        {/* Mic Ring Toggle */}
        <div className="flex items-center justify-between p-2.5 bg-muted/10 rounded-lg border border-border/20">
          <div className="flex items-center gap-2">
            <Mic className={cn(
              "h-4 w-4",
              style.micRingEnabled ? "text-primary" : "text-muted-foreground"
            )} />
            <span className="text-xs font-medium">Mic Ring</span>
          </div>
          <Switch
            checked={style.micRingEnabled}
            onCheckedChange={(v) => onStyleChange({ micRingEnabled: v })}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Mic Sensitivity (shown when mic ring enabled) */}
      {style.micRingEnabled && (
        <div className="space-y-2 pl-6 border-l-2 border-primary/30">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Mic Sensitivity</label>
            <span className="text-xs text-muted-foreground/60">{Math.round(style.micRingSensitivity * 100)}%</span>
          </div>
          <Slider
            value={[style.micRingSensitivity * 100]}
            onValueChange={([v]) => onStyleChange({ micRingSensitivity: v / 100 })}
            min={10}
            max={100}
            step={5}
            disabled={disabled}
            className="w-full"
          />
        </div>
      )}

      {/* Position Anchor */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Position</label>
        <PositionPicker
          value={layout.positionAnchor}
          onChange={(v) => onLayoutChange({ positionAnchor: v })}
          disabled={disabled}
        />
      </div>
    </div>
  );
});

interface ShapeButtonProps {
  shape: FrameShape;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
}

const ShapeButton = memo(function ShapeButton({
  icon,
  selected,
  onClick,
  disabled,
}: ShapeButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 p-2.5 rounded-lg border transition-all touch-manipulation",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/40 text-muted-foreground hover:border-border hover:bg-muted/30",
        disabled && "opacity-50"
      )}
    >
      <div className="flex justify-center">{icon}</div>
    </button>
  );
});

interface PositionPickerProps {
  value: PositionAnchor;
  onChange: (v: PositionAnchor) => void;
  disabled: boolean;
}

const POSITION_GRID: PositionAnchor[][] = [
  ["top-left", "top-center", "top-right"],
  ["center-left", "center", "center-right"],
  ["bottom-left", "bottom-center", "bottom-right"],
];

const PositionPicker = memo(function PositionPicker({
  value,
  onChange,
  disabled,
}: PositionPickerProps) {
  return (
    <div className="inline-grid grid-cols-3 gap-1 p-1.5 bg-muted/20 rounded-lg border border-border/30">
      {POSITION_GRID.map((row, ri) =>
        row.map((pos) => (
          <button
            key={pos}
            onClick={() => onChange(pos)}
            disabled={disabled}
            className={cn(
              "w-6 h-6 rounded transition-all touch-manipulation",
              value === pos
                ? "bg-primary"
                : "bg-muted/50 hover:bg-muted",
              disabled && "opacity-50"
            )}
            title={pos.replace("-", " ")}
          />
        ))
      )}
    </div>
  );
});

export default FrameFineTune;
