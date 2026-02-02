/**
 * WindowPickerGrid
 * 
 * Grid view for selecting a specific window to capture.
 * Inspired by Loom's window picker UI.
 */

import { cn } from "@/lib/utils";
import { MockWindow } from "./types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";

interface WindowPickerGridProps {
  windows: MockWindow[];
  selectedWindowId: string | null;
  onSelect: (window: MockWindow) => void;
  onBack: () => void;
}

export function WindowPickerGrid({
  windows,
  selectedWindowId,
  onSelect,
  onBack,
}: WindowPickerGridProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 w-8 p-0 hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Select a window
        </h3>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        Choose the window you want to record. Only this window will be captured.
      </p>

      {/* Window grid */}
      <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
        {windows.map((window) => {
          const isSelected = window.id === selectedWindowId;
          
          return (
            <button
              key={window.id}
              onClick={() => onSelect(window)}
              className={cn(
                // Base
                "relative group rounded-lg overflow-hidden",
                "border transition-all duration-150",
                // States
                isSelected 
                  ? "border-vantage-green ring-2 ring-vantage-green/30" 
                  : "border-white/10 hover:border-white/20",
                // Focus
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green/50"
              )}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-white/5 flex items-center justify-center">
                <img 
                  src={window.thumbnail} 
                  alt={window.name}
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                />
                
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                
                {/* Selected check */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-vantage-green flex items-center justify-center">
                    <Check className="w-3 h-3 text-background" />
                  </div>
                )}
              </div>

              {/* Window info */}
              <div className="absolute bottom-0 inset-x-0 p-2">
                <p className="text-xs font-medium text-white truncate">
                  {window.name}
                </p>
                <p className="text-[10px] text-white/60 truncate">
                  {window.appName}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {windows.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No windows detected</p>
          <p className="text-xs text-muted-foreground mt-1">
            Open an application and try again
          </p>
        </div>
      )}
    </div>
  );
}
