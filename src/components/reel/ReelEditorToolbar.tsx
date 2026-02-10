/**
 * Reel Editor Toolbar
 * 
 * Bottom toolbar for switching between editing modes in the Reel Editor.
 * Includes an effects lane visibility toggle (preview-only, doesn't affect stored data).
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";
import { 
  Wand2, 
  Frame, 
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";

type EditorTab = "effects" | "frames" | "package";

interface ReelEditorToolbarProps {
  activeTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  showEffectsLane?: boolean;
  onShowEffectsLaneChange?: (show: boolean) => void;
  effectCount?: number;
  disabled?: boolean;
  className?: string;
}

const TABS: { id: EditorTab; label: string; icon: React.ElementType }[] = [
  { id: "effects", label: "Effects", icon: Wand2 },
  { id: "frames", label: "Frames", icon: Frame },
  { id: "package", label: "Package", icon: Sparkles },
];

export const ReelEditorToolbar = memo(function ReelEditorToolbar({
  activeTab,
  onTabChange,
  showEffectsLane = true,
  onShowEffectsLaneChange,
  effectCount = 0,
  disabled = false,
  className,
}: ReelEditorToolbarProps) {
  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-2 border-t border-border/40 bg-card/50",
      disabled && "opacity-50 pointer-events-none",
      className
    )}>
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              onClick={() => onTabChange(tab.id)}
              disabled={disabled}
              className={cn(
                "gap-1.5 h-8 px-3",
                isActive && "shadow-sm"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Effects Lane Toggle (preview-only visibility) */}
      {onShowEffectsLaneChange && (
        <div className="flex items-center gap-2">
          {effectCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {effectCount} FX
            </Badge>
          )}
          <Toggle
            pressed={showEffectsLane}
            onPressedChange={onShowEffectsLaneChange}
            size="sm"
            disabled={disabled}
            className="gap-1.5"
          >
            {showEffectsLane ? (
              <>
                <Eye className="h-3.5 w-3.5" />
                Lane
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                Lane
              </>
            )}
          </Toggle>
        </div>
      )}
    </div>
  );
});

export default ReelEditorToolbar;
