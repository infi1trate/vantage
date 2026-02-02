/**
 * UnauthorizedStateBody
 * 
 * Compact "Connect to Vantage" panel shown when user is not authorized.
 */

import { cn } from "@/lib/utils";
import { LogIn, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnauthorizedStateBodyProps {
  isAuthorizing: boolean;
  onAuthorize: () => void;
  onLearnMore: () => void;
}

export function UnauthorizedStateBody({
  isAuthorizing,
  onAuthorize,
  onLearnMore,
}: UnauthorizedStateBodyProps) {
  if (isAuthorizing) {
    return (
      <div className="py-10 flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-vantage-green/20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-vantage-green animate-spin" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Authorizing…
          </h3>
          <p className="text-xs text-muted-foreground">
            Connecting to your Vantage account
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 flex flex-col items-center">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-vantage-green/20 flex items-center justify-center mb-4">
        <LogIn className="w-7 h-7 text-vantage-green" />
      </div>

      {/* Title & copy */}
      <h3 className="text-base font-semibold text-foreground mb-2 text-center">
        Authorize Vantage
      </h3>
      <p className="text-xs text-muted-foreground text-center mb-6 px-4 max-w-[280px]">
        To record and sync sessions, connect this desktop app to your Vantage account.
      </p>

      {/* Primary CTA */}
      <Button
        onClick={onAuthorize}
        className={cn(
          "w-full h-12 text-sm font-bold uppercase tracking-wider",
          "bg-vantage-green hover:bg-vantage-green/90 text-background",
          "shadow-lg shadow-vantage-green/25",
          "rounded-xl mb-3",
          "transition-all duration-150 active:scale-[0.98]"
        )}
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Authorize on web
      </Button>

      {/* Secondary link */}
      <button
        onClick={onLearnMore}
        className={cn(
          "text-xs text-muted-foreground hover:text-foreground",
          "underline underline-offset-2",
          "transition-colors duration-150"
        )}
      >
        Learn what gets recorded
      </button>
    </div>
  );
}
