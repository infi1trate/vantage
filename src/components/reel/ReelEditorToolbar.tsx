/**
 * Reel Editor Toolbar
 * 
 * Bottom toolbar for switching between editing modes in the Reel Editor.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Wand2, 
  Frame, 
  Sparkles,
} from "lucide-react";

type EditorTab = "effects" | "frames" | "package";

interface ReelEditorToolbarProps {
  activeTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
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
  disabled = false,
  className,
}: ReelEditorToolbarProps) {
  return (
    <div className={cn(
      "flex items-center px-4 py-2 border-t border-border/40 bg-card/50",
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
    </div>
  );
});

export default ReelEditorToolbar;
