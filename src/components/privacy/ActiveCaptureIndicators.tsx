import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Monitor, Mic, Video, Volume2, MicOff, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveCaptureIndicatorsProps {
  isRecording: boolean;
  isPaused: boolean;
  captureConfig: {
    screen: boolean;
    microphone: boolean;
    facecam: boolean;
    systemAudio: boolean;
  };
  microphoneLevel?: number;
  className?: string;
}

export function ActiveCaptureIndicators({
  isRecording,
  isPaused,
  captureConfig,
  microphoneLevel = 0,
  className,
}: ActiveCaptureIndicatorsProps) {
  if (!isRecording) return null;

  const indicators = [
    {
      key: "screen",
      enabled: captureConfig.screen,
      icon: Monitor,
      label: "Screen",
      description: "Your screen is being recorded",
      alwaysOn: true,
    },
    {
      key: "microphone",
      enabled: captureConfig.microphone,
      icon: Mic,
      offIcon: MicOff,
      label: "Mic",
      description: "Your microphone is active",
      hasLevel: true,
    },
    {
      key: "facecam",
      enabled: captureConfig.facecam,
      icon: Video,
      offIcon: VideoOff,
      label: "Camera",
      description: "Your webcam is recording",
    },
    {
      key: "systemAudio",
      enabled: captureConfig.systemAudio,
      icon: Volume2,
      label: "Audio",
      description: "System audio is being captured",
    },
  ];

  const enabledIndicators = indicators.filter((i) => i.enabled);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Recording status badge */}
      <Badge
        variant="outline"
        className={cn(
          "gap-1.5 font-mono text-xs",
          isPaused
            ? "border-vantage-warning/50 text-vantage-warning bg-vantage-warning/10"
            : "border-destructive/50 text-destructive bg-destructive/10"
        )}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            isPaused ? "bg-vantage-warning" : "bg-destructive recording-pulse"
          )}
        />
        {isPaused ? "PAUSED" : "LIVE"}
      </Badge>

      {/* Individual capture indicators */}
      {enabledIndicators.map((indicator) => {
        const Icon = indicator.icon;

        return (
          <Tooltip key={indicator.key}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "relative flex items-center justify-center w-8 h-8 rounded-lg border transition-colors",
                  isPaused
                    ? "border-muted-foreground/30 bg-muted/50"
                    : "border-primary/30 bg-primary/10"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isPaused ? "text-muted-foreground" : "text-primary"
                  )}
                />

                {/* Microphone level indicator - live voice feedback */}
                {indicator.hasLevel && !isPaused && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-primary/50 rounded-b-lg"
                    style={{
                      height: `${Math.min(microphoneLevel * 100, 100)}%`,
                      transition: 'height 50ms ease-out',
                    }}
                  />
                )}

                {/* Active dot */}
                {!isPaused && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-vantage-success rounded-full" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="font-medium">{indicator.label}</p>
              <p className="text-xs text-muted-foreground">
                {isPaused ? "Paused" : indicator.description}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
