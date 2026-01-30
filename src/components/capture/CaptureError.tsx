import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft, 
  Settings, 
  ShieldAlert,
  Mic,
  Video,
  MonitorX,
  AlertTriangle
} from "lucide-react";
import { type CaptureError, getCaptureErrorInfo } from "@/lib/captureErrors";

interface CaptureErrorProps {
  error: CaptureError;
  onRetry: () => void;
  onCancel: () => void;
}

export function CaptureErrorDisplay({ error, onRetry, onCancel }: CaptureErrorProps) {
  const info = getCaptureErrorInfo(error);

  const getIcon = () => {
    switch (info.icon) {
      case "permission":
        return <ShieldAlert className="h-6 w-6 text-warning" />;
      case "device":
        return <Mic className="h-6 w-6 text-destructive" />;
      case "security":
        return <ShieldAlert className="h-6 w-6 text-destructive" />;
      case "recording":
        return <MonitorX className="h-6 w-6 text-destructive" />;
      case "error":
      default:
        return <AlertCircle className="h-6 w-6 text-destructive" />;
    }
  };

  const getBorderColor = () => {
    switch (info.icon) {
      case "permission":
        return "border-warning/30";
      case "security":
        return "border-destructive/30";
      default:
        return "border-destructive/30";
    }
  };

  const getIconBgColor = () => {
    switch (info.icon) {
      case "permission":
        return "bg-warning/10";
      default:
        return "bg-destructive/10";
    }
  };

  return (
    <Card className={`p-6 bg-card ${getBorderColor()}`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-full ${getIconBgColor()}`}>
          {getIcon()}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-2">{info.title}</h2>
          <p className="text-muted-foreground mb-4">{info.description}</p>
          
          {error.details && (
            <div className="mb-4 p-2 bg-muted/30 rounded text-xs text-muted-foreground font-mono">
              {error.details}
            </div>
          )}
          
          <div className="mb-6">
            <h3 className="font-medium mb-2">How to fix this:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {info.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-3">
            {info.primaryAction === "retry" && (
              <Button onClick={onRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                {info.primaryActionLabel || "Try Again"}
              </Button>
            )}
            {info.primaryAction === "refresh" && (
              <Button onClick={() => window.location.reload()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                {info.primaryActionLabel || "Refresh Page"}
              </Button>
            )}
            <Button variant="outline" onClick={onCancel} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>

          {/* Browser Settings Link */}
          {info.showBrowserSettings && (
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
          )}

          {/* Show error code for debugging */}
          {!error.recoverable && (
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3" />
              <span>Error code: {error.code}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
