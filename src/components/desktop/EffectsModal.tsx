/**
 * EffectsModal
 * 
 * Modal for configuring camera frame, background, and audio effects.
 * Opens from the Effects footer tab.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { X, Circle, Square, RectangleHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type CameraFrameShape = "circle" | "rounded" | "square";

interface EffectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameraEnabled: boolean;
}

export function EffectsModal({
  isOpen,
  onClose,
  cameraEnabled,
}: EffectsModalProps) {
  // Local state for effects (stub - no real processing)
  const [frameShape, setFrameShape] = useState<CameraFrameShape>("circle");
  const [blurBackground, setBlurBackground] = useState(false);
  const [aiBackground, setAiBackground] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [micPriority, setMicPriority] = useState([50]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-xl rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Effects
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        
        {/* Camera Frame Section - only if camera is on */}
        {cameraEnabled && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Camera Frame
            </h3>
            
            <RadioGroup
              value={frameShape}
              onValueChange={(v) => setFrameShape(v as CameraFrameShape)}
              className="flex gap-2"
            >
              {/* Circle */}
              <label
                className={cn(
                  "flex-1 flex flex-col items-center gap-2 p-3 rounded-xl cursor-pointer",
                  "border-2 transition-all duration-150",
                  frameShape === "circle"
                    ? "border-vantage-green bg-vantage-green/10"
                    : "border-white/10 hover:border-white/20"
                )}
              >
                <RadioGroupItem value="circle" className="sr-only" />
                <div className="w-10 h-10 rounded-full bg-white/10 border-2 border-current flex items-center justify-center">
                  <Circle className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-medium">
                  Circle
                </span>
              </label>

              {/* Rounded Square */}
              <label
                className={cn(
                  "flex-1 flex flex-col items-center gap-2 p-3 rounded-xl cursor-pointer",
                  "border-2 transition-all duration-150",
                  frameShape === "rounded"
                    ? "border-vantage-green bg-vantage-green/10"
                    : "border-white/10 hover:border-white/20"
                )}
              >
                <RadioGroupItem value="rounded" className="sr-only" />
                <div className="w-10 h-10 rounded-lg bg-white/10 border-2 border-current flex items-center justify-center">
                  <RectangleHorizontal className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-medium">
                  Rounded
                </span>
              </label>

              {/* Square */}
              <label
                className={cn(
                  "flex-1 flex flex-col items-center gap-2 p-3 rounded-xl cursor-pointer",
                  "border-2 transition-all duration-150",
                  frameShape === "square"
                    ? "border-vantage-green bg-vantage-green/10"
                    : "border-white/10 hover:border-white/20"
                )}
              >
                <RadioGroupItem value="square" className="sr-only" />
                <div className="w-10 h-10 rounded-none bg-white/10 border-2 border-current flex items-center justify-center">
                  <Square className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-medium">
                  Square
                </span>
              </label>
            </RadioGroup>
          </section>
        )}

        {/* Background Section - only if camera is on */}
        {cameraEnabled && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Background
            </h3>
            
            <div className="space-y-3">
              {/* Blur background toggle */}
              <div className="flex items-center justify-between py-2">
                <Label htmlFor="blur-bg" className="text-sm font-medium cursor-pointer">
                  Blur background
                </Label>
                <Switch
                  id="blur-bg"
                  checked={blurBackground}
                  onCheckedChange={(checked) => {
                    setBlurBackground(checked);
                    if (checked) setAiBackground(false);
                  }}
                />
              </div>

              {/* AI background toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-vantage-green" />
                    <Label htmlFor="ai-bg" className="text-sm font-medium cursor-pointer">
                      AI background
                    </Label>
                  </div>
                  <Switch
                    id="ai-bg"
                    checked={aiBackground}
                    onCheckedChange={(checked) => {
                      setAiBackground(checked);
                      if (checked) setBlurBackground(false);
                    }}
                  />
                </div>

                {/* AI prompt input - only shown when AI background is on */}
                {aiBackground && (
                  <div className="space-y-1.5 pl-6">
                    <Input
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g. soft neon studio"
                      className={cn(
                        "h-9 text-sm bg-white/5 border-white/10",
                        "placeholder:text-muted-foreground/50",
                        "focus:border-vantage-green/50 focus:ring-vantage-green/20"
                      )}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      We'll auto-optimize for a subtle background.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Divider if camera sections exist */}
        {cameraEnabled && <div className="h-px bg-white/10" />}

        {/* Audio Mix Section - always visible */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Audio Mix
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Mic priority</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {micPriority[0]}%
              </span>
            </div>
            <Slider
              value={micPriority}
              onValueChange={setMicPriority}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Game audio</span>
              <span>Voice priority</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
