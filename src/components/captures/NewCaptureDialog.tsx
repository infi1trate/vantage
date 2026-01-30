import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createCaptureSession } from "@/lib/captures";
import { runCapturePreflightGate, type PreflightGateResult } from "@/lib/capturePreflightGate";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Video, 
  AlertTriangle, 
  XCircle, 
  AlertCircle,
  Chrome,
  Globe,
  Copy,
  Check,
  Mic,
  Camera,
  Monitor,
  Settings2,
  Volume2,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { EffectsModal, type EffectsConfig } from "./EffectsModal";
import { SettingsModal, type SettingsConfig } from "./SettingsModal";

interface NewCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const POPULAR_GAMES = [
  "Valorant",
  "Counter-Strike 2",
  "Apex Legends",
  "Overwatch 2",
  "Call of Duty: Warzone",
  "Fortnite",
  "Rainbow Six Siege",
  "PUBG",
  "Other",
];

type DialogView = "preflight" | "form" | "not_supported";

export function NewCaptureDialog({ open, onOpenChange }: NewCaptureDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [view, setView] = useState<DialogView>("preflight");
  const [preflightResult, setPreflightResult] = useState<PreflightGateResult | null>(null);
  const [title, setTitle] = useState("");
  const [gameName, setGameName] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewOnlyMode, setPreviewOnlyMode] = useState(false);

  // Child modal states
  const [effectsModalOpen, setEffectsModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Capture settings (audio toggles remain in main dialog)
  const [includeMicrophone, setIncludeMicrophone] = useState(true);
  const [includeGameAudio, setIncludeGameAudio] = useState(true);

  // Effects config
  const [effectsConfig, setEffectsConfig] = useState<EffectsConfig>({
    includeFacecam: false,
    frameShape: "circle",
    cameraSize: "small",
    backgroundColor: "transparent",
    backgroundImage: null,
    flipCamera: true,
  });

  // Settings config
  const [settingsConfig, setSettingsConfig] = useState<SettingsConfig>({
    videoQuality: "1080p60",
    audioBitrate: "128",
    systemAudio: true,
    pushToTalk: false,
    autoStop: true,
    monoAudio: true,
  });

  // Run preflight check when dialog opens
  useEffect(() => {
    if (open) {
      const result = runCapturePreflightGate();
      setPreflightResult(result);
      
      if (result.supported) {
        setView("form");
      } else {
        setView("not_supported");
      }
    } else {
      // Reset state when dialog closes
      setView("preflight");
      setTitle("");
      setGameName("");
      setPreviewOnlyMode(false);
      setIncludeMicrophone(true);
      setIncludeGameAudio(true);
      setEffectsConfig({
        includeFacecam: false,
        frameShape: "circle",
        cameraSize: "small",
        backgroundColor: "transparent",
        backgroundImage: null,
        flipCamera: true,
      });
      setSettingsConfig({
        videoQuality: "1080p60",
        audioBitrate: "128",
        systemAudio: true,
        pushToTalk: false,
        autoStop: true,
        monoAudio: true,
      });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    setLoading(true);
    try {
      const session = await createCaptureSession(
        user.id,
        title.trim() || `Session ${new Date().toLocaleDateString()}`,
        gameName || undefined
      );

      toast.success("Session created! Preparing capture...");
      onOpenChange(false);
      
      navigate(`/capture/${session.id}`, { 
        state: { 
          includeMicrophone,
          includeGameAudio,
          ...effectsConfig,
          ...settingsConfig,
          previewOnly: previewOnlyMode,
        } 
      });
    } catch (err) {
      console.error("Failed to create session:", err);
      toast.error("Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleProceedPreviewOnly = () => {
    setPreviewOnlyMode(true);
    setView("form");
  };

  // Check if any effects have been customized
  const hasCustomEffects = effectsConfig.includeFacecam || 
    effectsConfig.frameShape !== "circle" || 
    effectsConfig.cameraSize !== "small" || 
    effectsConfig.backgroundColor !== "transparent" || 
    effectsConfig.backgroundImage !== null;

  // Check if any settings have been customized
  const hasCustomSettings = settingsConfig.videoQuality !== "1080p60" ||
    settingsConfig.audioBitrate !== "128" ||
    !settingsConfig.autoStop ||
    settingsConfig.pushToTalk;

  // ============= Not Supported View =============
  if (view === "not_supported" && preflightResult) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-md glass-strong">
          <DialogHeader className="space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center font-display text-xl">
              Browser Not Supported
            </DialogTitle>
            <DialogDescription className="text-center">
              Your current browser doesn't support the screen capture features we need.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Show specific issues */}
            <div className="space-y-2">
              {preflightResult.issues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">{issue.title}</p>
                    <p className="text-xs text-muted-foreground">{issue.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recommended browsers */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Recommended Browsers
              </p>
              <div className="grid grid-cols-2 gap-2">
                <a 
                  href="https://www.google.com/chrome/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-muted/30 transition-colors"
                >
                  <Chrome className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Chrome</p>
                    <p className="text-[10px] text-muted-foreground">Recommended</p>
                  </div>
                </a>
                <a 
                  href="https://www.microsoft.com/edge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-muted/30 transition-colors"
                >
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Edge</p>
                    <p className="text-[10px] text-muted-foreground">Also works</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Copy link option */}
            <div className="pt-2">
              <p className="text-xs text-muted-foreground text-center mb-2">
                Or copy this link to open in a supported browser:
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleCopyUrl}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleProceedPreviewOnly}
              className="text-xs text-muted-foreground"
            >
              Continue anyway (preview only)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ============= Main Capture Setup Form =============
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-lg glass-strong p-0 overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-border/30">
            <DialogHeader className="space-y-1">
              <DialogTitle className="font-display text-lg sm:text-xl tracking-wide">
                New Capture Session
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Configure your recording setup before starting capture.
              </DialogDescription>
            </DialogHeader>

            {/* Show warning if there are any issues but we're proceeding anyway */}
            {preflightResult && preflightResult.issues.length > 0 && (
              <div className="flex items-start gap-2 p-2 mt-3 sm:mt-4 bg-warning/10 border border-warning/20 rounded text-sm">
                <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-medium text-warning">Limited Support</span>
                  <p className="text-xs text-muted-foreground">
                    Some features may not work as expected in your browser.
                  </p>
                </div>
              </div>
            )}

            {/* Preview mode badge */}
            {previewOnlyMode && (
              <Badge variant="outline" className="mt-3 bg-warning/10 text-warning border-warning/30">
                Preview Mode — Recording disabled
              </Badge>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-5">
              {/* Session Basics */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm text-muted-foreground">
                    Session Title
                    <span className="text-muted-foreground/50 ml-1 text-xs font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="title"
                    placeholder="Ranked Valorant – Bind"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-transparent border-border/40 focus:border-primary/50 placeholder:text-muted-foreground/40"
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="game" className="text-sm text-muted-foreground">
                    Game
                    <span className="text-muted-foreground/50 ml-1 text-xs font-normal">(optional)</span>
                  </Label>
                  <Select value={gameName} onValueChange={setGameName} disabled={loading}>
                    <SelectTrigger className="w-full bg-transparent border-border/40">
                      <SelectValue placeholder="Select game" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {POPULAR_GAMES.map((game) => (
                        <SelectItem key={game} value={game}>
                          {game}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Audio Capture Toggles */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                  Audio Sources
                </h3>
                
                <CaptureToggle
                  id="game-audio"
                  icon={Volume2}
                  label="Game Audio"
                  description="Capture in-game sound"
                  checked={includeGameAudio}
                  onCheckedChange={setIncludeGameAudio}
                  disabled={loading}
                />

                <CaptureToggle
                  id="microphone"
                  icon={Mic}
                  label="Microphone"
                  description="Voice commentary and callouts"
                  checked={includeMicrophone}
                  onCheckedChange={setIncludeMicrophone}
                  disabled={loading}
                />
              </div>

              {/* Effects & Settings CTAs */}
              <div className="grid grid-cols-2 gap-3">
                {/* Effects CTA */}
                <button
                  type="button"
                  onClick={() => setEffectsModalOpen(true)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-150",
                    "hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]",
                    hasCustomEffects
                      ? "border-primary/40 bg-primary/5 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.3)]"
                      : "border-border/40 bg-muted/10 hover:bg-muted/20"
                  )}
                  disabled={loading}
                >
                  <div className={cn(
                    "p-3 rounded-xl transition-colors",
                    hasCustomEffects ? "bg-primary/15" : "bg-muted/30"
                  )}>
                    <Camera className={cn(
                      "h-6 w-6 transition-colors",
                      hasCustomEffects ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      "text-sm font-medium transition-colors",
                      hasCustomEffects ? "text-foreground" : "text-muted-foreground"
                    )}>
                      Effects
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {effectsConfig.includeFacecam ? "Facecam on" : "Facecam off"}
                    </p>
                  </div>
                  {hasCustomEffects && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 border-primary/30 text-primary">
                      Customized
                    </Badge>
                  )}
                </button>

                {/* Settings CTA */}
                <button
                  type="button"
                  onClick={() => setSettingsModalOpen(true)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-150",
                    "hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]",
                    hasCustomSettings
                      ? "border-primary/40 bg-primary/5 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.3)]"
                      : "border-border/40 bg-muted/10 hover:bg-muted/20"
                  )}
                  disabled={loading}
                >
                  <div className={cn(
                    "p-3 rounded-xl transition-colors",
                    hasCustomSettings ? "bg-primary/15" : "bg-muted/30"
                  )}>
                    <Settings2 className={cn(
                      "h-6 w-6 transition-colors",
                      hasCustomSettings ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      "text-sm font-medium transition-colors",
                      hasCustomSettings ? "text-foreground" : "text-muted-foreground"
                    )}>
                      Settings
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {settingsConfig.videoQuality}
                    </p>
                  </div>
                  {hasCustomSettings && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 border-primary/30 text-primary">
                      Customized
                    </Badge>
                  )}
                </button>
              </div>

              {/* Screen Selection hint */}
              <div className="flex items-start gap-2 p-3 bg-muted/20 rounded-lg border border-border/20">
                <Monitor className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Screen Selection</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    You'll choose which screen or window after clicking Start.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer - sticky at bottom */}
            <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-border/30 bg-muted/10">
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  className="text-muted-foreground hover:text-foreground w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <div className="flex flex-col items-center sm:items-end gap-1 w-full sm:w-auto">
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className={cn(
                      "w-full sm:w-auto sm:min-w-[140px] bg-vantage-500 hover:bg-vantage-600 text-vantage-950 font-semibold",
                      // Visual emphasis when settings have been customized
                      (hasCustomEffects || hasCustomSettings || !includeGameAudio) &&
                      "ring-2 ring-vantage-500/30 ring-offset-2 ring-offset-background shadow-lg shadow-vantage-500/20"
                    )}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Video className="mr-2 h-4 w-4" />
                        Start Capture
                      </>
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground/70 text-center sm:text-right">
                    You can adjust effects during capture
                  </p>
                </div>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Child Modals */}
      <EffectsModal
        open={effectsModalOpen}
        onOpenChange={setEffectsModalOpen}
        config={effectsConfig}
        onSave={setEffectsConfig}
        disabled={loading}
      />

      <SettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        config={settingsConfig}
        onSave={setSettingsConfig}
        disabled={loading}
      />
    </>
  );
}

// Toggle component for capture settings
interface CaptureToggleProps {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  badge?: string;
}

function CaptureToggle({
  id,
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  badge,
}: CaptureToggleProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
        checked 
          ? "bg-primary/5 border-primary/30" 
          : "bg-muted/20 border-border/30 hover:border-border/50"
      )}
    >
      <div className={cn(
        "p-2 rounded-md transition-colors",
        checked ? "bg-primary/10" : "bg-muted/30"
      )}>
        <Icon className={cn(
          "h-4 w-4 transition-colors",
          checked ? "text-primary" : "text-muted-foreground"
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium transition-colors",
            checked ? "text-foreground" : "text-muted-foreground"
          )}>
            {label}
          </span>
          {badge && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </label>
  );
}
