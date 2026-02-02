/**
 * Frame Presets Grid
 * 
 * Scrollable card grid for selecting preset frames.
 * Categories: Minimal, Esports, Meme, Cinematic, Neon
 */

import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Sparkles, Mic } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FrameStyleParams } from "@/lib/frameOverlays";

// Preset categories with updated naming
export type PresetCategory = "all" | "minimal" | "esports" | "meme" | "cinematic" | "neon";

export interface FramePreset {
  key: string;
  name: string;
  category: Exclude<PresetCategory, "all">;
  style: Partial<FrameStyleParams>;
  preview?: string;
}

// Frame presets with requested categories
export const FRAME_PRESETS: FramePreset[] = [
  // Minimal
  { key: "clean-circle", name: "Clean Circle", category: "minimal", style: { shape: "circle", strokeWidth: 0, shadowIntensity: 0.3 } },
  { key: "soft-rounded", name: "Soft Rounded", category: "minimal", style: { shape: "rounded", strokeWidth: 1, glowIntensity: 0.1 } },
  { key: "thin-line", name: "Thin Line", category: "minimal", style: { shape: "rounded", strokeWidth: 1, colorTheme: "white" } },
  // Esports
  { key: "esports-pro", name: "Pro League", category: "esports", style: { shape: "rounded", strokeWidth: 3, glowIntensity: 0.4, colorTheme: "primary" } },
  { key: "esports-hex", name: "Tactical Hex", category: "esports", style: { shape: "hex", strokeWidth: 3, glowIntensity: 0.5 } },
  { key: "esports-mic", name: "Comms Ready", category: "esports", style: { shape: "circle", micRingEnabled: true, micRingSensitivity: 0.7 } },
  // Meme
  { key: "meme-chaos", name: "Chaos Mode", category: "meme", style: { shape: "rounded", strokeWidth: 4, glowIntensity: 0.8, colorTheme: "neon-pink" } },
  { key: "meme-pixel", name: "Pixelated", category: "meme", style: { shape: "square", strokeWidth: 4, colorTheme: "retro-green" } },
  { key: "meme-gamer", name: "Gamer Rage", category: "meme", style: { shape: "rounded", strokeWidth: 5, glowIntensity: 0.9, colorTheme: "destructive" } },
  // Cinematic
  { key: "cinema-dark", name: "Dark Mood", category: "cinematic", style: { shape: "rounded", strokeWidth: 1, shadowIntensity: 0.6 } },
  { key: "cinema-widescreen", name: "Widescreen", category: "cinematic", style: { shape: "pill", strokeWidth: 2, shadowIntensity: 0.5 } },
  { key: "cinema-vignette", name: "Vignette", category: "cinematic", style: { shape: "rounded", glowIntensity: 0.2, shadowIntensity: 0.7 } },
  // Neon
  { key: "neon-glow", name: "Neon Glow", category: "neon", style: { shape: "rounded", strokeWidth: 2, glowIntensity: 0.8, colorTheme: "neon-pink" } },
  { key: "neon-cyber", name: "Cyberpunk", category: "neon", style: { shape: "hex", strokeWidth: 2, glowIntensity: 0.7, colorTheme: "neon-cyan" } },
  { key: "neon-pulse", name: "Pulse Ring", category: "neon", style: { shape: "circle", glowIntensity: 0.6, micRingEnabled: true, colorTheme: "neon-green" } },
];

const CATEGORY_LABELS: Record<PresetCategory, string> = {
  all: "All",
  minimal: "Minimal",
  esports: "Esports",
  meme: "Meme",
  cinematic: "Cinematic",
  neon: "Neon",
};

interface FramePresetsProps {
  selectedKey: string | null;
  onSelect: (preset: FramePreset) => void;
  disabled?: boolean;
  className?: string;
}

export const FramePresets = memo(function FramePresets({
  selectedKey,
  onSelect,
  disabled = false,
  className,
}: FramePresetsProps) {
  const [category, setCategory] = useState<PresetCategory>("all");

  const filteredPresets = category === "all"
    ? FRAME_PRESETS
    : FRAME_PRESETS.filter((p) => p.category === category);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Category Pills */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-1.5 min-w-max">
          {(Object.keys(CATEGORY_LABELS) as PresetCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              disabled={disabled}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all touch-manipulation",
                category === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Preset Grid */}
      <ScrollArea className="h-[200px] sm:h-[240px]">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pr-2">
          {filteredPresets.map((preset) => (
            <PresetCard
              key={preset.key}
              preset={preset}
              isSelected={selectedKey === preset.key}
              onSelect={() => onSelect(preset)}
              disabled={disabled}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});

interface PresetCardProps {
  preset: FramePreset;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}

const PresetCard = memo(function PresetCard({
  preset,
  isSelected,
  onSelect,
  disabled,
}: PresetCardProps) {
  const hasGlow = (preset.style.glowIntensity || 0) > 0;
  const hasMic = preset.style.micRingEnabled;

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "relative flex flex-col items-center gap-1.5 p-2 sm:p-2.5 rounded-xl border transition-all touch-manipulation",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        isSelected
          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
          : "border-border/40 hover:border-border hover:bg-muted/30",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      {/* Mini Preview */}
      <PresetThumbnail style={preset.style} />

      {/* Selected Check */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      )}

      {/* Name */}
      <span className="text-[10px] sm:text-xs font-medium text-center truncate w-full">
        {preset.name}
      </span>

      {/* Feature Icons */}
      <div className="flex gap-0.5">
        {hasGlow && <Sparkles className="h-2.5 w-2.5 text-muted-foreground/60" />}
        {hasMic && <Mic className="h-2.5 w-2.5 text-muted-foreground/60" />}
      </div>
    </button>
  );
});

interface PresetThumbnailProps {
  style: Partial<FrameStyleParams>;
}

const PresetThumbnail = memo(function PresetThumbnail({ style }: PresetThumbnailProps) {
  const colorVar = getColorVar(style.colorTheme || "primary");
  const glowIntensity = style.glowIntensity || 0;

  const shapeClass = 
    style.shape === "circle" ? "rounded-full" :
    style.shape === "hex" ? "clip-path-hex" :
    style.shape === "square" ? "rounded-sm" :
    style.shape === "pill" ? "rounded-full aspect-[2/1]" :
    "rounded-lg";

  return (
    <div
      className={cn(
        "w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-muted/50 transition-all",
        shapeClass
      )}
      style={{
        borderWidth: style.strokeWidth || 0,
        borderColor: colorVar,
        borderStyle: "solid",
        boxShadow: glowIntensity > 0
          ? `0 0 ${glowIntensity * 12}px ${glowIntensity * 4}px ${colorVar}`
          : undefined,
      }}
    >
      <div className={cn("w-3/4 h-3/4 bg-muted-foreground/20", shapeClass)} />
    </div>
  );
});

function getColorVar(theme: string): string {
  const colors: Record<string, string> = {
    primary: "hsl(var(--primary))",
    white: "#ffffff",
    destructive: "hsl(var(--destructive))",
    "neon-pink": "#ff00ff",
    "neon-cyan": "#00ffff",
    "neon-green": "#00ff00",
    "retro-green": "#00ff00",
  };
  return colors[theme] || colors.primary;
}

export default FramePresets;
