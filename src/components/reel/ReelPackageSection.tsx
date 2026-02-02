/**
 * Reel Package Section
 * 
 * UI section for configuring AI-generated intros/outros/transitions.
 * Designed for the Reel Builder.
 */

import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Film,
  Play,
  Loader2,
  RefreshCw,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useReelPackage } from "@/hooks/useReelPackageConfig";
import { StylePicker } from "./StylePicker";
import { AudioModePicker } from "./AudioModePicker";

interface ReelPackageSectionProps {
  sessionId: string | undefined;
  className?: string;
  defaultExpanded?: boolean;
}

export const ReelPackageSection = memo(function ReelPackageSection({
  sessionId,
  className,
  defaultExpanded = true,
}: ReelPackageSectionProps) {
  const {
    config,
    isLoading,
    setIntroEnabled,
    setOutroEnabled,
    setTransitionsEnabled,
    setStyleKey,
    setAudioMode,
    setStatOverlayEnabled,
    generate,
    regenerate,
    isGenerating,
    canGenerate,
  } = useReelPackage(sessionId);

  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const hasAnyEnabled = 
    config?.enabledIntro || 
    config?.enabledOutro || 
    config?.enabledTransitions;

  const generationStatus = config?.generationStatus || "idle";
  const generationProgress = config?.generationProgress || 0;

  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader 
        className="pb-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Reel Package
            {hasAnyEnabled && (
              <Badge variant="secondary" className="text-[10px] px-1.5">
                Active
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          AI-generated intros, outros, and transitions
        </p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-5 pt-0">
          {/* Feature Toggles */}
          <div className="space-y-3">
            <FeatureToggle
              label="Intro"
              description="5-10s opening sequence"
              checked={config?.enabledIntro ?? false}
              onCheckedChange={setIntroEnabled}
              icon={<Play className="h-3.5 w-3.5" />}
            />
            <FeatureToggle
              label="Outro"
              description="5-10s closing sequence"
              checked={config?.enabledOutro ?? false}
              onCheckedChange={setOutroEnabled}
              icon={<Film className="h-3.5 w-3.5" />}
            />
            <FeatureToggle
              label="Transitions"
              description="Beat-matched clip transitions"
              checked={config?.enabledTransitions ?? false}
              onCheckedChange={setTransitionsEnabled}
              icon={<Sparkles className="h-3.5 w-3.5" />}
            />
          </div>

          {/* Style Picker */}
          {hasAnyEnabled && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Style
                </Label>
                <StylePicker
                  selectedStyle={config?.styleKey ?? "auto"}
                  onStyleChange={setStyleKey}
                />
              </div>

              {/* Audio Mode */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Audio
                </Label>
                <AudioModePicker
                  selectedMode={config?.audioMode ?? "gameAudioOnly"}
                  onModeChange={setAudioMode}
                />
              </div>

              {/* Stats Overlay */}
              <div className="flex items-center justify-between py-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Stats Overlay</Label>
                  <Badge variant="outline" className="text-[9px] px-1">
                    K/D, Damage, etc.
                  </Badge>
                </div>
                <Switch
                  checked={config?.statOverlayEnabled ?? true}
                  onCheckedChange={setStatOverlayEnabled}
                />
              </div>

              {/* Generation Status */}
              {generationStatus !== "idle" && (
                <GenerationStatus
                  status={generationStatus}
                  progress={generationProgress}
                  error={config?.generationError}
                />
              )}

              {/* Generate CTA */}
              <div className="pt-2">
                {generationStatus === "ready" ? (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => regenerate()}
                    disabled={isGenerating}
                  >
                    <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
                    Regenerate Package
                  </Button>
                ) : (
                  <Button
                    className="w-full gap-2"
                    onClick={() => generate()}
                    disabled={!canGenerate || isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Package
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
});

// ============= Sub-components =============

interface FeatureToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon: React.ReactNode;
}

const FeatureToggle = memo(function FeatureToggle({
  label,
  description,
  checked,
  onCheckedChange,
  icon,
}: FeatureToggleProps) {
  return (
    <div 
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
        checked 
          ? "border-primary/30 bg-primary/5" 
          : "border-border/50 hover:border-border"
      )}
      onClick={() => onCheckedChange(!checked)}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center",
          checked ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {icon}
        </div>
        <div>
          <Label className="text-sm font-medium cursor-pointer">{label}</Label>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
});

interface GenerationStatusProps {
  status: string;
  progress: number;
  error?: string;
}

const GenerationStatus = memo(function GenerationStatus({
  status,
  progress,
  error,
}: GenerationStatusProps) {
  if (status === "failed") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">Generation failed</p>
          <p className="text-xs text-muted-foreground truncate">
            {error || "Please try again"}
          </p>
        </div>
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
        <Check className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary">Package ready</p>
          <p className="text-xs text-muted-foreground">
            Preview available below
          </p>
        </div>
      </div>
    );
  }

  // Pending or generating
  return (
    <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          {status === "pending" ? "Queued..." : "Generating..."}
        </span>
        <span className="text-xs text-muted-foreground">{progress}%</span>
      </div>
      <Progress value={progress} className="h-1.5" />
      <p className="text-[10px] text-muted-foreground">
        You can navigate away — we'll notify you when ready
      </p>
    </div>
  );
});

// Need React import for useState
import React from "react";
