/**
 * SourceRow
 * 
 * A row for selecting capture source (screen, window, camera).
 * Shows icon, label, and optional "Select" action.
 */

import { cn } from "@/lib/utils";
import { Monitor, AppWindow, Camera, Check, ChevronRight } from "lucide-react";
import { CaptureSource, CaptureSourceType } from "./types";

interface SourceRowProps {
  source: CaptureSource;
  isSelected: boolean;
  onSelect: () => void;
  /** For "window" type, shows "Select" button instead of radio */
  onSelectWindow?: () => void;
  /** Currently selected window name (if any) */
  selectedWindowName?: string;
}

const SOURCE_ICONS: Record<CaptureSourceType, typeof Monitor> = {
  screen: Monitor,
  window: AppWindow,
  camera: Camera,
};

export function SourceRow({
  source,
  isSelected,
  onSelect,
  onSelectWindow,
  selectedWindowName,
}: SourceRowProps) {
  const Icon = SOURCE_ICONS[source.type];
  const isWindowType = source.type === "window";
  const hasSelectedWindow = isWindowType && selectedWindowName;

  return (
    <button
      onClick={isWindowType && onSelectWindow ? onSelectWindow : onSelect}
      className={cn(
        // Base layout
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
        // Transition
        "transition-all duration-150",
        // Hover state
        "hover:bg-white/5",
        // Active/pressed
        "active:scale-[0.98]",
        // Selected state
        isSelected && !isWindowType && "bg-vantage-green/10 ring-1 ring-vantage-green/30",
        hasSelectedWindow && "bg-vantage-green/10 ring-1 ring-vantage-green/30",
        // Focus
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green/50"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
        "bg-white/5",
        (isSelected || hasSelectedWindow) && "bg-vantage-green/20"
      )}>
        <Icon className={cn(
          "w-5 h-5",
          (isSelected || hasSelectedWindow) ? "text-vantage-green" : "text-muted-foreground"
        )} />
      </div>

      {/* Label & sublabel */}
      <div className="flex-1 text-left min-w-0">
        <div className={cn(
          "text-sm font-medium truncate",
          (isSelected || hasSelectedWindow) ? "text-foreground" : "text-muted-foreground"
        )}>
          {source.name}
        </div>
        {hasSelectedWindow && (
          <div className="text-xs text-vantage-green truncate">
            {selectedWindowName}
          </div>
        )}
      </div>

      {/* Right indicator */}
      {isWindowType ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{hasSelectedWindow ? "Change" : "Select"}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      ) : (
        <div className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
          "transition-colors duration-150",
          isSelected 
            ? "border-vantage-green bg-vantage-green" 
            : "border-muted-foreground/30"
        )}>
          {isSelected && <Check className="w-3 h-3 text-background" />}
        </div>
      )}
    </button>
  );
}
