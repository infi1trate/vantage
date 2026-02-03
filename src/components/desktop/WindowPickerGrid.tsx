/**
 * WindowPickerGrid
 * 
 * Grid view for selecting a specific window to capture.
 * Matches Loom's window picker UX with 2-column grid.
 */

import { cn } from "@/lib/utils";
import { MockWindow } from "./types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Check } from "lucide-react";

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
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          aria-label="Go back"
          className={cn(
            "h-8 w-8 p-0 rounded-lg -ml-1",
            "hover:bg-white/[0.08] active:bg-white/[0.12]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h3 className="text-sm font-semibold text-foreground">
          Select a window
        </h3>
      </div>

      {/* 2-column Window grid */}
      <div 
        className="grid grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1 -mr-1"
        role="radiogroup"
        aria-label="Available windows"
      >
        {windows.map((window) => {
          const isSelected = window.id === selectedWindowId;
          
          return (
            <button
              key={window.id}
              onClick={() => onSelect(window)}
              role="radio"
              aria-checked={isSelected}
              aria-label={`Select ${window.name}`}
              className={cn(
                // Base
                "relative group rounded-xl overflow-hidden",
                "border-2 transition-all duration-150",
                // States
                isSelected 
                  ? "border-vantage-green ring-2 ring-vantage-green/20" 
                  : "border-white/[0.06] hover:border-white/[0.15]",
                // Focus
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              {/* Thumbnail area */}
              <div className="aspect-[4/3] relative overflow-hidden">
                {/* Real thumbnail when available */}
                {window.thumbnail ? (
                  <>
                    <img
                      src={window.thumbnail}
                      alt={`Preview of ${window.name}`}
                      className="absolute inset-0 w-full h-full object-cover"
                      draggable={false}
                    />
                    {/* Subtle grid texture overlay */}
                    <div 
                      className="absolute inset-0 opacity-10 pointer-events-none"
                      style={{
                        backgroundImage: `
                          linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
                        `,
                        backgroundSize: '16px 16px'
                      }}
                      aria-hidden="true"
                    />
                  </>
                ) : (
                  <>
                    {/* Gray gradient background fallback */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-white/[0.03]" />
                    
                    {/* Subtle grid texture */}
                    <div 
                      className="absolute inset-0 opacity-20"
                      style={{
                        backgroundImage: `
                          linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)
                        `,
                        backgroundSize: '12px 12px'
                      }}
                      aria-hidden="true"
                    />
                    
                    {/* App icon placeholder */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-lg bg-white/[0.08] flex items-center justify-center">
                        <span className="text-lg font-bold text-white/40">
                          {window.appName.charAt(0)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Hover overlay */}
                <div className={cn(
                  "absolute inset-0 transition-opacity duration-150",
                  "bg-vantage-green/0 group-hover:bg-vantage-green/5"
                )} />
                
                {/* Selected check */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-vantage-green flex items-center justify-center shadow-lg">
                    <Check className="w-3 h-3 text-background" />
                  </div>
                )}
              </div>

              {/* Window label */}
              <div className="px-2 py-1.5 bg-white/[0.04]">
                <p className="text-[11px] font-medium text-foreground truncate text-center">
                  {window.name}
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
