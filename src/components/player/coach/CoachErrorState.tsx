import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface CoachErrorStateProps {
  error?: string;
  onRetry: () => void;
  disabled?: boolean;
}

export function CoachErrorState({ error, onRetry, disabled }: CoachErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      
      <h4 className="font-semibold mb-2">Coach Review Failed</h4>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        {error || "Something went wrong while analyzing your session."}
      </p>
      
      <Button onClick={onRetry} disabled={disabled} variant="outline">
        <RefreshCw className="h-4 w-4 mr-2" />
        Try Again
      </Button>
      
      <p className="text-[11px] text-muted-foreground mt-4 max-w-xs">
        If the problem persists, try refreshing the page or check your connection.
      </p>
    </div>
  );
}
