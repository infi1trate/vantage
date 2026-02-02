/**
 * PopoverToast
 * 
 * Status notification toast for the popover.
 * Used for success, error, and info messages.
 */

import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ToastVariant = "success" | "error" | "info" | "loading";

interface PopoverToastProps {
  variant: ToastVariant;
  title: string;
  message?: string;
  onDismiss?: () => void;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

const VARIANT_CONFIG: Record<ToastVariant, {
  icon: typeof CheckCircle2;
  iconClass: string;
  bgClass: string;
}> = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-vantage-green",
    bgClass: "bg-vantage-green/10 border-vantage-green/20",
  },
  error: {
    icon: AlertCircle,
    iconClass: "text-destructive",
    bgClass: "bg-destructive/10 border-destructive/20",
  },
  info: {
    icon: Info,
    iconClass: "text-blue-400",
    bgClass: "bg-blue-500/10 border-blue-500/20",
  },
  loading: {
    icon: Loader2,
    iconClass: "text-muted-foreground animate-spin",
    bgClass: "bg-white/5 border-white/10",
  },
};

export function PopoverToast({
  variant,
  title,
  message,
  onDismiss,
  action,
}: PopoverToastProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg border",
      config.bgClass
    )}>
      {/* Icon */}
      <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", config.iconClass)} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {message && (
          <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
        )}
        
        {/* Action button */}
        {action && (
          <Button
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className="h-7 px-2 mt-2 text-xs hover:bg-white/10"
          >
            {action.label}
          </Button>
        )}
      </div>

      {/* Dismiss */}
      {onDismiss && variant !== "loading" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-6 w-6 p-0 hover:bg-white/10"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
