import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings2 } from "lucide-react";

export interface SettingsConfig {
  videoQuality: string;
  audioBitrate: string;
  cameraQuality: string;
  pushToTalk: boolean;
  autoStop: boolean;
  monoAudio: boolean;
}

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: SettingsConfig;
  onSave: (config: SettingsConfig) => void;
  disabled?: boolean;
}

export function SettingsModal({
  open,
  onOpenChange,
  config,
  onSave,
  disabled = false,
}: SettingsModalProps) {
  // Local state for editing
  const [videoQuality, setVideoQuality] = useState(config.videoQuality);
  const [audioBitrate, setAudioBitrate] = useState(config.audioBitrate);
  const [cameraQuality, setCameraQuality] = useState(config.cameraQuality);
  const [pushToTalk, setPushToTalk] = useState(config.pushToTalk);
  const [autoStop, setAutoStop] = useState(config.autoStop);
  const [monoAudio, setMonoAudio] = useState(config.monoAudio);

  // Sync local state when modal opens
  useEffect(() => {
    if (open) {
      setVideoQuality(config.videoQuality);
      setAudioBitrate(config.audioBitrate);
      setCameraQuality(config.cameraQuality);
      setPushToTalk(config.pushToTalk);
      setAutoStop(config.autoStop);
      setMonoAudio(config.monoAudio);
    }
  }, [open, config]);

  const handleSave = () => {
    onSave({
      videoQuality,
      audioBitrate,
      cameraQuality,
      pushToTalk,
      autoStop,
      monoAudio,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-md glass-strong p-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-border/30">
          <DialogTitle className="font-display text-lg tracking-wide flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
          {/* Video Quality */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2.5 px-3 bg-muted/10 rounded-lg border border-border/20">
            <div className="min-w-0">
              <p className="text-sm font-medium">Video Quality</p>
              <p className="text-xs text-muted-foreground">Resolution and frame rate</p>
            </div>
            <Select value={videoQuality} onValueChange={setVideoQuality} disabled={disabled}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-[110px] h-8 text-xs bg-background border-border/40 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720p30">720p 30fps</SelectItem>
                <SelectItem value="720p60">720p 60fps</SelectItem>
                <SelectItem value="1080p30">1080p 30fps</SelectItem>
                <SelectItem value="1080p60">1080p 60fps</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Audio Bitrate */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2.5 px-3 bg-muted/10 rounded-lg border border-border/20">
            <div className="min-w-0">
              <p className="text-sm font-medium">Audio Quality</p>
              <p className="text-xs text-muted-foreground">Microphone bitrate</p>
            </div>
            <Select value={audioBitrate} onValueChange={setAudioBitrate} disabled={disabled}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-[90px] h-8 text-xs bg-background border-border/40 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="64">64 kbps</SelectItem>
                <SelectItem value="128">128 kbps</SelectItem>
                <SelectItem value="192">192 kbps</SelectItem>
                <SelectItem value="320">320 kbps</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Camera Quality */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2.5 px-3 bg-muted/10 rounded-lg border border-border/20">
            <div className="min-w-0">
              <p className="text-sm font-medium">Camera Quality</p>
              <p className="text-xs text-muted-foreground">Facecam resolution</p>
            </div>
            <Select value={cameraQuality} onValueChange={setCameraQuality} disabled={disabled}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-[110px] h-8 text-xs bg-background border-border/40 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720p">720p (Standard)</SelectItem>
                <SelectItem value="hd" disabled className="opacity-50">
                  <span className="flex items-center gap-2">
                    HD
                    <span className="text-[10px] text-muted-foreground/70 italic">Soon</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Push-to-talk */}
          <div className="flex items-center justify-between py-2.5 px-3 bg-muted/10 rounded-lg border border-border/20">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Push-to-Talk</p>
              <p className="text-xs text-muted-foreground">Hold key to record voice</p>
            </div>
            <Switch checked={pushToTalk} onCheckedChange={setPushToTalk} disabled={disabled} className="shrink-0" />
          </div>

          {/* Auto-stop on inactivity */}
          <div className="flex items-center justify-between py-2.5 px-3 bg-muted/10 rounded-lg border border-border/20">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Auto-Stop</p>
              <p className="text-xs text-muted-foreground">Stop after 30min inactivity</p>
            </div>
            <Switch checked={autoStop} onCheckedChange={setAutoStop} disabled={disabled} className="shrink-0" />
          </div>

          {/* Mono Audio */}
          <div className="flex items-center justify-between py-2.5 px-3 bg-muted/10 rounded-lg border border-border/20">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Mono Audio</p>
              <p className="text-xs text-muted-foreground">Better for voice clarity</p>
            </div>
            <Switch checked={monoAudio} onCheckedChange={setMonoAudio} disabled={disabled} className="shrink-0" />
          </div>
        </div>

        <DialogFooter className="shrink-0 px-4 sm:px-6 py-3 border-t border-border/30 bg-muted/10">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
