/**
 * Capture Tips Modal
 * 
 * Displays helpful tips for avoiding capture interruptions.
 * Shown when user clicks "How to avoid this" in the missing video state.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  MonitorPlay, 
  Wifi, 
  HardDrive, 
  Shield, 
  Lightbulb,
  CheckCircle2,
} from "lucide-react";

interface CaptureTipsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CAPTURE_TIPS = [
  {
    icon: MonitorPlay,
    title: "Keep the tab active",
    description: "Chrome may pause recordings in background tabs. Keep Vantage visible or in a separate window.",
  },
  {
    icon: Shield,
    title: "Grant permissions upfront",
    description: "Allow screen, camera, and microphone access when prompted. Denied permissions can stop a capture.",
  },
  {
    icon: HardDrive,
    title: "Check storage space",
    description: "Recordings need disk space. Make sure you have at least 2GB free before long sessions.",
  },
  {
    icon: Wifi,
    title: "Stay connected",
    description: "While recording works offline, a stable connection helps when saving and syncing your session.",
  },
];

export function CaptureTipsModal({ open, onOpenChange }: CaptureTipsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Tips for reliable captures</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            A few quick things to check before your next session.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {CAPTURE_TIPS.map((tip, index) => (
            <div 
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
            >
              <div className="p-1.5 rounded-md bg-background border border-border/50 shrink-0">
                <tip.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{tip.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {tip.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-vantage-success" />
            Following these helps prevent interruptions
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
