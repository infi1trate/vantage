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
    description: "Record just your webcam",
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
          className="h-8 w-8 p-0 hover:bg-white/10 -ml-1"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h3 className="text-sm font-semibold text-foreground">
          Choose source
        </h3>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {SOURCE_OPTIONS.map((option) => {
          const isSelected = option.type === selectedType;
          const Icon = option.icon;
          const isWindow = option.type === "window";

          return (
            <button
              key={option.type}
              onClick={() => handleSelect(option.type)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl",
                "border-2 transition-all duration-150",
                isSelected
                  ? "border-vantage-green bg-vantage-green/10"
                  : "border-transparent hover:bg-white/5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green/50"
              )}
            >
              {/* Icon */}
              <div className={cn(
                "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                isSelected ? "bg-vantage-green/20" : "bg-white/5"
              )}>
                <Icon className={cn(
                  "w-5 h-5",
                  isSelected ? "text-vantage-green" : "text-muted-foreground"
                )} />
              </div>

              {/* Label & description */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium",
                    isSelected ? "text-foreground" : "text-foreground"
                  )}>
                    {option.label}
                  </span>
                  {isWindow && (
                    <span className="text-[10px] text-vantage-green font-medium uppercase tracking-wider">
                      Select
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-vantage-green flex items-center justify-center">
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
