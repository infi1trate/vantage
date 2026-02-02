/**
 * Style Picker Component
 * 
 * Chip-based style selector for reel packages.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";
import { Sparkles } from "lucide-react";
import { StyleKey, STYLE_DEFINITIONS, getStyleDefinition } from "@/lib/reelPackageConfig";

interface StylePickerProps {
  selectedStyle: StyleKey;
  onStyleChange: (style: StyleKey) => void;
  className?: string;
}

export const StylePicker = memo(function StylePicker({
  selectedStyle,
  onStyleChange,
  className,
}: StylePickerProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {STYLE_DEFINITIONS.map((style) => {
        const isSelected = selectedStyle === style.key;
        const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[style.icon] || Sparkles;
        
        return (
          <button
            key={style.key}
            onClick={() => onStyleChange(style.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
              "border transition-all touch-manipulation",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/50 bg-background hover:border-border hover:bg-muted/50 text-foreground"
            )}
          >
            <IconComponent className="h-3 w-3" />
            <span>{style.name}</span>
          </button>
        );
      })}
    </div>
  );
});

/**
 * Compact style preview (for summary display)
 */
export const StylePreview = memo(function StylePreview({
  styleKey,
  className,
}: {
  styleKey: StyleKey;
  className?: string;
}) {
  const style = getStyleDefinition(styleKey);
  if (!style) return null;
  
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[style.icon] || Sparkles;
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div 
        className="w-6 h-6 rounded flex items-center justify-center"
        style={{
          background: style.previewColors.length > 1 
            ? `linear-gradient(135deg, ${style.previewColors[0]}, ${style.previewColors[1]})`
            : style.previewColors[0],
        }}
      >
        <IconComponent className="h-3 w-3 text-white" />
      </div>
      <span className="text-sm font-medium">{style.name}</span>
    </div>
  );
});
