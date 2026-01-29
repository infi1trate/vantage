import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, ArrowLeft, Settings } from "lucide-react";

interface PermissionErrorProps {
  error: string;
  onRetry: () => void;
  onCancel: () => void;
}

export function PermissionError({ error, onRetry, onCancel }: PermissionErrorProps) {
  const isScreenError = error.toLowerCase().includes("screen");
  const isMicrophoneError = error.toLowerCase().includes("microphone");
  const isCameraError = error.toLowerCase().includes("camera");

  const getHelpText = () => {
    if (isScreenError) {
      return (
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Click "Allow" when prompted to share your screen</li>
          <li>Select the game window you want to capture</li>
          <li>If using Chrome, check the address bar for blocked permissions</li>
          <li>Try refreshing the page and starting again</li>
        </ul>
      );
    }
    
    if (isMicrophoneError) {
      return (
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Click the lock icon in your browser's address bar</li>
          <li>Find "Microphone" and change it to "Allow"</li>
          <li>Refresh the page and try again</li>
          <li>Make sure your microphone is connected and working</li>
        </ul>
      );
    }
    
    if (isCameraError) {
      return (
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Click the lock icon in your browser's address bar</li>
          <li>Find "Camera" and change it to "Allow"</li>
          <li>Refresh the page and try again</li>
          <li>Make sure your camera is connected and not in use by another app</li>
        </ul>
      );
    }

    return (
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>Check your browser permissions in settings</li>
        <li>Make sure no other application is using the required devices</li>
        <li>Try refreshing the page</li>
        <li>If the problem persists, try a different browser</li>
      </ul>
    );
  };

  return (
    <Card className="p-6 bg-card border-destructive/30">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-2">Permission Required</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          
          <div className="mb-6">
            <h3 className="font-medium mb-2">How to fix this:</h3>
            {getHelpText()}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={onRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={onCancel} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>

          {/* Browser Settings Link */}
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Browser Settings</span>
            </div>
            <p className="text-xs text-muted-foreground">
              You can manage site permissions in your browser settings. In Chrome, go to{" "}
              <code className="bg-muted px-1 py-0.5 rounded">chrome://settings/content</code>{" "}
              and find the relevant permission setting.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
