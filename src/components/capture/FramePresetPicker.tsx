/**
 * Frame Preset Picker
 * 
 * UI component for selecting and previewing frame presets.
 * Mobile-optimized with large touch targets.
 */

import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Check,
  Circle,
  Hexagon,
  Square,
  Sparkles,
  Mic,
  User,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  PRESET_FRAMES, 
  PresetFrame,
  FrameStyleParams,
  DEFAULT_STYLE_PARAMS,
  generateFrameCSS,
} from "@/lib/frameOverlays";

interface FramePresetPickerProps {
  /** Currently selected preset key */
  selectedPresetKey?: string | null;
  /** Callback when preset is selected */
  onSelect: (presetKey: string, preset: PresetFrame) => void;
  /** Filter by category */
  category?: PresetFrame["category"] | "all";
  /** Compact mode */
  compact?: boolean;
  /** Additional classes */
  className?: string;
}

const CATEGORY_LABELS: Record<PresetFrame["category"] | "all", string> = {
  all: "All Frames",
  minimal: "Minimal",
  gaming: "Gaming",
  streamer: "Streamer",
  retro: "Retro",
  neon: "Neon",
};

const CATEGORY_COLORS: Record<PresetFrame["category"], string> = {
  minimal: "bg-muted",
  gaming: "bg-primary/20",
  streamer: "bg-purple-500/20",
  retro: "bg-green-500/20",
  neon: "bg-pink-500/20",
};

export const FramePresetPicker = memo(function FramePresetPicker({
  selectedPresetKey,
  onSelect,
  category = "all",
  compact = false,
  className,
}: FramePresetPickerProps) {
  const [activeCategory, setActiveCategory] = useState<PresetFrame["category"] | "all">(category);
  
  // Filter presets by category
  const filteredPresets = activeCategory === "all"
    ? PRESET_FRAMES
    : PRESET_FRAMES.filter((p) => p.category === activeCategory);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Category Tabs */}
      {!compact && (
        <div className="overflow-x-auto w-full">
          <div className="flex gap-1.5 pb-2 min-w-max">
            {(["all", "minimal", "gaming", "streamer", "retro", "neon"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all touch-manipulation",
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preset Grid */}
      <ScrollArea className={compact ? "h-48" : "h-auto max-h-80"}>
        <div className={cn(
          "grid gap-2 pr-2",
          compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
        )}>
          {filteredPresets.map((preset) => (
            <PresetCard
              key={preset.key}
              preset={preset}
              isSelected={selectedPresetKey === preset.key}
              onSelect={() => onSelect(preset.key, preset)}
              compact={compact}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});

interface PresetCardProps {
  preset: PresetFrame;
  isSelected: boolean;
  onSelect: () => void;
  compact: boolean;
}

const PresetCard = memo(function PresetCard({
  preset,
  isSelected,
  onSelect,
  compact,
}: PresetCardProps) {
  const fullStyle: FrameStyleParams = {
    ...DEFAULT_STYLE_PARAMS,
    ...preset.style,
  };

  return (
    <button
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all touch-manipulation",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border/50 hover:border-border hover:bg-muted/30",
        compact ? "p-2" : "p-3"
      )}
    >
      {/* Frame Preview */}
      <div className="relative">
        <FrameShapePreview 
          style={fullStyle} 
          size={compact ? 40 : 56}
        />
        {isSelected && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Label */}
      <div className="text-center">
        <div className={cn(
          "font-medium truncate",
          compact ? "text-xs" : "text-sm"
        )}>
          {preset.name}
        </div>
        {!compact && (
          <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
            {preset.description}
          </div>
        )}
      </div>

      {/* Feature Badges */}
      {!compact && (
        <div className="flex flex-wrap gap-1 justify-center">
          {fullStyle.glowIntensity > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[9px]">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              Glow
            </Badge>
          )}
          {fullStyle.micRingEnabled && (
            <Badge variant="secondary" className="h-4 px-1 text-[9px]">
              <Mic className="h-2.5 w-2.5 mr-0.5" />
              Mic
            </Badge>
          )}
          {fullStyle.nameplateEnabled && (
            <Badge variant="secondary" className="h-4 px-1 text-[9px]">
              <User className="h-2.5 w-2.5 mr-0.5" />
              Name
            </Badge>
          )}
        </div>
      )}
    </button>
  );
});

interface FrameShapePreviewProps {
  style: FrameStyleParams;
  size: number;
}

/**
 * Visual preview of a frame shape
 */
export const FrameShapePreview = memo(function FrameShapePreview({
  style,
  size,
}: FrameShapePreviewProps) {
  const ShapeIcon = getShapeIcon(style.shape);
  
  // Generate glow effect
  const glowStyle: React.CSSProperties = style.glowIntensity > 0
    ? {
        boxShadow: `0 0 ${style.glowIntensity * 15}px ${style.glowIntensity * 5}px var(--frame-glow-color, hsl(var(--primary)))`,
      }
    : {};

  // Map color theme to CSS variable
  const colorVar = getColorVariable(style.colorTheme);

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center bg-muted/50",
        style.shape === "circle" && "rounded-full",
        style.shape === "rounded" && "rounded-xl",
        style.shape === "square" && "rounded-sm",
        style.shape === "pill" && "rounded-full",
        style.shape === "hex" && "clip-path-hex",
      )}
      style={{
        width: size,
        height: style.shape === "pill" ? size / 2 : size,
        borderWidth: style.strokeWidth,
        borderColor: colorVar,
        borderStyle: "solid",
        ...glowStyle,
        "--frame-glow-color": colorVar,
      } as React.CSSProperties}
    >
      {/* Inner content placeholder */}
      <div className={cn(
        "w-3/4 h-3/4 bg-gradient-to-br from-muted to-muted-foreground/20",
        style.shape === "circle" && "rounded-full",
        style.shape === "rounded" && "rounded-lg",
        style.shape === "hex" && "clip-path-hex",
      )} />

      {/* Mic ring indicator */}
      {style.micRingEnabled && (
        <div 
          className="absolute inset-0 rounded-full border-2 animate-pulse opacity-50"
          style={{ borderColor: colorVar }}
        />
      )}
    </div>
  );
});

function getShapeIcon(shape: FrameStyleParams["shape"]) {
  switch (shape) {
    case "circle":
      return Circle;
    case "hex":
      return Hexagon;
    case "square":
      return Square;
    default:
      return Circle;
  }
}

function getColorVariable(theme: string): string {
  const colorMap: Record<string, string> = {
    primary: "hsl(var(--primary))",
    accent: "hsl(var(--accent))",
    destructive: "hsl(var(--destructive))",
    "neon-pink": "#ff00ff",
    "neon-cyan": "#00ffff",
    "neon-green": "#00ff00",
    "retro-green": "#00ff00",
    white: "#ffffff",
  };

  return colorMap[theme] || colorMap.primary;
}

export default FramePresetPicker;
