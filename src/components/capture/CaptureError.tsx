import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft, 
  Settings, 
  ShieldAlert,
  Mic,
  Video,
  MonitorX,
  AlertTriangle,
  Chrome,
  ExternalLink,
  Eye,
  Copy,
  Check,
} from "lucide-react";
import { type CaptureError, getCaptureErrorInfo } from "@/lib/captureErrors";

interface CaptureErrorProps {
  error: CaptureError;
  onRetry: () => void;
  onCancel: () => void;
  /** Whether preview mode is available as fallback */
  canPreview?: boolean;
  /** Callback when user wants to continue in preview mode */
  onPreviewMode?: () => void;
}

export function CaptureErrorDisplay({ 
  error, 
  onRetry, 
  onCancel, 
  canPreview = false,
  onPreviewMode,
}: CaptureErrorProps) {
  const [copied, setCopied] = useState(false);
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

  // Build diagnostics text for clipboard
  const getDiagnosticsText = () => {
    const lines = [
      "=== Capture Error Diagnostics ===",
      `Error Code: ${error.code}`,
      `Error Message: ${error.message}`,
      error.details ? `Details: ${error.details}` : null,
      "",
      "=== Browser Info ===",
      `User Agent: ${navigator.userAgent}`,
      `Platform: ${navigator.platform}`,
      `Secure Context: ${window.isSecureContext}`,
      `Media Devices: ${!!navigator.mediaDevices}`,
      `getDisplayMedia: ${!!navigator.mediaDevices?.getDisplayMedia}`,
      `MediaRecorder: ${typeof MediaRecorder !== "undefined"}`,
      "",
      "=== MIME Support ===",
    ];

    const mimeTypes = [
      "video/mp4;codecs=h264,aac",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    
    if (typeof MediaRecorder !== "undefined") {
      mimeTypes.forEach((type) => {
        const isSupported = MediaRecorder.isTypeSupported(type);
        lines.push(`${type}: ${isSupported ? "yes" : "no"}`);
      });
    } else {
      lines.push("MediaRecorder not available");
    }

    lines.push("");
    lines.push(`Date: ${new Date().toISOString()}`);

    return lines.filter(Boolean).join("\n");
  };

  const handleCopyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(getDiagnosticsText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy diagnostics:", err);
    }
  };

  // Check if this is a capability/format error vs permission error
  const isCapabilityError = error.code === "NO_COMPATIBLE_FORMAT" || 
                            error.code === "RECORDER_UNSUPPORTED" ||
                            error.code === "INSECURE_CONTEXT";

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

          {/* Primary actions */}
          <div className="flex flex-wrap items-center gap-3">
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

          {/* Capability error specific actions */}
          {isCapabilityError && (
            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Download Diagnostics */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyDiagnostics}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Diagnostics
                    </>
                  )}
                </Button>

                {/* Open in Chrome */}
                {info.showOpenInChrome && (
                  <a
                    href="https://www.google.com/chrome/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-2">
                      <Chrome className="h-4 w-4" />
                      Get Chrome
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                )}

                {/* Preview Mode */}
                {info.showPreviewMode && canPreview && onPreviewMode && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onPreviewMode}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Continue in Preview Mode
                    <Badge variant="outline" className="text-[9px] ml-1">No Recording</Badge>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Browser Settings Link - only for permission errors */}
          {info.showBrowserSettings && !isCapabilityError && (
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
