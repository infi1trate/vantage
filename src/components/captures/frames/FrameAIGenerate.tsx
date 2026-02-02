/**
 * AI Frame Generator
 * 
 * Three modes: Game, Mood/Energy, Playstyle
 * Generates 3-6 frame variants
 */

import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Sparkles, 
  RefreshCw, 
  Bookmark,
  Gamepad2,
  Heart,
  Crosshair,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FrameStyleParams } from "@/lib/frameOverlays";

type AIMode = "game" | "mood" | "playstyle";

const MOOD_CHIPS = ["calm", "chaotic", "clutch", "funny", "toxic"] as const;
const PLAYSTYLE_CHIPS = ["sniper", "entry", "support", "shot-caller"] as const;

// Mock AI-generated variants (in production, this would come from API)
interface AIVariant {
  id: string;
  name: string;
  style: Partial<FrameStyleParams>;
}

interface FrameAIGenerateProps {
  onSelect: (variant: AIVariant) => void;
  onSaveAsSignature: (variant: AIVariant) => void;
  disabled?: boolean;
  className?: string;
}

export const FrameAIGenerate = memo(function FrameAIGenerate({
  onSelect,
  onSaveAsSignature,
  disabled = false,
  className,
}: FrameAIGenerateProps) {
  const [mode, setMode] = useState<AIMode>("game");
  const [gameInput, setGameInput] = useState("");
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedPlaystyles, setSelectedPlaystyles] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<AIVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  const toggleMood = (mood: string) => {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  };

  const togglePlaystyle = (style: string) => {
    setSelectedPlaystyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const canGenerate = () => {
    if (mode === "game") return gameInput.trim().length > 0;
    if (mode === "mood") return selectedMoods.length > 0;
    if (mode === "playstyle") return selectedPlaystyles.length > 0;
    return false;
  };

  const handleGenerate = async () => {
    if (!canGenerate() || generating) return;

    setGenerating(true);
    setVariants([]);
    setSelectedVariant(null);

    // Simulate AI generation (in production, call edge function)
    await new Promise((r) => setTimeout(r, 1500));

    // Generate mock variants based on mode
    const mockVariants = generateMockVariants(mode, gameInput, selectedMoods, selectedPlaystyles);
    setVariants(mockVariants);
    setGenerating(false);
  };

  const handleSelectVariant = (variant: AIVariant) => {
    setSelectedVariant(variant.id);
    onSelect(variant);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Mode Tabs */}
      <div className="flex rounded-lg border border-border/40 p-0.5 bg-muted/10">
        <ModeTab
          active={mode === "game"}
          onClick={() => setMode("game")}
          icon={<Gamepad2 className="h-3.5 w-3.5" />}
          label="Game"
          disabled={disabled}
        />
        <ModeTab
          active={mode === "mood"}
          onClick={() => setMode("mood")}
          icon={<Heart className="h-3.5 w-3.5" />}
          label="Mood"
          disabled={disabled}
        />
        <ModeTab
          active={mode === "playstyle"}
          onClick={() => setMode("playstyle")}
          icon={<Crosshair className="h-3.5 w-3.5" />}
          label="Playstyle"
          disabled={disabled}
        />
      </div>

      {/* Mode Content */}
      <div className="min-h-[80px]">
        {mode === "game" && (
          <div className="space-y-2">
            <Input
              placeholder="Enter game name (e.g., Valorant, Fortnite)"
              value={gameInput}
              onChange={(e) => setGameInput(e.target.value)}
              disabled={disabled || generating}
              className="h-9 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canGenerate()) {
                  handleGenerate();
                }
              }}
            />
            <p className="text-xs text-muted-foreground/60">
              We'll create frames that match your game's aesthetic
            </p>
          </div>
        )}

        {mode === "mood" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {MOOD_CHIPS.map((mood) => (
                <ChipButton
                  key={mood}
                  label={mood}
                  selected={selectedMoods.includes(mood)}
                  onClick={() => toggleMood(mood)}
                  disabled={disabled || generating}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground/60">
              Select one or more vibes for your frame
            </p>
          </div>
        )}

        {mode === "playstyle" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {PLAYSTYLE_CHIPS.map((style) => (
                <ChipButton
                  key={style}
                  label={style}
                  selected={selectedPlaystyles.includes(style)}
                  onClick={() => togglePlaystyle(style)}
                  disabled={disabled || generating}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground/60">
              Match your frame to how you play
            </p>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={disabled || generating || !canGenerate()}
        className="w-full h-9"
        size="sm"
      >
        {generating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Generate Frames
          </>
        )}
      </Button>

      {/* Generated Variants */}
      {variants.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {variants.length} variants generated
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              disabled={disabled || generating}
              className="h-7 px-2 text-xs"
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", generating && "animate-spin")} />
              Regenerate
            </Button>
          </div>

          <ScrollArea className="h-[140px]">
            <div className="grid grid-cols-3 gap-2 pr-2">
              {variants.map((variant) => (
                <VariantCard
                  key={variant.id}
                  variant={variant}
                  isSelected={selectedVariant === variant.id}
                  onSelect={() => handleSelectVariant(variant)}
                  onSaveSignature={() => onSaveAsSignature(variant)}
                  disabled={disabled}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
});

interface ModeTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
}

const ModeTab = memo(function ModeTab({ active, onClick, icon, label, disabled }: ModeTabProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
});

interface ChipButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
}

const ChipButton = memo(function ChipButton({ label, selected, onClick, disabled }: ChipButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-3 py-1.5 text-xs font-medium rounded-full capitalize transition-all touch-manipulation",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-muted/50 text-muted-foreground hover:bg-muted",
        disabled && "opacity-50"
      )}
    >
      {label}
    </button>
  );
});

interface VariantCardProps {
  variant: AIVariant;
  isSelected: boolean;
  onSelect: () => void;
  onSaveSignature: () => void;
  disabled: boolean;
}

const VariantCard = memo(function VariantCard({
  variant,
  isSelected,
  onSelect,
  onSaveSignature,
  disabled,
}: VariantCardProps) {
  const colorVar = getColorVar(variant.style.colorTheme || "primary");
  const glowIntensity = variant.style.glowIntensity || 0;
  const shapeClass = getShapeClass(variant.style.shape || "rounded");

  return (
    <div
      className={cn(
        "relative p-2 rounded-xl border transition-all cursor-pointer",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border/40 hover:border-border",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      <button onClick={onSelect} className="w-full flex flex-col items-center gap-1">
        <div
          className={cn("w-10 h-10 bg-muted/50 flex items-center justify-center", shapeClass)}
          style={{
            borderWidth: variant.style.strokeWidth || 0,
            borderColor: colorVar,
            borderStyle: "solid",
            boxShadow: glowIntensity > 0
              ? `0 0 ${glowIntensity * 10}px ${glowIntensity * 3}px ${colorVar}`
              : undefined,
          }}
        >
          <div className={cn("w-3/4 h-3/4 bg-muted-foreground/20", shapeClass)} />
        </div>
        <span className="text-[10px] font-medium truncate w-full text-center">
          {variant.name}
        </span>
      </button>

      {/* Save as Signature */}
      {isSelected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSaveSignature();
          }}
          className="absolute -top-1 -right-1 p-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
          title="Save as Signature Frame"
        >
          <Bookmark className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
});

function getColorVar(theme: string): string {
  const colors: Record<string, string> = {
    primary: "hsl(var(--primary))",
    white: "#ffffff",
    accent: "hsl(var(--accent))",
    "neon-pink": "#ff00ff",
    "neon-cyan": "#00ffff",
    "neon-green": "#00ff00",
  };
  return colors[theme] || colors.primary;
}

function getShapeClass(shape: string): string {
  switch (shape) {
    case "circle": return "rounded-full";
    case "hex": return "clip-path-hex";
    case "square": return "rounded-sm";
    default: return "rounded-lg";
  }
}

// Mock variant generator
function generateMockVariants(
  mode: AIMode,
  game: string,
  moods: string[],
  playstyles: string[]
): AIVariant[] {
  const baseVariants: AIVariant[] = [];
  const count = 4 + Math.floor(Math.random() * 3); // 4-6 variants

  for (let i = 0; i < count; i++) {
    const shapes = ["circle", "rounded", "hex"] as const;
    const colors = ["primary", "neon-pink", "neon-cyan", "neon-green", "white"] as const;
    
    baseVariants.push({
      id: `ai-${mode}-${i}`,
      name: getVariantName(mode, i, game, moods, playstyles),
      style: {
        shape: shapes[i % shapes.length],
        strokeWidth: 1 + (i % 4),
        glowIntensity: 0.3 + (Math.random() * 0.5),
        colorTheme: colors[i % colors.length],
        micRingEnabled: Math.random() > 0.7,
      },
    });
  }

  return baseVariants;
}

function getVariantName(
  mode: AIMode,
  index: number,
  game: string,
  moods: string[],
  playstyles: string[]
): string {
  const suffixes = ["Pro", "Elite", "Core", "Prime", "Ultra", "Max"];
  const suffix = suffixes[index % suffixes.length];

  if (mode === "game" && game) {
    return `${game.slice(0, 8)} ${suffix}`;
  }
  if (mode === "mood" && moods.length > 0) {
    return `${moods[0].charAt(0).toUpperCase() + moods[0].slice(1)} ${suffix}`;
  }
  if (mode === "playstyle" && playstyles.length > 0) {
    return `${playstyles[0].charAt(0).toUpperCase() + playstyles[0].slice(1)} ${suffix}`;
  }
  return `Variant ${index + 1}`;
}

export default FrameAIGenerate;
