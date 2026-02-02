/**
 * Session Mode Badge
 * 
 * Subtle indicator in Session Detail to clarify read-only review mode.
 * Optionally shows when reels are available or can be created.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  Film,
  Lock,
} from "lucide-react";

interface SessionModeBadgeProps {
  reelCount?: number;
  className?: string;
}

export const SessionModeBadge = memo(function SessionModeBadge({
  reelCount = 0,
  className,
}: SessionModeBadgeProps) {
  return (
    <div 
      className={cn(
        "flex items-center gap-2",
        className
      )}
    >
      {/* Review mode indicator */}
      <Badge 
        variant="outline" 
        className="text-[10px] gap-1 text-muted-foreground border-muted-foreground/30 bg-muted/20"
      >
        <Eye className="h-2.5 w-2.5" />
        Review Mode
      </Badge>

      {/* Reel count if any */}
      {reelCount > 0 && (
        <Badge 
          variant="secondary" 
          className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20"
        >
          <Film className="h-2.5 w-2.5" />
          {reelCount} Reel{reelCount !== 1 ? "s" : ""}
        </Badge>
      )}
    </div>
  );
});

export default SessionModeBadge;
