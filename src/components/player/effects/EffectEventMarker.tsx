/**
 * Effect Event Marker (Pill) Component
 * 
 * Lightweight DOM element rendered on the timeline for placed effects.
 * Clicking opens the inline editor popover.
 */

import { memo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EffectEvent, getVFXDefinition, getSFXDefinition } from "@/lib/effectEvents";
import { EffectEditor } from "./EffectEditor";

interface EffectEventMarkerProps {
  effect: EffectEvent;
  duration: number;
  onSeek: (time: number) => void;
  onUpdate: (updates: Partial<EffectEvent>) => void;
  onDelete: () => void;
  onDuplicate: (newStartTimeMs: number) => void;
}

export const EffectEventMarker = memo(function EffectEventMarker({
  effect,
  duration,
  onSeek,
  onUpdate,
  onDelete,
  onDuplicate,
}: EffectEventMarkerProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const definition = effect.type === "vfx" 
    ? getVFXDefinition(effect.key) 
    : getSFXDefinition(effect.key);

  // Get icon component
  const iconName = definition?.icon || "Sparkles";
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName] || LucideIcons.Sparkles;

  const leftPercent = (effect.start_time_ms / 1000 / duration) * 100;
  const widthPercent = (effect.duration_ms / 1000 / duration) * 100;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSeek(effect.start_time_ms / 1000);
  }, [effect.start_time_ms, onSeek]);

  const formatTime = (ms: number) => {
    const seconds = ms / 1000;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Popover open={isEditorOpen} onOpenChange={setIsEditorOpen}>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "absolute top-1/2 -translate-y-1/2 h-5 min-w-[28px] rounded-full",
                "flex items-center justify-center gap-1 px-1.5",
                "transition-all duration-100 z-20",
                "hover:scale-105 active:scale-95",
                "touch-manipulation cursor-pointer",
                // Type-specific styling
                effect.type === "vfx"
                  ? "bg-primary/80 hover:bg-primary text-primary-foreground"
                  : "bg-accent/80 hover:bg-accent text-accent-foreground",
                // Disabled state
                !effect.is_enabled && "opacity-40"
              )}
              style={{
                left: `${leftPercent}%`,
                width: `max(28px, ${widthPercent}%)`,
              }}
              onClick={handleClick}
            >
              <IconComponent className="h-3 w-3 shrink-0" />
              {widthPercent > 3 && (
                <span className="text-[9px] font-medium truncate">
                  {definition?.name || effect.key}
                </span>
              )}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs" sideOffset={8}>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{definition?.name || effect.key}</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatTime(effect.start_time_ms)}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        side="top"
        align="center"
        className="w-64 p-0"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
      >
        <EffectEditor
          effect={effect}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onClose={() => setIsEditorOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
});
