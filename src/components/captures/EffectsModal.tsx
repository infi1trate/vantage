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
import { Input } from "@/components/ui/input";
import {
  Check,
  Camera,
  Circle,
  Square,
  ImagePlus,
  X,
  FlipHorizontal,
  Sparkles,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  FacecamPreview, 
  BACKGROUND_COLORS, 
  type FrameShape, 
  type CameraSize, 
  type BackgroundColorId 
} from "@/components/capture/FacecamPreview";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface EffectsConfig {
  includeFacecam: boolean;
  frameShape: FrameShape;
  cameraSize: CameraSize;
  backgroundColor: BackgroundColorId;
  backgroundImage: string | null;
  flipCamera: boolean;
  aiBackgroundPrompt?: string | null; // Persists the prompt used to generate AI background
}

interface EffectsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: EffectsConfig;
  onSave: (config: EffectsConfig) => void;
  disabled?: boolean;
}

export function EffectsModal({ 
  open, 
  onOpenChange, 
  config, 
  onSave,
  disabled = false 
}: EffectsModalProps) {
  // Local state for editing
  const [includeFacecam, setIncludeFacecam] = useState(config.includeFacecam);
  const [frameShape, setFrameShape] = useState<FrameShape>(config.frameShape);
  const [cameraSize, setCameraSize] = useState<CameraSize>(config.cameraSize);
  const [backgroundColor, setBackgroundColor] = useState<BackgroundColorId>(config.backgroundColor);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(config.backgroundImage);
  const [flipCamera, setFlipCamera] = useState(config.flipCamera);
  
  // AI Background state - persisted prompt and UI state
  const [aiExpanded, setAiExpanded] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(config.aiBackgroundPrompt || "");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [savedAiPrompt, setSavedAiPrompt] = useState<string | null>(config.aiBackgroundPrompt || null);

  // Sync local state when modal opens
  useEffect(() => {
    if (open) {
      setIncludeFacecam(config.includeFacecam);
      setFrameShape(config.frameShape);
      setCameraSize(config.cameraSize);
      setBackgroundColor(config.backgroundColor);
      setBackgroundImage(config.backgroundImage);
      setFlipCamera(config.flipCamera);
      // Restore AI prompt if we have a saved one
      setAiPrompt(config.aiBackgroundPrompt || "");
      setSavedAiPrompt(config.aiBackgroundPrompt || null);
      // Auto-expand if we have a saved AI prompt
      setAiExpanded(!!config.aiBackgroundPrompt);
    }
  }, [open, config]);

  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/") || !["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setBackgroundImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiGenerating) return;
    
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-background", {
        body: { prompt: aiPrompt.trim() },
      });
      
      if (error) throw error;
      
      if (data?.imageUrl) {
        // AI backgrounds use identical pipeline as uploaded images:
        // → backgroundImage prop → useBackgroundRemoval hook → same compositing
        // Subject segmentation, alpha matte, and frame clipping all apply automatically
        setBackgroundImage(data.imageUrl);
        // Save the prompt for persistence and regeneration
        setSavedAiPrompt(aiPrompt.trim());
        setAiExpanded(false);
        toast({
          title: "Background generated",
          description: "AI background applied to your preview",
        });
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error("AI background generation error:", err);
      toast({
        title: "Generation failed",
        description: err.message || "Could not generate background. Try again.",
        variant: "destructive",
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSave = () => {
    onSave({
      includeFacecam,
      frameShape,
      cameraSize,
      backgroundColor,
      backgroundImage,
      flipCamera,
      aiBackgroundPrompt: savedAiPrompt, // Persist AI prompt for session
    });
    onOpenChange(false);
  };
  
  // Handle regeneration with same prompt
  const handleRegenerate = () => {
    if (savedAiPrompt) {
      setAiPrompt(savedAiPrompt);
      handleAiGenerate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-md md:max-w-2xl lg:max-w-3xl glass-strong p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-border/30">
          <DialogTitle className="font-display text-lg tracking-wide flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Effects
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Two-column layout on md+, single column on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/30 h-full">
            {/* Left: Live Camera Preview */}
            <div className="p-4 sm:p-6 flex flex-col items-center justify-center bg-muted/5 order-2 md:order-1">
              <div className="w-full max-w-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70 mb-4 text-center md:text-left">
                  Live Preview
                </p>
                <FacecamPreview 
                  enabled={includeFacecam} 
                  frameShape={frameShape} 
                  cameraSize={cameraSize} 
                  backgroundColor={backgroundColor}
                  backgroundImage={backgroundImage}
                  flipCamera={flipCamera}
                  isGeneratingBackground={aiGenerating}
                />
                {!includeFacecam && (
                  <p className="text-xs text-muted-foreground/60 text-center mt-3">
                    Enable facecam to see preview
                  </p>
                )}
              </div>
            </div>

            {/* Right: Controls */}
            <div className="p-4 sm:p-6 space-y-5 order-1 md:order-2">
              {/* Facecam Toggle */}
              <div className="flex items-center justify-between py-3 px-4 bg-muted/10 rounded-lg border border-border/20">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-md transition-colors",
                    includeFacecam ? "bg-primary/15" : "bg-muted/30"
                  )}>
                    <Camera className={cn(
                      "h-4 w-4 transition-colors",
                      includeFacecam ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Facecam</p>
                    <p className="text-xs text-muted-foreground">Picture-in-picture overlay</p>
                  </div>
                </div>
                <Switch 
                  checked={includeFacecam} 
                  onCheckedChange={setIncludeFacecam} 
                  disabled={disabled} 
                />
              </div>

              {includeFacecam && (
                <div className="space-y-5">
                  {/* Frame Shape Selector */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Camera Frame Shape
                    </p>
                    <div className="flex gap-3">
                      {/* Circle Option */}
                      <button
                        type="button"
                        onClick={() => setFrameShape("circle")}
                        className={cn(
                          "group flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150",
                          "hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]",
                          frameShape === "circle"
                            ? "border-vantage-500 bg-vantage-500/10 shadow-[0_0_16px_-4px_hsl(65_70%_45%/0.5)]"
                            : "border-border/40 bg-muted/20 hover:border-vantage-500/50 hover:bg-muted/30"
                        )}
                        disabled={disabled}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-150",
                          frameShape === "circle"
                            ? "border-vantage-500 bg-vantage-500/20"
                            : "border-muted-foreground/30 bg-muted/30 group-hover:border-vantage-500/40"
                        )}>
                          <Circle 
                            className={cn(
                              "h-6 w-6 transition-colors",
                              frameShape === "circle" ? "text-vantage-500" : "text-muted-foreground/60 group-hover:text-vantage-500/60"
                            )} 
                          />
                        </div>
                        <span className={cn(
                          "text-xs font-medium transition-colors",
                          frameShape === "circle" ? "text-vantage-500" : "text-muted-foreground group-hover:text-foreground"
                        )}>
                          Circle
                        </span>
                      </button>

                      {/* Rounded Square Option */}
                      <button
                        type="button"
                        onClick={() => setFrameShape("rounded-square")}
                        className={cn(
                          "group flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150",
                          "hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]",
                          frameShape === "rounded-square"
                            ? "border-vantage-500 bg-vantage-500/10 shadow-[0_0_16px_-4px_hsl(65_70%_45%/0.5)]"
                            : "border-border/40 bg-muted/20 hover:border-vantage-500/50 hover:bg-muted/30"
                        )}
                        disabled={disabled}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-150",
                          frameShape === "rounded-square"
                            ? "border-vantage-500 bg-vantage-500/20"
                            : "border-muted-foreground/30 bg-muted/30 group-hover:border-vantage-500/40"
                        )}>
                          <Square 
                            className={cn(
                              "h-5 w-5 rounded transition-colors",
                              frameShape === "rounded-square" ? "text-vantage-500" : "text-muted-foreground/60 group-hover:text-vantage-500/60"
                            )} 
                          />
                        </div>
                        <span className={cn(
                          "text-xs font-medium transition-colors",
                          frameShape === "rounded-square" ? "text-vantage-500" : "text-muted-foreground group-hover:text-foreground"
                        )}>
                          Rounded
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Camera Size Selector */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Size</p>
                    <div className="inline-flex rounded-lg border border-border/40 p-0.5 bg-muted/10">
                      <button
                        type="button"
                        onClick={() => setCameraSize("small")}
                        className={cn(
                          "px-5 py-2 text-sm font-medium rounded-md transition-all duration-150 active:scale-95",
                          cameraSize === "small"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        )}
                        disabled={disabled}
                      >
                        Small
                      </button>
                      <button
                        type="button"
                        onClick={() => setCameraSize("large")}
                        className={cn(
                          "px-5 py-2 text-sm font-medium rounded-md transition-all duration-150 active:scale-95",
                          cameraSize === "large"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        )}
                        disabled={disabled}
                      >
                        Large
                      </button>
                    </div>
                  </div>

                  {/* Background Replace */}
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Background Replace
                        </p>
                        {backgroundImage && (
                          <span className="text-xs text-vantage-500/80 font-medium">
                            Image active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/60">
                        Replace your background with a color or image
                      </p>
                    </div>
                    
                    {/* Color Swatches - 12 preset colors in 6x2 grid */}
                    <div className="grid grid-cols-6 gap-2">
                      {BACKGROUND_COLORS.map((color) => (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() => {
                            setBackgroundColor(color.id);
                            // Clear image when selecting a color
                            if (backgroundImage) setBackgroundImage(null);
                          }}
                          className={cn(
                            "relative w-full aspect-square rounded-lg transition-all duration-150",
                            "hover:scale-110 hover:ring-2 hover:ring-vantage-500/40 hover:z-10 active:scale-100",
                            // Checkerboard pattern for transparent
                            color.id === "transparent" && "bg-[conic-gradient(from_45deg,hsl(var(--muted))_25%,hsl(var(--muted-foreground)/0.15)_25%,hsl(var(--muted-foreground)/0.15)_50%,hsl(var(--muted))_50%,hsl(var(--muted))_75%,hsl(var(--muted-foreground)/0.15)_75%)] bg-[length:8px_8px]",
                            // Selected state
                            backgroundColor === color.id && !backgroundImage && "ring-2 ring-vantage-500 ring-offset-2 ring-offset-background shadow-[0_0_12px_-3px_hsl(65_70%_45%/0.5)]",
                            // Dimmed when image is active
                            backgroundImage && "opacity-50"
                          )}
                          style={{ 
                            backgroundColor: color.id !== "transparent" ? color.value : undefined 
                          }}
                          disabled={disabled}
                          title={color.label}
                        >
                          {backgroundColor === color.id && !backgroundImage && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Check className="h-3.5 w-3.5 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Custom Background Image */}
                    {backgroundImage ? (
                      <div className="flex items-center gap-3 p-3 bg-vantage-500/10 rounded-xl border border-vantage-500/30">
                        <div 
                          className="w-12 h-12 rounded-lg bg-cover bg-center border-2 border-vantage-500/40 shadow-sm"
                          style={{ backgroundImage: `url(${backgroundImage})` }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {savedAiPrompt ? "AI background" : "Custom image"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {savedAiPrompt || "Replaces color • Remove to restore"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {/* Regenerate button for AI backgrounds */}
                          {savedAiPrompt && (
                            <button
                              type="button"
                              onClick={handleRegenerate}
                              disabled={disabled || aiGenerating}
                              className={cn(
                                "p-2 rounded-lg bg-muted/20 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all duration-150 active:scale-95",
                                aiGenerating && "opacity-50"
                              )}
                              title="Regenerate with same prompt"
                            >
                              <Sparkles className={cn(
                                "h-4 w-4",
                                aiGenerating && "animate-pulse"
                              )} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setBackgroundImage(null);
                              setSavedAiPrompt(null);
                              setAiPrompt("");
                            }}
                            className="p-2 rounded-lg bg-muted/20 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all duration-150 active:scale-95"
                            title="Remove background"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="group flex items-center gap-3 p-3 bg-muted/10 rounded-xl border-2 border-dashed border-border/40 cursor-pointer hover:border-vantage-500/50 hover:bg-vantage-500/5 transition-all duration-150">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg"
                          onChange={handleBackgroundImageUpload}
                          className="sr-only"
                          disabled={disabled}
                        />
                        <div className="w-10 h-10 rounded-lg bg-muted/30 group-hover:bg-vantage-500/15 flex items-center justify-center transition-colors">
                          <ImagePlus className="h-5 w-5 text-muted-foreground group-hover:text-vantage-500 transition-colors" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                            Add background image
                          </p>
                          <p className="text-xs text-muted-foreground/60">
                            PNG or JPG
                          </p>
                        </div>
                      </label>
                    )}
                    
                    {/* AI Background - Collapsible secondary option */}
                    {!backgroundImage && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setAiExpanded(!aiExpanded)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all duration-150",
                            aiExpanded 
                              ? "bg-primary/10 text-primary" 
                              : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/20"
                          )}
                          disabled={disabled}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Generate with AI</span>
                          <ChevronDown className={cn(
                            "h-3 w-3 ml-auto transition-transform duration-150",
                            aiExpanded && "rotate-180"
                          )} />
                        </button>
                        
                        {aiExpanded && (
                          <div className="mt-2 p-3 bg-muted/10 rounded-lg border border-border/20 space-y-2">
                            <Input
                              placeholder="dark room with soft lighting"
                              value={aiPrompt}
                              onChange={(e) => setAiPrompt(e.target.value)}
                              className="h-9 text-sm bg-background/50"
                              disabled={disabled || aiGenerating}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleAiGenerate();
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant={aiGenerating ? "ghost" : "default"}
                              onClick={handleAiGenerate}
                              disabled={disabled || aiGenerating || !aiPrompt.trim()}
                              className={cn(
                                "w-full h-8 text-xs transition-all duration-150",
                                aiGenerating && "opacity-60"
                              )}
                            >
                              <Sparkles className={cn(
                                "h-3 w-3 mr-1.5",
                                aiGenerating && "animate-pulse"
                              )} />
                              {aiGenerating ? "Creating background..." : "Generate"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Flip Camera Toggle */}
                  <div className="flex items-center justify-between py-3 px-4 bg-muted/10 rounded-lg border border-border/20">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-md transition-colors",
                        flipCamera ? "bg-primary/15" : "bg-muted/30"
                      )}>
                        <FlipHorizontal className={cn(
                          "h-4 w-4 transition-colors",
                          flipCamera ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Flip Camera</p>
                        <p className="text-xs text-muted-foreground">Mirror your facecam</p>
                      </div>
                    </div>
                    <Switch 
                      checked={flipCamera} 
                      onCheckedChange={setFlipCamera} 
                      disabled={disabled} 
                    />
                  </div>
                </div>
              )}

              {!includeFacecam && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="p-4 rounded-full bg-muted/20 mb-3">
                    <Camera className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enable facecam to customize appearance
                  </p>
                </div>
              )}
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
