import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createCaptureSession } from "@/lib/captures";
import { runCapturePreflightGate, type PreflightGateResult } from "@/lib/capturePreflightGate";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  Circle,
  Square,
  ImagePlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FacecamPreview, BACKGROUND_COLORS, type FrameShape, type CameraSize, type BackgroundColorId } from "@/components/capture/FacecamPreview";

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

  // Capture settings
  const [includeMicrophone, setIncludeMicrophone] = useState(true);
  const [includeFacecam, setIncludeFacecam] = useState(false);
  const [includeGameAudio, setIncludeGameAudio] = useState(true);
  const [frameShape, setFrameShape] = useState<FrameShape>("circle");
  const [cameraSize, setCameraSize] = useState<CameraSize>("small");
  const [backgroundColor, setBackgroundColor] = useState<BackgroundColorId>("transparent");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [flipCamera, setFlipCamera] = useState(true);

  // Run preflight check when dialog opens
  useEffect(() => {
    if (open) {
      const result = runCapturePreflightGate();
      setPreflightResult(result);
      
      if (result.supported) {
        // All checks passed - show form
        setView("form");
      } else {
        // Browser not supported - show error screen
        setView("not_supported");
      }
    } else {
      // Reset state when dialog closes
      setView("preflight");
      setTitle("");
      setGameName("");
      setPreviewOnlyMode(false);
      setIncludeMicrophone(true);
      setIncludeFacecam(false);
      setIncludeGameAudio(true);
      setFrameShape("circle");
      setCameraSize("small");
      setBackgroundColor("transparent");
      setBackgroundImage(null);
      setFlipCamera(true);
    }
  }, [open]);

  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith("image/") || !["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      toast.error("Please upload a PNG or JPG image");
      return;
    }
    
    // Read file as data URL for preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setBackgroundImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeBackgroundImage = () => {
    setBackgroundImage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    // Generate default title if not provided
    const sessionTitle = title.trim() || `Session ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;

    setLoading(true);
    try {
      const session = await createCaptureSession(
        user.id,
        sessionTitle,
        gameName || undefined
      );
      
      toast.success("Capture session created!");
      onOpenChange(false);
      // Navigate with preview mode flag if applicable
      // Pass capture settings as URL params
      const params = new URLSearchParams();
      if (previewOnlyMode) params.set("mode", "preview");
      if (includeMicrophone) params.set("mic", "1");
      if (includeFacecam) params.set("facecam", "1");
      if (includeGameAudio) params.set("audio", "1");
      
      const url = `/capture/${session.id}${params.toString() ? `?${params.toString()}` : ""}`;
      navigate(url);
    } catch (error: any) {
      console.error("Error creating session:", error);
      toast.error(error.message || "Failed to create capture session");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDiagnostics = async () => {
    if (!preflightResult) return;
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      browser: preflightResult.browserInfo,
      issues: preflightResult.issues,
      selectedFormat: preflightResult.selectedFormat,
      supported: preflightResult.supported,
      canPreview: preflightResult.canPreview,
    };
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setCopied(true);
      toast.success("Diagnostics copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Loading/checking view
  if (view === "preflight") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md glass-strong">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Checking browser compatibility...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Browser not supported view
  if (view === "not_supported" && preflightResult) {
    const criticalIssues = preflightResult.issues.filter(i => i.severity === "critical");
    const warnings = preflightResult.issues.filter(i => i.severity === "warning");
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg glass-strong">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <DialogTitle>Browser Not Supported</DialogTitle>
                <DialogDescription>
                  Your browser is missing capabilities required for capture.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Detected Browser */}
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span>
                Detected: <strong>{preflightResult.browserInfo.name} {preflightResult.browserInfo.version}</strong>
              </span>
            </div>

            {/* Critical Issues */}
            {criticalIssues.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wider text-destructive">
                  Missing Capabilities
                </h4>
                {criticalIssues.map(issue => (
                  <div 
                    key={issue.id}
                    className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm"
                  >
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-destructive">{issue.title}</span>
                      <p className="text-xs text-muted-foreground">{issue.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wider text-warning">
                  Warnings
                </h4>
                {warnings.map(issue => (
                  <div 
                    key={issue.id}
                    className="flex items-start gap-2 p-2 bg-warning/10 border border-warning/20 rounded text-sm"
                  >
                    <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-warning">{issue.title}</span>
                      <p className="text-xs text-muted-foreground">{issue.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recommended Browsers */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recommended Browsers
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <a
                  href="https://www.google.com/chrome/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 p-3 rounded border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Chrome className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs font-medium">Chrome</span>
                  <Badge variant="outline" className="text-[9px] bg-vantage-success/10 text-vantage-success">Best</Badge>
                </a>
                <a
                  href="https://www.microsoft.com/edge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 p-3 rounded border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Globe className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs font-medium">Edge</span>
                </a>
                <a
                  href="https://brave.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 p-3 rounded border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Globe className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs font-medium">Brave</span>
                </a>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {preflightResult.canPreview && (
              <Button
                variant="outline"
                onClick={() => {
                  setPreviewOnlyMode(true);
                  setView("form");
                }}
                className="w-full sm:w-auto"
              >
                Continue in Preview Mode
                <Badge variant="outline" className="ml-2 text-[9px]">No Recording</Badge>
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={handleCopyDiagnostics}
              className="w-full sm:w-auto"
            >
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy Diagnostics"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Capture Setup form view - Premium two-column layout
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl glass-strong p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/30">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-display text-xl tracking-wide">
              New Capture Session
            </DialogTitle>
            <DialogDescription className="text-sm">
              Configure your recording setup before starting capture.
            </DialogDescription>
          </DialogHeader>

          {/* Show warning if there are any issues but we're proceeding anyway */}
          {preflightResult && preflightResult.issues.length > 0 && (
            <div className="flex items-start gap-2 p-2 mt-4 bg-warning/10 border border-warning/20 rounded text-sm">
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

        <form onSubmit={handleSubmit}>
          {/* Two-column layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/30">
            {/* Left Column: Session Basics - lower visual priority */}
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                  Session Basics
                </h3>
              </div>

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
                <p className="text-[11px] text-muted-foreground/60">
                  Used for highlights, insights, and sharing.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="game" className="text-sm text-muted-foreground">
                  Game
                  <span className="text-muted-foreground/50 ml-1 text-xs font-normal">(optional)</span>
                </Label>
                <Select value={gameName} onValueChange={setGameName} disabled={loading}>
                  <SelectTrigger className="bg-transparent border-border/40">
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
                <p className="text-[11px] text-muted-foreground/60">
                  Auto-detection coming soon.
                </p>
              </div>
            </div>

            {/* Right Column: Settings + Effects */}
            <div className="p-6 space-y-6 bg-muted/5">
              {/* Capture Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Capture Settings
                  </h3>
                </div>

                <div className="space-y-3">
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
              </div>

              <Separator className="bg-border/20" />

              {/* Effects Section */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Effects
                  </h3>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    How you appear in the recording
                  </p>
                </div>

                {/* Facecam Toggle */}
                <CaptureToggle
                  id="facecam"
                  icon={Camera}
                  label="Facecam"
                  description="Picture-in-picture webcam overlay"
                  checked={includeFacecam}
                  onCheckedChange={setIncludeFacecam}
                  disabled={loading}
                />

                {/* Facecam Settings (only shown when enabled) */}
                {includeFacecam && (
                  <>
                    {/* Frame Shape Selector */}
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground/80">Frame Shape</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFrameShape("circle")}
                          className={cn(
                            "flex items-center justify-center w-12 h-12 rounded-lg border-2 transition-all duration-200",
                            "hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-md",
                            frameShape === "circle"
                              ? "border-primary bg-primary/10 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.4)]"
                              : "border-border/40 bg-muted/20"
                          )}
                          disabled={loading}
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
                            "flex items-center justify-center w-12 h-12 rounded-lg border-2 transition-all duration-200",
                            "hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-md",
                            frameShape === "rounded-square"
                              ? "border-primary bg-primary/10 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.4)]"
                              : "border-border/40 bg-muted/20"
                          )}
                          disabled={loading}
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
                      <p className="text-xs text-muted-foreground/80">Size</p>
                      <div className="inline-flex rounded-lg border border-border/40 p-0.5 bg-muted/10">
                        <button
                          type="button"
                          onClick={() => setCameraSize("small")}
                          className={cn(
                            "px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                            cameraSize === "small"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          )}
                          disabled={loading}
                        >
                          Small
                        </button>
                        <button
                          type="button"
                          onClick={() => setCameraSize("large")}
                          className={cn(
                            "px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                            cameraSize === "large"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          )}
                          disabled={loading}
                        >
                          Large
                        </button>
                      </div>
                    </div>

                    {/* Background Mask */}
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground/80">Background Mask</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {BACKGROUND_COLORS.map((color) => (
                          <button
                            key={color.id}
                            type="button"
                            onClick={() => setBackgroundColor(color.id)}
                            className={cn(
                              "relative w-full aspect-square rounded-md transition-all duration-200",
                              "hover:scale-105 hover:ring-2 hover:ring-primary/30",
                              color.id === "transparent" && "bg-[conic-gradient(from_45deg,#1a1a1a_25%,#2a2a2a_25%,#2a2a2a_50%,#1a1a1a_50%,#1a1a1a_75%,#2a2a2a_75%)] bg-[length:8px_8px]",
                              backgroundColor === color.id && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                            )}
                            style={{ 
                              backgroundColor: color.id !== "transparent" ? color.value : undefined 
                            }}
                            disabled={loading || !!backgroundImage}
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
                            onClick={removeBackgroundImage}
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
                            disabled={loading}
                          />
                          <div className="w-8 h-8 rounded-md bg-muted/30 flex items-center justify-center">
                            <ImagePlus className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="text-xs text-muted-foreground">Add background image</span>
                        </label>
                      )}
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

              {/* Settings Panel */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Settings2 className="h-3.5 w-3.5" />
                    Settings
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Recording quality and audio</p>
                </div>

                <div className="space-y-2">
                  {/* Video Quality */}
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/10 rounded-lg border border-border/20">
                    <div>
                      <p className="text-xs font-medium">Video Quality</p>
                      <p className="text-[10px] text-muted-foreground">Resolution and frame rate</p>
                    </div>
                    <Select defaultValue="1080p60">
                      <SelectTrigger className="w-[110px] h-8 text-xs bg-background border-border/40">
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
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/10 rounded-lg border border-border/20">
                    <div>
                      <p className="text-xs font-medium">Audio Quality</p>
                      <p className="text-[10px] text-muted-foreground">Microphone bitrate</p>
                    </div>
                    <Select defaultValue="128">
                      <SelectTrigger className="w-[90px] h-8 text-xs bg-background border-border/40">
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
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/10 rounded-lg border border-border/20">
                    <div>
                      <p className="text-xs font-medium">Camera Quality</p>
                      <p className="text-[10px] text-muted-foreground">Facecam resolution</p>
                    </div>
                    <Select defaultValue="720p">
                      <SelectTrigger className="w-[130px] h-8 text-xs bg-background border-border/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="720p">720p (Standard)</SelectItem>
                        <SelectItem value="hd" disabled className="opacity-50">
                          <span className="flex items-center gap-2">
                            HD
                            <span className="text-[10px] text-muted-foreground/70 italic">Coming soon</span>
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Flip Camera */}
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/10 rounded-lg border border-border/20">
                    <div>
                      <p className="text-xs font-medium">Flip Camera</p>
                      <p className="text-[10px] text-muted-foreground">Mirror your facecam</p>
                    </div>
                    <Switch checked={flipCamera} onCheckedChange={setFlipCamera} />
                  </div>

                  {/* Push-to-talk */}
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/10 rounded-lg border border-border/20">
                    <div>
                      <p className="text-xs font-medium">Push-to-Talk</p>
                      <p className="text-[10px] text-muted-foreground">Hold key to record voice</p>
                    </div>
                    <Switch defaultChecked={false} />
                  </div>

                  {/* Auto-stop on inactivity */}
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/10 rounded-lg border border-border/20">
                    <div>
                      <p className="text-xs font-medium">Auto-Stop</p>
                      <p className="text-[10px] text-muted-foreground">Stop after 30min inactivity</p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>

                  {/* Record System Audio */}
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/10 rounded-lg border border-border/20">
                    <div>
                      <p className="text-xs font-medium">Record System Audio</p>
                      <p className="text-[10px] text-muted-foreground">Game sounds and system output</p>
                    </div>
                    <Switch checked={includeGameAudio} onCheckedChange={setIncludeGameAudio} />
                  </div>

                  {/* Mono Audio */}
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/10 rounded-lg border border-border/20">
                    <div>
                      <p className="text-xs font-medium">Mono Audio</p>
                      <p className="text-[10px] text-muted-foreground">Recommended for voice clarity</p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                </div>
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
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border/30 bg-muted/10">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {preflightResult?.selectedFormat && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-vantage-success" />
                    {preflightResult.selectedFormat.mimeType.split(";")[0]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="min-w-[140px]"
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
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
