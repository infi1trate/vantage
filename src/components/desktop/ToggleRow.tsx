/**
 * ToggleRow
 * 
 * A row with toggle switch and optional device selector.
 * Used for mic/camera on/off with device selection.
 */

import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mic, MicOff, Video, VideoOff, ChevronDown } from "lucide-react";
import { AudioDevice, VideoDevice } from "./types";

interface ToggleRowProps {
  type: "mic" | "camera";
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  devices: (AudioDevice | VideoDevice)[];
  selectedDeviceId: string | null;
  onDeviceChange: (deviceId: string) => void;
  helperText?: string;
}

export function ToggleRow({
  type,
  enabled,
  onToggle,
  devices,
  selectedDeviceId,
  onDeviceChange,
  helperText,
}: ToggleRowProps) {
  const isMic = type === "mic";
  const Icon = isMic 
    ? (enabled ? Mic : MicOff) 
    : (enabled ? Video : VideoOff);
  
  const label = isMic ? "Microphone" : "Camera";
  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={cn(
          "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
          "bg-white/5",
          enabled && "bg-vantage-green/20"
        )}>
          <Icon className={cn(
            "w-5 h-5",
            enabled ? "text-vantage-green" : "text-muted-foreground"
          )} />
        </div>

        {/* Label & device selector */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "text-sm font-medium",
              enabled ? "text-foreground" : "text-muted-foreground"
            )}>
              {label}
            </span>
            
            <Switch
              checked={enabled}
              onCheckedChange={onToggle}
              className="data-[state=checked]:bg-vantage-green"
            />
          </div>

          {/* Device selector (only when enabled) */}
          {enabled && devices.length > 0 && (
            <Select value={selectedDeviceId || undefined} onValueChange={onDeviceChange}>
              <SelectTrigger 
                className={cn(
                  "h-7 mt-1.5 text-xs",
                  "bg-white/5 border-white/10",
                  "hover:bg-white/10",
                  "focus:ring-1 focus:ring-vantage-green/50"
                )}
              >
                <SelectValue placeholder="Select device">
                  <span className="truncate">{selectedDevice?.name || "Select device"}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background/95 backdrop-blur-xl border-white/10">
                {devices.map((device) => (
                  <SelectItem 
                    key={device.id} 
                    value={device.id}
                    className="text-xs focus:bg-vantage-green/20 focus:text-foreground"
                  >
                    <span className="flex items-center gap-2">
                      {device.name}
                      {device.isDefault && (
                        <span className="text-[10px] text-muted-foreground">(Default)</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Helper text */}
      {helperText && enabled && (
        <p className="text-xs text-muted-foreground pl-12">
          {helperText}
        </p>
      )}
    </div>
  );
}
