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
  Check,
  Camera,
  Circle,
  Square,
  ImagePlus,
  X,
  FlipHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  FacecamPreview, 
  BACKGROUND_COLORS, 
  type FrameShape, 
  type CameraSize, 
  type BackgroundColorId 
} from "@/components/capture/FacecamPreview";

export interface EffectsConfig {
  includeFacecam: boolean;
  frameShape: FrameShape;
  cameraSize: CameraSize;
  backgroundColor: BackgroundColorId;
  backgroundImage: string | null;
  flipCamera: boolean;
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

  // Sync local state when modal opens
  useEffect(() => {
    if (open) {
      setIncludeFacecam(config.includeFacecam);
      setFrameShape(config.frameShape);
      setCameraSize(config.cameraSize);
      setBackgroundColor(config.backgroundColor);
      setBackgroundImage(config.backgroundImage);
      setFlipCamera(config.flipCamera);
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

  const handleSave = () => {
    onSave({
      includeFacecam,
      frameShape,
      cameraSize,
      backgroundColor,
      backgroundImage,
      flipCamera,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-md glass-strong p-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-border/30">
          <DialogTitle className="font-display text-lg tracking-wide flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Effects
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
          {/* Facecam Toggle */}
          <div className="flex items-center justify-between py-2 px-3 bg-muted/10 rounded-lg border border-border/20">
            <div className="flex items-center gap-3">
              <Camera className="h-4 w-4 text-muted-foreground" />
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
            <>
              {/* Frame Shape Selector */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Frame Shape</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFrameShape("circle")}
                    className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-lg border-2 transition-all duration-150",
                      "hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-md active:scale-95",
                      frameShape === "circle"
                        ? "border-primary bg-primary/10 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.4)]"
                        : "border-border/40 bg-muted/20"
                    )}
                    disabled={disabled}
                  >
                    <Circle 
                      className={cn(
                        "h-6 w-6 transition-colors",
                        frameShape === "circle" ? "text-primary" : "text-muted-foreground/60"
                      )} 
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrameShape("rounded-square")}
                    className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-lg border-2 transition-all duration-150",
                      "hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-md active:scale-95",
                      frameShape === "rounded-square"
                        ? "border-primary bg-primary/10 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.4)]"
                        : "border-border/40 bg-muted/20"
                    )}
                    disabled={disabled}
                  >
                    <Square 
                      className={cn(
                        "h-5 w-5 rounded transition-colors",
                        frameShape === "rounded-square" ? "text-primary" : "text-muted-foreground/60"
                      )} 
                    />
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
                      "px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-150 active:scale-95",
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
                      "px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-150 active:scale-95",
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

              {/* Background Mask */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Background Mask</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {BACKGROUND_COLORS.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setBackgroundColor(color.id)}
                      className={cn(
                        "relative w-full aspect-square rounded-md transition-all duration-150",
                        "hover:scale-105 hover:ring-2 hover:ring-primary/30 active:scale-100",
                        color.id === "transparent" && "bg-[conic-gradient(from_45deg,#1a1a1a_25%,#2a2a2a_25%,#2a2a2a_50%,#1a1a1a_50%,#1a1a1a_75%,#2a2a2a_75%)] bg-[length:8px_8px]",
                        backgroundColor === color.id && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      )}
                      style={{ 
                        backgroundColor: color.id !== "transparent" ? color.value : undefined 
                      }}
                      disabled={disabled || !!backgroundImage}
                      title={color.label}
                    >
                      {backgroundColor === color.id && !backgroundImage && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom Background Image */}
                {backgroundImage ? (
                  <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg border border-border/30">
                    <div 
                      className="w-10 h-10 rounded-md bg-cover bg-center border border-border/40"
                      style={{ backgroundImage: `url(${backgroundImage})` }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">Custom image</p>
                      <p className="text-[10px] text-muted-foreground">Overrides color</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBackgroundImage(null)}
                      className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 p-2 bg-muted/10 rounded-lg border border-dashed border-border/40 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={handleBackgroundImageUpload}
                      className="sr-only"
                      disabled={disabled}
                    />
                    <div className="w-8 h-8 rounded-md bg-muted/30 flex items-center justify-center">
                      <ImagePlus className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">Add background image</span>
                  </label>
                )}
              </div>

              {/* Flip Camera Toggle */}
              <div className="flex items-center justify-between py-2 px-3 bg-muted/10 rounded-lg border border-border/20">
                <div className="flex items-center gap-3">
                  <FlipHorizontal className="h-4 w-4 text-muted-foreground" />
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
            </>
          )}

          {/* Live Camera Preview */}
          <FacecamPreview 
            enabled={includeFacecam} 
            frameShape={frameShape} 
            cameraSize={cameraSize} 
            backgroundColor={backgroundColor}
            backgroundImage={backgroundImage}
            flipCamera={flipCamera}
          />
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
