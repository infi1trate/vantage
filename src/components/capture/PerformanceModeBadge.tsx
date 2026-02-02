/**
 * Performance Mode Badge
 * 
 * Subtle UI indicator showing current capture performance mode
 * and any degradation warnings. Auto-hides when in "high" mode.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { 
  Zap, 
  Gauge, 
  AlertTriangle,
  Activity,
} from "lucide-react";
import { PerformanceMode, CaptureHealthState } from "@/lib/captureHealth";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PerformanceModeBadgeProps {
  /** Current performance mode */
  mode: PerformanceMode;
  /** Full health state (optional, for tooltip details) */
  health?: CaptureHealthState;
  /** Whether currently recording */
  isRecording?: boolean;
  /** Always show (even in high mode) */
  alwaysShow?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional classes */
  className?: string;
}

const MODE_CONFIG: Record<PerformanceMode, {
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  description: string;
}> = {
  high: {
    label: "High Performance",
    shortLabel: "High",
    icon: Zap,
    color: "text-vantage-success",
    bgColor: "bg-vantage-success/10",
    description: "All effects and previews enabled",
  },
  balanced: {
    label: "Balanced Mode",
    shortLabel: "Balanced",
    icon: Gauge,
    color: "text-vantage-warning",
    bgColor: "bg-vantage-warning/10",
    description: "Some effects reduced to maintain performance",
  },
  minimal: {
    label: "Minimal Mode",
    shortLabel: "Minimal",
    icon: AlertTriangle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    description: "Effects disabled to protect recording quality",
  },
};

export const PerformanceModeBadge = memo(function PerformanceModeBadge({
  mode,
  health,
  isRecording = false,
  alwaysShow = false,
  size = "md",
  className,
}: PerformanceModeBadgeProps) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;
  
  // Hide in high mode unless alwaysShow or recording
  if (mode === "high" && !alwaysShow && !isRecording) {
    return null;
  }
  
  const sizeClasses = size === "sm" 
    ? "h-6 px-2 text-xs gap-1"
    : "h-8 px-3 text-sm gap-1.5";
  
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  
  const badge = (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-all",
        config.bgColor,
        config.color,
        sizeClasses,
        className
      )}
    >
      <Icon className={cn(iconSize, mode !== "high" && "animate-pulse")} />
      <span>{config.shortLabel}</span>
      {isRecording && (
        <Activity className={cn(iconSize, "ml-0.5 animate-pulse text-destructive")} />
      )}
    </div>
  );
  
  // If no health data, just show the badge
  if (!health) {
    return badge;
  }
  
  // With health data, wrap in tooltip
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-medium">{config.label}</div>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            
            {health.degradationReason && (
              <div className="text-xs text-destructive">
                ⚠️ {health.degradationReason}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="text-muted-foreground">FPS:</div>
              <div className={cn(
                health.compositeFPS < 24 ? "text-destructive" : "text-foreground"
              )}>
                {health.compositeFPS.toFixed(0)}
              </div>
              
              <div className="text-muted-foreground">Dropped:</div>
              <div className={cn(
                health.droppedPerMinute > 3 ? "text-destructive" : "text-foreground"
              )}>
                {health.droppedPerMinute.toFixed(1)}/min
              </div>
              
              <div className="text-muted-foreground">Memory:</div>
              <div className={cn(
                health.memoryPressure !== "normal" ? "text-vantage-warning" : "text-foreground"
              )}>
                {health.memoryPressure}
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export default PerformanceModeBadge;
