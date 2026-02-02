/**
 * Audio Mode Picker Component
 * 
 * Segmented control for audio mode selection.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";
import { Volume2 } from "lucide-react";
import { AudioMode, AUDIO_MODE_DEFINITIONS } from "@/lib/reelPackageConfig";

interface AudioModePickerProps {
  selectedMode: AudioMode;
  onModeChange: (mode: AudioMode) => void;
  className?: string;
}

export const AudioModePicker = memo(function AudioModePicker({
  selectedMode,
  onModeChange,
  className,
}: AudioModePickerProps) {
  return (
    <div className={cn("flex rounded-lg border border-border/50 overflow-hidden", className)}>
      {AUDIO_MODE_DEFINITIONS.map((mode, index) => {
        const isSelected = selectedMode === mode.key;
        const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[mode.icon] || Volume2;
        
        return (
          <button
            key={mode.key}
            onClick={() => onModeChange(mode.key)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 px-3 py-2.5 text-center",
              "transition-colors touch-manipulation",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
              index > 0 && "border-l border-border/50",
              isSelected
                ? "bg-primary/10 text-primary"
                : "bg-background hover:bg-muted/50 text-muted-foreground"
            )}
          >
            <IconComponent className="h-4 w-4" />
            <span className="text-[10px] font-medium leading-tight">{mode.name}</span>
          </button>
        );
      })}
    </div>
  );
});

/**
 * Compact audio mode indicator
 */
export const AudioModeIndicator = memo(function AudioModeIndicator({
  mode,
  className,
}: {
  mode: AudioMode;
  className?: string;
}) {
  const modeDef = AUDIO_MODE_DEFINITIONS.find(m => m.key === mode);
  if (!modeDef) return null;
  
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[modeDef.icon] || Volume2;
  
  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <IconComponent className="h-3 w-3" />
      <span>{modeDef.name}</span>
    </div>
  );
});
