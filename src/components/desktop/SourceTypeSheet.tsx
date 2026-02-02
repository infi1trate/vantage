/**
 * SourceTypeSheet
 * 
 * In-popover sheet for selecting capture source type.
 * Options: Full screen, Specific window, Camera only
 */

import { cn } from "@/lib/utils";
import { Monitor, AppWindow, Video, Check, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaptureSourceType } from "./types";

interface SourceTypeSheetProps {
  selectedType: CaptureSourceType;
  onSelect: (type: CaptureSourceType) => void;
  onBack: () => void;
  onSelectWindow: () => void;
}

const SOURCE_OPTIONS: {
  type: CaptureSourceType;
  label: string;
  description: string;
  icon: typeof Monitor;
}[] = [
  {
    type: "screen",
    label: "Full screen",
    description: "Record your entire display",
    icon: Monitor,
  },
  {
    type: "window",
    label: "Specific window",
    description: "Choose a single window to record",
    icon: AppWindow,
  },
  {
    type: "camera",
    label: "Camera only",
    description: "Records your camera + mic",
    icon: Video,
  },
];

export function SourceTypeSheet({
  selectedType,
  onSelect,
  onBack,
  onSelectWindow,
}: SourceTypeSheetProps) {
  const handleSelect = (type: CaptureSourceType) => {
    onSelect(type);
    if (type === "window") {
      onSelectWindow();
    } else {
      onBack();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
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
          Choose source
        </h3>
      </div>

      {/* Options */}
      <div className="space-y-1.5" role="radiogroup" aria-label="Capture source type">
        {SOURCE_OPTIONS.map((option) => {
          const isSelected = option.type === selectedType;
          const Icon = option.icon;
          const isWindow = option.type === "window";

          return (
            <button
              key={option.type}
              onClick={() => handleSelect(option.type)}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${option.label}: ${option.description}`}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl",
                "border-2 transition-all duration-150",
                isSelected
                  ? "border-vantage-green bg-vantage-green/10"
                  : "border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              {/* Icon */}
              <div className={cn(
                "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                "border transition-colors",
                isSelected 
                  ? "bg-vantage-green/20 border-vantage-green/30" 
                  : "bg-white/[0.06] border-white/[0.08]"
              )}>
                <Icon className={cn(
                  "w-5 h-5",
                  isSelected ? "text-vantage-green" : "text-muted-foreground"
                )} />
              </div>

              {/* Label & description */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {option.label}
                  </span>
                  {isWindow && !isSelected && (
                    <span className="text-[10px] text-vantage-green font-medium">
                      →
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {option.description}
                </p>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-vantage-green flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-background" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
