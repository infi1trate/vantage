import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Lock, Globe, Link2, Users, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

type Visibility = "private" | "unlisted" | "public";

interface PrivacyBadgeProps {
  visibility: Visibility;
  sharedWith?: number;
  className?: string;
  showTooltip?: boolean;
}

const VISIBILITY_CONFIG = {
  private: {
    icon: Lock,
    label: "Private",
    description: "Only you can see this session",
    color: "text-vantage-success border-vantage-success/30 bg-vantage-success/10",
  },
  unlisted: {
    icon: Link2,
    label: "Unlisted",
    description: "Only people with the link can access",
    color: "text-vantage-warning border-vantage-warning/30 bg-vantage-warning/10",
  },
  public: {
    icon: Globe,
    label: "Public",
    description: "Anyone can discover and view this session",
    color: "text-primary border-primary/30 bg-primary/10",
  },
};

export function PrivacyBadge({
  visibility,
  sharedWith = 0,
  className,
  showTooltip = true,
}: PrivacyBadgeProps) {
  const config = VISIBILITY_CONFIG[visibility];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="outline"
      className={cn("gap-1.5 text-xs", config.color, className)}
    >
      <Icon className="h-3 w-3" />
      {config.label}
      {sharedWith > 0 && visibility === "private" && (
        <span className="ml-1 flex items-center gap-0.5">
          <Users className="h-3 w-3" />
          {sharedWith}
        </span>
      )}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
          {sharedWith > 0 && (
            <p className="text-xs text-muted-foreground">
              Shared with {sharedWith} {sharedWith === 1 ? "person" : "people"}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Compact indicator for lists
interface PrivacyIndicatorProps {
  visibility: Visibility;
  className?: string;
}

export function PrivacyIndicator({ visibility, className }: PrivacyIndicatorProps) {
  const config = VISIBILITY_CONFIG[visibility];
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full",
            visibility === "private" && "bg-vantage-success/10",
            visibility === "unlisted" && "bg-vantage-warning/10",
            visibility === "public" && "bg-primary/10",
            className
          )}
        >
          <Icon
            className={cn(
              "h-3 w-3",
              visibility === "private" && "text-vantage-success",
              visibility === "unlisted" && "text-vantage-warning",
              visibility === "public" && "text-primary"
            )}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="text-xs">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}
