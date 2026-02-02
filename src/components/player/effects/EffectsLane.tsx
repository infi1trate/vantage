/**
 * Effects Lane Component
 * 
 * Dedicated timeline lane for VFX/SFX effect events.
 * Supports:
 * - Drop zone for dragging effects from the tray
 * - Effect pill markers
 * - Visual feedback during drag-over
 */

import { memo, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { EffectEvent } from "@/lib/effectEvents";
import { EffectEventMarker } from "./EffectEventMarker";
import { Wand2 } from "lucide-react";

interface EffectsLaneProps {
  effects: EffectEvent[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  onEffectUpdate: (effectId: string, updates: Partial<EffectEvent>) => void;
  onEffectDelete: (effectId: string) => void;
  onEffectDuplicate: (effectId: string, newStartTimeMs: number) => void;
  onDrop: (effectKey: string, type: "vfx" | "sfx", startTimeMs: number) => void;
  isDragging: boolean;
}

export const EffectsLane = memo(function EffectsLane({
  effects,
  duration,
  currentTime,
  onSeek,
  onEffectUpdate,
  onEffectDelete,
  onEffectDuplicate,
  onDrop,
  isDragging,
}: EffectsLaneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropPreviewX, setDropPreviewX] = useState<number | null>(null);
  const laneRef = useRef<HTMLDivElement>(null);

  const getTimeFromPosition = useCallback((clientX: number): number => {
    if (!laneRef.current) return 0;
    const rect = laneRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return percentage * duration * 1000; // Return ms
  }, [duration]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
    
    // Update drop preview position
    if (laneRef.current) {
      const rect = laneRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      setDropPreviewX(Math.max(0, Math.min(100, x)));
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only trigger leave if actually leaving the lane
    if (laneRef.current && !laneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      setDropPreviewX(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropPreviewX(null);

    const effectKey = e.dataTransfer.getData("effect/key");
    const effectType = e.dataTransfer.getData("effect/type") as "vfx" | "sfx";

    if (effectKey && effectType) {
      const startTimeMs = getTimeFromPosition(e.clientX);
      onDrop(effectKey, effectType, Math.round(startTimeMs));
    }
  }, [getTimeFromPosition, onDrop]);

  const progressPercentage = (currentTime / duration) * 100;

  // Separate VFX and SFX for visual layering
  const vfxEffects = effects.filter(e => e.type === "vfx" && e.is_enabled);
  const sfxEffects = effects.filter(e => e.type === "sfx" && e.is_enabled);
  const disabledEffects = effects.filter(e => !e.is_enabled);

  return (
    <div className="flex items-center gap-2">
      {/* Lane label */}
      <div className="w-16 shrink-0 text-xs text-muted-foreground truncate flex items-center gap-1">
        <Wand2 className="h-3 w-3" />
        <span>Effects</span>
      </div>

      {/* Lane content */}
      <div
        ref={laneRef}
        className={cn(
          "relative flex-1 h-8 rounded cursor-crosshair transition-all duration-150",
          "bg-muted/30 border border-transparent",
          isDragOver && "bg-primary/10 border-primary/30 border-dashed",
          isDragging && !isDragOver && "border-muted-foreground/20 border-dashed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Progress indicator */}
        <div
          className="absolute top-0 left-0 h-full bg-primary/5 rounded-l pointer-events-none"
          style={{ width: `${progressPercentage}%` }}
        />

        {/* Playhead */}
        <div
          className="absolute top-0 w-0.5 h-full bg-primary/50 pointer-events-none z-10"
          style={{ left: `${progressPercentage}%` }}
        />

        {/* Drop preview indicator */}
        {isDragOver && dropPreviewX !== null && (
          <div
            className="absolute top-0 h-full w-1 bg-primary/60 rounded pointer-events-none z-30"
            style={{ left: `${dropPreviewX}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background" />
          </div>
        )}

        {/* VFX markers (top half) */}
        <div className="absolute top-0 left-0 right-0 h-1/2">
          {vfxEffects.map((effect) => (
            <EffectEventMarker
              key={effect.id}
              effect={effect}
              duration={duration}
              onSeek={onSeek}
              onUpdate={(updates) => onEffectUpdate(effect.id, updates)}
              onDelete={() => onEffectDelete(effect.id)}
              onDuplicate={(newStartTimeMs) => onEffectDuplicate(effect.id, newStartTimeMs)}
            />
          ))}
        </div>

        {/* SFX markers (bottom half) */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2">
          {sfxEffects.map((effect) => (
            <EffectEventMarker
              key={effect.id}
              effect={effect}
              duration={duration}
              onSeek={onSeek}
              onUpdate={(updates) => onEffectUpdate(effect.id, updates)}
              onDelete={() => onEffectDelete(effect.id)}
              onDuplicate={(newStartTimeMs) => onEffectDuplicate(effect.id, newStartTimeMs)}
            />
          ))}
        </div>

        {/* Disabled effects (muted) */}
        {disabledEffects.map((effect) => (
          <EffectEventMarker
            key={effect.id}
            effect={effect}
            duration={duration}
            onSeek={onSeek}
            onUpdate={(updates) => onEffectUpdate(effect.id, updates)}
            onDelete={() => onEffectDelete(effect.id)}
            onDuplicate={(newStartTimeMs) => onEffectDuplicate(effect.id, newStartTimeMs)}
          />
        ))}

        {/* Empty state */}
        {effects.length === 0 && !isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-muted-foreground/40">
              {isDragging ? "Drop effect here" : "No effects"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
