/**
 * Draggable Effect Chip Component
 * 
 * Compact chip/card for VFX/SFX effects that can be dragged onto the timeline.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EffectChipProps {
  effectKey: string;
  name: string;
  description: string;
  icon: string;
  type: "vfx" | "sfx";
  category: string;
  onDragStart: (e: React.DragEvent, effectKey: string, type: "vfx" | "sfx") => void;
}

export const EffectChip = memo(function EffectChip({
  effectKey,
  name,
  description,
  icon,
  type,
  category,
  onDragStart,
}: EffectChipProps) {
  // Dynamically get icon from Lucide
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] || LucideIcons.Sparkles;

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          draggable
          onDragStart={(e) => onDragStart(e, effectKey, type)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing",
            "bg-muted/50 hover:bg-muted border border-border/40 hover:border-border",
            "transition-all duration-150 touch-manipulation",
            "hover:scale-[1.02] active:scale-95",
            // Type-specific accent colors
            type === "vfx" 
              ? "hover:border-primary/40 hover:bg-primary/5" 
              : "hover:border-accent/40 hover:bg-accent/5"
          )}
        >
          <div
            className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
              type === "vfx" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
            )}
          >
            <IconComponent className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium truncate">{name}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-xs">{name}</span>
          <span className="text-[10px] text-muted-foreground">{description}</span>
          <span className="text-[10px] text-muted-foreground/70 capitalize">{category}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});
