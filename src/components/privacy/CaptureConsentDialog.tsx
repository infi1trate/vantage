import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Monitor,
  Mic,
  Video,
  Volume2,
  Eye,
  Lock,
  Trash2,
  Cloud,
  AlertTriangle,
  Info,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CaptureConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionTitle: string;
  captureConfig: {
    screen: boolean;
    microphone: boolean;
    facecam: boolean;
    systemAudio: boolean;
  };
  onConsent: () => void;
  onDecline: () => void;
}

interface DataItem {
  icon: typeof Monitor;
  label: string;
  description: string;
  enabled: boolean;
  required?: boolean;
}

export function CaptureConsentDialog({
  open,
  onOpenChange,
  sessionTitle,
  captureConfig,
  onConsent,
  onDecline,
}: CaptureConsentDialogProps) {
  const [understood, setUnderstood] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);

  const dataItems: DataItem[] = [
    {
      icon: Monitor,
      label: "Screen Recording",
      description: "Visual capture of your selected window or screen",
      enabled: captureConfig.screen,
      required: true,
    },
    {
      icon: Mic,
      label: "Microphone Audio",
      description: "Your voice for reactions and commentary",
      enabled: captureConfig.microphone,
      required: true,
    },
    {
      icon: Video,
      label: "Facecam Video",
      description: "Webcam footage overlay on gameplay",
      enabled: captureConfig.facecam,
    },
    {
      icon: Volume2,
      label: "System Audio",
      description: "In-game sounds and voice chat",
      enabled: captureConfig.systemAudio,
    },
  ];

  const enabledItems = dataItems.filter((item) => item.enabled);

  const canProceed = understood && privacyAcknowledged;

  const handleConsent = () => {
    if (canProceed) {
      onConsent();
      // Reset for next time
      setUnderstood(false);
      setPrivacyAcknowledged(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline" className="text-xs">
              Privacy First
            </Badge>
          </div>
          <DialogTitle>Before You Record</DialogTitle>
          <DialogDescription>
            Review what will be captured for "{sessionTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* What will be captured */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              What Will Be Captured
            </h4>
            
            <div className="space-y-2">
              {enabledItems.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    item.required
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-muted/30"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 mt-0.5",
                    item.required ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.required && (
                        <Badge variant="secondary" className="text-xs h-5">
                          Required
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  <CheckCircle className="h-4 w-4 text-vantage-success" />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Privacy guarantees */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4 text-vantage-success" />
              Your Privacy Guarantees
            </h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-vantage-success mt-0.5 shrink-0" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">You own your data.</strong> All recordings are stored in your private account.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-vantage-success mt-0.5 shrink-0" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Private by default.</strong> Sessions are only visible to you unless you explicitly share.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-vantage-success mt-0.5 shrink-0" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Permanent deletion.</strong> One-click delete removes all data with no hidden backups.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-vantage-success mt-0.5 shrink-0" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Coach is opt-in.</strong> Coach review only runs after recording, never in real-time.
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Consent checkboxes */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <Checkbox
                id="understood"
                checked={understood}
                onCheckedChange={(checked) => setUnderstood(!!checked)}
                className="mt-0.5"
              />
              <Label htmlFor="understood" className="text-sm cursor-pointer">
                I understand that my <strong>screen, microphone{captureConfig.facecam ? ", and camera" : ""}</strong> will be recorded during this session.
              </Label>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <Checkbox
                id="privacy"
                checked={privacyAcknowledged}
                onCheckedChange={(checked) => setPrivacyAcknowledged(!!checked)}
                className="mt-0.5"
              />
              <Label htmlFor="privacy" className="text-sm cursor-pointer">
                I acknowledge that I can <strong>permanently delete</strong> this session and all associated data at any time.
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onDecline} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={handleConsent}
            disabled={!canProceed}
            className="w-full sm:w-auto"
          >
            <Shield className="h-4 w-4 mr-2" />
            I Consent - Start Recording
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
