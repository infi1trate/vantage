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
import { Settings2, Video, Mic, Volume2, Camera, FlipHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SettingsConfig {
  videoQuality: string;
  cameraQuality: string;
  flipCamera: boolean;
  audioBitrate: string;
  systemAudio: boolean;
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
  const [cameraQuality, setCameraQuality] = useState(config.cameraQuality);
  const [flipCamera, setFlipCamera] = useState(config.flipCamera);
  const [audioBitrate, setAudioBitrate] = useState(config.audioBitrate);
  const [systemAudio, setSystemAudio] = useState(config.systemAudio);
  const [pushToTalk, setPushToTalk] = useState(config.pushToTalk);
  const [autoStop, setAutoStop] = useState(config.autoStop);
  const [monoAudio, setMonoAudio] = useState(config.monoAudio);

  // Sync local state when modal opens
  useEffect(() => {
    if (open) {
      setVideoQuality(config.videoQuality);
      setCameraQuality(config.cameraQuality);
      setFlipCamera(config.flipCamera);
      setAudioBitrate(config.audioBitrate);
      setSystemAudio(config.systemAudio);
      setPushToTalk(config.pushToTalk);
      setAutoStop(config.autoStop);
      setMonoAudio(config.monoAudio);
    }
  }, [open, config]);

  const handleSave = () => {
    onSave({
      videoQuality,
      cameraQuality,
      flipCamera,
      audioBitrate,
      systemAudio,
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

        <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4 space-y-4">
          {/* Recording Quality Section */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Video className="h-3.5 w-3.5" />
              Recording Quality
            </p>
            
            {/* Video Quality */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 px-4 bg-muted/10 rounded-xl border border-border/20">
              <div className="min-w-0">
                <p className="text-sm font-medium">Video Quality</p>
                <p className="text-xs text-muted-foreground">Resolution and frame rate</p>
              </div>
              <Select value={videoQuality} onValueChange={setVideoQuality} disabled={disabled}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[120px] h-9 text-sm bg-background border-border/40 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="720p30">720p 30fps</SelectItem>
                  <SelectItem value="720p60">720p 60fps</SelectItem>
                  <SelectItem value="1080p30">1080p 30fps</SelectItem>
                  <SelectItem value="1080p60">1080p 60fps</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Camera Quality */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 px-4 bg-muted/10 rounded-xl border border-border/20">
              <div className="min-w-0 flex items-start gap-3">
                <div className="p-2 rounded-md bg-muted/30 mt-0.5">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Camera Quality</p>
                  <p className="text-xs text-muted-foreground">Facecam resolution</p>
                </div>
              </div>
              <Select value={cameraQuality} onValueChange={setCameraQuality} disabled={disabled}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[130px] h-9 text-sm bg-background border-border/40 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="hd" disabled className="opacity-50">
                    <span className="flex items-center gap-2">
                      HD
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Coming soon
                      </span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Flip Camera */}
            <div className="flex items-center justify-between py-3 px-4 bg-muted/10 rounded-xl border border-border/20 group">
              <div className="min-w-0 flex-1 flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-md transition-all duration-150 mt-0.5",
                  flipCamera ? "bg-primary/15" : "bg-muted/30"
                )}>
                  <FlipHorizontal className={cn(
                    "h-4 w-4 transition-colors duration-150",
                    flipCamera ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="text-sm font-medium">Flip Camera</p>
                  <p className="text-xs text-muted-foreground">Mirror facecam preview</p>
                </div>
              </div>
              <Switch 
                checked={flipCamera} 
                onCheckedChange={setFlipCamera} 
                disabled={disabled} 
                className="shrink-0 transition-transform duration-100 active:scale-95" 
              />
            </div>

            {/* Auto-stop on inactivity */}
            <div className="flex items-center justify-between py-3 px-4 bg-muted/10 rounded-xl border border-border/20">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Auto-Stop</p>
                <p className="text-xs text-muted-foreground">Stop after 30 min inactivity</p>
              </div>
              <Switch 
                checked={autoStop} 
                onCheckedChange={setAutoStop} 
                disabled={disabled} 
                className="shrink-0 transition-transform duration-100 active:scale-95" 
              />
            </div>
          </div>

          {/* Audio Section */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Mic className="h-3.5 w-3.5" />
              Audio
            </p>

            {/* Audio Bitrate */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 px-4 bg-muted/10 rounded-xl border border-border/20">
              <div className="min-w-0">
                <p className="text-sm font-medium">Microphone Quality</p>
                <p className="text-xs text-muted-foreground">Audio bitrate</p>
              </div>
              <Select value={audioBitrate} onValueChange={setAudioBitrate} disabled={disabled}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[100px] h-9 text-sm bg-background border-border/40 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="64">64 kbps</SelectItem>
                  <SelectItem value="128">128 kbps</SelectItem>
                  <SelectItem value="192">192 kbps</SelectItem>
                  <SelectItem value="320">320 kbps</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* System Audio */}
            <div className="flex items-center justify-between py-3 px-4 bg-muted/10 rounded-xl border border-border/20">
              <div className="min-w-0 flex-1 flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-md transition-all duration-150 mt-0.5",
                  systemAudio ? "bg-primary/15" : "bg-muted/30"
                )}>
                  <Volume2 className={cn(
                    "h-4 w-4 transition-colors duration-150",
                    systemAudio ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="text-sm font-medium">Record System Audio</p>
                  <p className="text-xs text-muted-foreground">Capture game and desktop sounds</p>
                </div>
              </div>
              <Switch 
                checked={systemAudio} 
                onCheckedChange={setSystemAudio} 
                disabled={disabled} 
                className="shrink-0 transition-transform duration-100 active:scale-95" 
              />
            </div>

            {/* Push-to-talk */}
            <div className="flex items-center justify-between py-3 px-4 bg-muted/10 rounded-xl border border-border/20">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Push-to-Talk</p>
                <p className="text-xs text-muted-foreground">Hold key to record voice</p>
              </div>
              <Switch 
                checked={pushToTalk} 
                onCheckedChange={setPushToTalk} 
                disabled={disabled} 
                className="shrink-0 transition-transform duration-100 active:scale-95" 
              />
            </div>

            {/* Mono Audio */}
            <div className="flex items-center justify-between py-3 px-4 bg-muted/10 rounded-xl border border-border/20">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Mono Audio</p>
                <p className="text-xs text-muted-foreground">Recommended for voice clarity</p>
              </div>
              <Switch 
                checked={monoAudio} 
                onCheckedChange={setMonoAudio} 
                disabled={disabled} 
                className="shrink-0 transition-transform duration-100 active:scale-95" 
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 px-4 sm:px-6 py-3 border-t border-border/30 bg-muted/10">
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full sm:w-auto">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSave} className="w-full sm:w-auto">
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
