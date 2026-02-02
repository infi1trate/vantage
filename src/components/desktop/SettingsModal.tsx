/**
 * SettingsModal (Desktop Popover)
 * 
 * Settings modal for configuring recording defaults.
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOCK_MICS, CaptureSourceType } from "./types";

type RecordingLimit = "5" | "10" | "30";

interface SettingsConfig {
  recordingLimit: RecordingLimit;
  defaultSource: CaptureSourceType;
  defaultMicId: string;
  openEditorAfter: boolean;
  forceUploadError: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  forceUploadError: boolean;
  onForceUploadErrorChange: (value: boolean) => void;
}

const DEFAULT_CONFIG: SettingsConfig = {
  recordingLimit: "5",
  defaultSource: "screen",
  defaultMicId: "mic1",
  openEditorAfter: true,
  forceUploadError: false,
};

export function SettingsModal({ 
  isOpen, 
  onClose,
  forceUploadError,
  onForceUploadErrorChange,
}: SettingsModalProps) {
  const [config, setConfig] = useState<SettingsConfig>({
    ...DEFAULT_CONFIG,
    forceUploadError,
  });

  // Sync external forceUploadError state
  useEffect(() => {
    setConfig(prev => ({ ...prev, forceUploadError }));
  }, [forceUploadError]);

  // Reset to defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      // In a real app, load from persisted settings
      setConfig(prev => ({ ...DEFAULT_CONFIG, forceUploadError: prev.forceUploadError }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-xl rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Settings
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 px-3 text-xs font-medium text-vantage-green hover:bg-vantage-green/10"
        >
          Done
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Recording Limit */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recording limit
          </Label>
          <Select
            value={config.recordingLimit}
            onValueChange={(v) => setConfig({ ...config, recordingLimit: v as RecordingLimit })}
          >
            <SelectTrigger className="w-full h-10 bg-white/5 border-white/10 focus:border-vantage-green/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background/95 backdrop-blur-xl border-white/10">
              <SelectItem value="5">5 minutes</SelectItem>
              <SelectItem value="10">10 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Default Source */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Default source
          </Label>
          <Select
            value={config.defaultSource}
            onValueChange={(v) => setConfig({ ...config, defaultSource: v as CaptureSourceType })}
          >
            <SelectTrigger className="w-full h-10 bg-white/5 border-white/10 focus:border-vantage-green/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background/95 backdrop-blur-xl border-white/10">
              <SelectItem value="screen">Full screen</SelectItem>
              <SelectItem value="window">Specific window</SelectItem>
              <SelectItem value="camera">Camera only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Default Mic */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Default microphone
          </Label>
          <Select
            value={config.defaultMicId}
            onValueChange={(v) => setConfig({ ...config, defaultMicId: v })}
          >
            <SelectTrigger className="w-full h-10 bg-white/5 border-white/10 focus:border-vantage-green/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background/95 backdrop-blur-xl border-white/10">
              {MOCK_MICS.map((mic) => (
                <SelectItem key={mic.id} value={mic.id}>
                  {mic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-px bg-white/10" />

        {/* Open Editor After Toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <Label className="text-sm font-medium cursor-pointer">
              Open editor after recording
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically open the session editor when recording ends
            </p>
          </div>
          <Switch
            checked={config.openEditorAfter}
            onCheckedChange={(checked) => setConfig({ ...config, openEditorAfter: checked })}
          />
        </div>

        <div className="h-px bg-white/10" />

        {/* Developer/Debug Section */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Developer
          </Label>
          
          {/* Force Upload Error Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="text-sm font-medium cursor-pointer">
                Force upload error
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Simulate upload failure for testing
              </p>
            </div>
            <Switch
              checked={config.forceUploadError}
              onCheckedChange={(checked) => {
                setConfig({ ...config, forceUploadError: checked });
                onForceUploadErrorChange(checked);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
