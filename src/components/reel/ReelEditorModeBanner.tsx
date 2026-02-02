/**
 * Reel Editor Mode Banner
 * 
 * Subtle but clear indicator that the user has entered the Reel Editor.
 * Shows editing mode context and reel compilation status.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  Film, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Wand2,
} from "lucide-react";

export type ReelStatus = "compiling" | "draft" | "ready" | "rendering" | "error";

interface ReelEditorModeBannerProps {
  status: ReelStatus;
  effectCount?: number;
  className?: string;
}

const STATUS_CONFIG: Record<ReelStatus, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  draft: {
    label: "Editing",
    description: "Add effects, frames, and packages",
    icon: Wand2,
    iconClass: "text-primary",
    bgClass: "bg-primary/5",
    borderClass: "border-primary/20",
  },
  compiling: {
    label: "Compiling",
    description: "Assembling your reel...",
    icon: Loader2,
    iconClass: "text-vantage-warning animate-spin",
    bgClass: "bg-vantage-warning/5",
    borderClass: "border-vantage-warning/20",
  },
  ready: {
    label: "Ready to Edit",
    description: "Make it yours with effects and frames",
    icon: CheckCircle2,
    iconClass: "text-vantage-success",
    bgClass: "bg-vantage-success/5",
    borderClass: "border-vantage-success/20",
  },
  rendering: {
    label: "Rendering",
    description: "Applying effects to final output...",
    icon: Loader2,
    iconClass: "text-vantage-warning animate-spin",
    bgClass: "bg-vantage-warning/5",
    borderClass: "border-vantage-warning/20",
  },
  error: {
    label: "Error",
    description: "Something went wrong",
    icon: AlertTriangle,
    iconClass: "text-destructive",
    bgClass: "bg-destructive/5",
    borderClass: "border-destructive/20",
  },
};

export const ReelEditorModeBanner = memo(function ReelEditorModeBanner({
  status,
  effectCount = 0,
  className,
}: ReelEditorModeBannerProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div 
      className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-lg border transition-colors",
        config.bgClass,
        config.borderClass,
        className
      )}
    >
      {/* Mode Icon */}
      <div className="flex items-center gap-2">
        <Film className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          Reel Editor
        </span>
      </div>
      
      {/* Divider */}
      <div className="w-px h-4 bg-border/50" />
      
      {/* Status */}
      <div className="flex items-center gap-2 flex-1">
        <Icon className={cn("h-3.5 w-3.5", config.iconClass)} />
        <span className="text-xs font-medium text-foreground">
          {config.label}
        </span>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          — {config.description}
        </span>
      </div>

      {/* Effect count badge */}
      {effectCount > 0 && status !== "compiling" && (
        <Badge 
          variant="secondary" 
          className="text-[10px] gap-1 bg-muted/50"
        >
          <Sparkles className="h-2.5 w-2.5" />
          {effectCount} FX
        </Badge>
      )}
    </div>
  );
});

export default ReelEditorModeBanner;
