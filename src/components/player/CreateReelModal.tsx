import { useState, useMemo, useCallback, memo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Annotation } from "@/lib/captures";
import { createReel, AspectRatio } from "@/lib/reels";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Target, 
  Skull, 
  Star, 
  Check,
  Film,
  Smartphone,
  Square,
  RectangleHorizontal,
  Loader2,
  Play,
  Download,
  Share2,
  ArrowLeft,
  CheckCircle2,
  Volume2,
  VolumeX,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { AspectRatio as AspectRatioContainer } from "@/components/ui/aspect-ratio";

interface CreateReelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moments: Annotation[];
  sessionId: string;
  sessionTitle?: string;
}

type AspectRatioValue = "16:9" | "9:16" | "1:1";
type ModalStep = "create" | "preview";

interface GeneratedReel {
  aspectRatio: AspectRatioValue;
  duration: number;
  momentCount: number;
  previewUrl?: string;
}

const ASPECT_RATIOS: { value: AspectRatioValue; label: string; icon: React.ComponentType<{ className?: string }>; desc: string; ratio: number }[] = [
  { value: "16:9", label: "Landscape", icon: RectangleHorizontal, desc: "YouTube, Desktop", ratio: 16/9 },
  { value: "9:16", label: "Portrait", icon: Smartphone, desc: "TikTok, Reels, Shorts", ratio: 9/16 },
  { value: "1:1", label: "Square", icon: Square, desc: "Instagram, X", ratio: 1 },
];

const MOMENT_CONFIG: Record<string, { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  color: string;
}> = {
  kill: { label: "Kill", icon: Target, color: "text-vantage-success" },
  death: { label: "Death", icon: Skull, color: "text-destructive" },
  highlight: { label: "Highlight", icon: Star, color: "text-vantage-warning" },
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatDuration = (seconds: number) => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};

// Memoized moment toggle row
const MomentToggleRow = memo(function MomentToggleRow({
  annotation,
  selected,
  onToggle,
}: {
  annotation: Annotation;
  selected: boolean;
  onToggle: () => void;
}) {
  const config = MOMENT_CONFIG[annotation.annotation_type] || MOMENT_CONFIG.highlight;
  const Icon = config.icon;

  return (
    <button
      className={cn(
        "w-full flex items-center gap-3 p-3 min-h-12 rounded-lg text-left transition-all touch-manipulation",
        selected 
          ? "bg-primary/10 border border-primary/30" 
          : "bg-muted/20 border border-transparent opacity-50 hover:opacity-70 active:opacity-90"
      )}
      onClick={onToggle}
    >
      {/* Checkbox indicator */}
      <div className={cn(
        "shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
        selected 
          ? "bg-primary border-primary" 
          : "border-muted-foreground/30"
      )}>
        {selected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>

      {/* Event Icon */}
      <Icon className={cn("h-4 w-4 shrink-0", config.color)} />
      
      {/* Label + Time */}
      <span className="flex-1 text-sm font-medium">
        {config.label}
      </span>
      <span className="text-xs font-mono tabular-nums text-muted-foreground">
        {formatTime(annotation.timestamp_seconds)}
      </span>
    </button>
  );
});

// Aspect ratio button
const AspectButton = memo(function AspectButton({
  ratio,
  selected,
  onClick,
}: {
  ratio: typeof ASPECT_RATIOS[0];
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = ratio.icon;
  
  return (
    <button
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-xl transition-all min-w-[90px]",
        selected 
          ? "bg-primary/10 ring-2 ring-primary/50" 
          : "bg-muted/20 hover:bg-muted/40"
      )}
      onClick={onClick}
    >
      <Icon className={cn(
        "h-6 w-6",
        selected ? "text-primary" : "text-muted-foreground"
      )} />
      <div className="text-center">
        <p className={cn(
          "text-xs font-medium",
          selected ? "text-primary" : "text-foreground"
        )}>
          {ratio.label}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {ratio.desc}
        </p>
      </div>
    </button>
  );
});

// Export status type with specific phases
type ExportPhase = "idle" | "preparing" | "exporting" | "complete" | "error";

// Reel Preview Component - shown after generation
// Minimal controls only: play/pause, mute. No scrubbing or editing.
function ReelPreviewContent({
  reel,
  onBack,
  onClose,
}: {
  reel: GeneratedReel;
  onBack: () => void;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  
  // Export state with phases
  const [exportPhase, setExportPhase] = useState<ExportPhase>("idle");
  const [exportProgress, setExportProgress] = useState(0);

  const ratioConfig = ASPECT_RATIOS.find(r => r.value === reel.aspectRatio) || ASPECT_RATIOS[0];
  const AspectIcon = ratioConfig.icon;

  // Phase labels for user feedback
  const getPhaseLabel = useCallback(() => {
    switch (exportPhase) {
      case "preparing": return "Preparing reel…";
      case "exporting": return "Exporting…";
      case "complete": return "Ready to download";
      default: return "";
    }
  }, [exportPhase]);

  // Autoplay muted on desktop
  useEffect(() => {
    if (!isMobile && videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        // Autoplay blocked
      });
    }
  }, [isMobile]);

  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    } else {
      // Toggle visual state for placeholder
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
    }
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Export with phased progress
  const handleExport = useCallback(async () => {
    if (exportPhase !== "idle") return;
    
    try {
      // Phase 1: Preparing
      setExportPhase("preparing");
      setExportProgress(0);
      
      // Simulate preparation (assembling clips)
      await new Promise(resolve => setTimeout(resolve, 800));
      setExportProgress(25);
      
      // Phase 2: Exporting
      setExportPhase("exporting");
      
      // Simulate export progress
      const progressSteps = [40, 55, 70, 85, 95];
      for (const step of progressSteps) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setExportProgress(step);
      }
      
      // Final step
      await new Promise(resolve => setTimeout(resolve, 400));
      setExportProgress(100);
      
      // Phase 3: Complete
      setExportPhase("complete");
      
    } catch (error) {
      setExportPhase("error");
      // No toast - error is shown inline to keep user anchored
    }
  }, [exportPhase]);

  // Retry export after failure
  const handleRetryExport = useCallback(() => {
    setExportPhase("idle");
    setExportProgress(0);
  }, []);

  // Download the exported file
  const handleDownload = useCallback(() => {
    // In production, this would trigger actual file download
    toast.success("Downloading MP4", {
      description: `Vantage_Reel_${reel.aspectRatio.replace(":", "x")}.mp4`,
    });
  }, [reel.aspectRatio]);

  // Share link
  const handleShareLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("https://vantage.app/reel/abc123");
      toast.success("Link copied!", {
        description: "Share this link with anyone",
      });
    } catch {
      toast.success("Share link ready", {
        description: "https://vantage.app/reel/abc123",
      });
    }
  }, []);

  // Re-export (reset and export again)
  const handleReExport = useCallback(() => {
    setExportPhase("idle");
    setExportProgress(0);
    // Trigger export after state reset
    setTimeout(() => {
      handleExport();
    }, 50);
  }, [handleExport]);

  const isProcessing = exportPhase === "preparing" || exportPhase === "exporting";

  return (
    <div className="flex flex-col h-full max-h-[85vh] md:max-h-[650px]">
      {/* AI-generated header - clear labeling */}
      <div className="shrink-0 px-3 sm:px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-medium text-primary">
            AI-generated Reel
          </span>
          <Badge 
            variant="secondary" 
            className="ml-auto text-[10px] bg-muted/50 shrink-0"
          >
            {reel.momentCount} clips • {formatDuration(reel.duration)}
          </Badge>
        </div>
      </div>

      {/* Video Preview - full-width on mobile */}
      <div className={cn(
        "flex-1 min-h-0 flex items-center justify-center",
        isMobile ? "px-2 py-2" : "px-4 py-2"
      )}>
        <div 
          className={cn(
            "relative w-full overflow-hidden rounded-xl bg-black shadow-2xl",
            // Full-width on mobile for portrait reels, constrained on desktop
            isMobile 
              ? reel.aspectRatio === "16:9" 
                ? "max-w-full" 
                : reel.aspectRatio === "1:1"
                  ? "max-w-[85vw]"
                  : "max-w-[75vw]" // 9:16 portrait
              : reel.aspectRatio === "9:16" 
                ? "max-w-[280px]"
                : reel.aspectRatio === "1:1" 
                  ? "max-w-[320px]"
                  : "max-w-full"
          )}
        >
          <AspectRatioContainer ratio={ratioConfig.ratio}>
            {/* Video container - tap to play/pause */}
            <div 
              className="absolute inset-0 bg-gradient-to-br from-muted/30 via-background to-muted/30 flex items-center justify-center cursor-pointer select-none"
              onClick={handlePlayPause}
            >
              {/* Hidden video element for when real URL exists */}
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover opacity-0"
                src={reel.previewUrl}
                loop
                playsInline
                muted={isMuted}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              
              {/* Visual placeholder - larger touch target */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 sm:gap-4">
                <div className={cn(
                  "rounded-full flex items-center justify-center transition-all duration-200",
                  // Larger play button on mobile for easier tapping
                  isMobile ? "w-24 h-24" : "w-20 h-20",
                  isPlaying 
                    ? "bg-primary/10 backdrop-blur-sm" 
                    : "bg-white/90 shadow-lg"
                )}>
                  {isPlaying ? (
                    <Film className={cn("text-primary animate-pulse", isMobile ? "h-10 w-10" : "h-8 w-8")} />
                  ) : (
                    <Play className={cn("text-background ml-1", isMobile ? "h-10 w-10" : "h-8 w-8")} />
                  )}
                </div>
                {!isPlaying && (
                  <p className="text-sm sm:text-xs text-muted-foreground">
                    Tap to play
                  </p>
                )}
              </div>

              {/* Mute toggle - larger on mobile */}
              {isPlaying && (
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <button
                    className={cn(
                      "rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm transition-transform active:scale-95 touch-manipulation",
                      isMobile ? "w-11 h-11" : "w-9 h-9"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                  >
                    {isMuted ? (
                      <VolumeX className={cn("text-white", isMobile ? "h-5 w-5" : "h-4 w-4")} />
                    ) : (
                      <Volume2 className={cn("text-white", isMobile ? "h-5 w-5" : "h-4 w-4")} />
                    )}
                  </button>
                </div>
              )}
            </div>
          </AspectRatioContainer>

          {/* Aspect ratio badge */}
          <div className="absolute top-3 left-3 pointer-events-none">
            <Badge 
              variant="secondary" 
              className="bg-black/60 text-white border-0 backdrop-blur-sm gap-1 text-[10px]"
            >
              <AspectIcon className="h-3 w-3" />
              {reel.aspectRatio}
            </Badge>
          </div>
        </div>
      </div>

      {/* Footer actions - thumb-friendly on mobile */}
      <div className={cn(
        "shrink-0 border-t border-border/30 bg-muted/10",
        isMobile ? "p-3 pb-4" : "p-4"
      )}>
        {/* Export progress - larger text on mobile */}
        {isProcessing && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className={cn("animate-spin text-primary", isMobile ? "h-4 w-4" : "h-3.5 w-3.5")} />
                <span className={cn("font-medium text-foreground", isMobile ? "text-sm" : "text-xs")}>
                  {getPhaseLabel()}
                </span>
              </div>
              <span className={cn("font-mono text-muted-foreground", isMobile ? "text-sm" : "text-xs")}>
                {Math.round(exportProgress)}%
              </span>
            </div>
            <div className={cn("bg-muted rounded-full overflow-hidden", isMobile ? "h-2" : "h-1.5")}>
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Complete state - satisfying confirmation */}
        {exportPhase === "complete" && (
          <div className="mb-4">
            <div className={cn(
              "flex items-center gap-3 rounded-lg bg-vantage-success/10 border border-vantage-success/20",
              isMobile ? "px-4 py-3.5" : "px-3 py-3"
            )}>
              <CheckCircle2 className={cn("text-vantage-success shrink-0", isMobile ? "h-6 w-6" : "h-5 w-5")} />
              <div className="flex-1 min-w-0">
                <span className={cn("font-medium text-vantage-success block", isMobile ? "text-base" : "text-sm")}>
                  Reel exported
                </span>
                <span className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-[11px]")}>
                  Ready to post anywhere
                </span>
              </div>
              <Badge 
                variant="secondary" 
                className="text-[10px] bg-muted/50 shrink-0"
              >
                {reel.aspectRatio} MP4
              </Badge>
            </div>
          </div>
        )}

        {/* Error state - calm, reassuring, with retry */}
        {exportPhase === "error" && (
          <div className="mb-4">
            <div className={cn(
              "flex items-center gap-3 rounded-lg bg-destructive/10 border border-destructive/20",
              isMobile ? "px-4 py-3.5" : "px-3 py-3"
            )}>
              <AlertCircle className={cn("text-destructive shrink-0", isMobile ? "h-6 w-6" : "h-5 w-5")} />
              <div className="flex-1 min-w-0">
                <span className={cn("font-medium text-destructive block", isMobile ? "text-base" : "text-sm")}>
                  Couldn't export this time
                </span>
                <span className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-[11px]")}>
                  Your reel is still here — let's try again
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons - taller on mobile for thumb reach */}
        <div className="flex gap-2">
          {exportPhase === "complete" ? (
            <>
              {/* Complete: Download MP4 is primary */}
              <Button
                size="lg"
                className={cn("flex-1 gap-2 font-semibold", isMobile ? "h-14 text-base" : "h-12")}
                onClick={handleDownload}
              >
                <Download className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                Download MP4
              </Button>
              <Button
                variant="outline"
                size="lg"
                className={cn("gap-2", isMobile ? "h-14 px-5" : "h-12 px-4")}
                onClick={handleShareLink}
              >
                <Share2 className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                <span className={isMobile ? "" : "hidden sm:inline"}>Share</span>
              </Button>
            </>
          ) : exportPhase === "error" ? (
            <>
              {/* Error: Retry Export is primary */}
              <Button
                size="lg"
                className={cn("flex-1 gap-2 font-semibold", isMobile ? "h-14 text-base" : "h-12")}
                onClick={handleRetryExport}
              >
                <RefreshCw className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                Retry Export
              </Button>
              <Button
                variant="outline"
                size="lg"
                className={cn("gap-2", isMobile ? "h-14 px-5" : "h-12 px-4")}
                onClick={onBack}
              >
                <ArrowLeft className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                <span className={isMobile ? "" : "hidden sm:inline"}>Back</span>
              </Button>
            </>
          ) : (
            <>
              {/* Default: Export Reel is primary */}
              <Button
                size="lg"
                className={cn("flex-1 gap-2 font-semibold", isMobile ? "h-14 text-base" : "h-12")}
                onClick={handleExport}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className={cn("animate-spin", isMobile ? "h-5 w-5" : "h-4 w-4")} />
                    {exportPhase === "preparing" ? "Preparing…" : "Exporting…"}
                  </>
                ) : (
                  <>
                    <Download className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                    Export Reel
                  </>
                )}
              </Button>
              
              {/* Secondary: Share Link */}
              <Button
                variant="outline"
                size="lg"
                className={cn("gap-2", isMobile ? "h-14 px-5" : "h-12 px-4")}
                onClick={handleShareLink}
                disabled={isProcessing}
              >
                <Share2 className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                <span className={isMobile ? "" : "hidden sm:inline"}>Share</span>
              </Button>
            </>
          )}
        </div>
        
        {/* Footer actions - larger touch targets on mobile */}
        {exportPhase === "complete" ? (
          <div className={cn(
            "flex items-center justify-center gap-4",
            isMobile ? "mt-4" : "mt-3"
          )}>
            <button
              className={cn(
                "text-muted-foreground hover:text-foreground active:text-foreground transition-colors flex items-center gap-1.5 touch-manipulation",
                isMobile ? "py-3 px-4 text-sm" : "py-2 text-xs"
              )}
              onClick={handleReExport}
            >
              <Film className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
              Export again
            </button>
            <span className="text-muted-foreground/30">•</span>
            <button
              className={cn(
                "text-muted-foreground hover:text-foreground active:text-foreground transition-colors flex items-center gap-1.5 touch-manipulation",
                isMobile ? "py-3 px-4 text-sm" : "py-2 text-xs"
              )}
              onClick={onClose}
            >
              <Check className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
              Done
            </button>
          </div>
        ) : (
          <button
            className={cn(
              "w-full text-muted-foreground hover:text-foreground active:text-foreground transition-colors flex items-center justify-center gap-1.5 touch-manipulation",
              isMobile ? "mt-4 py-3 text-sm" : "mt-3 py-2 text-xs"
            )}
            onClick={onBack}
            disabled={isProcessing}
          >
            <ArrowLeft className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
            Create another reel
          </button>
        )}
      </div>
    </div>
  );
}

function ReelCreatorContent({
  moments,
  sessionId,
  sessionTitle,
  onReelCreated,
  onClose,
}: {
  moments: Annotation[];
  sessionId: string;
  sessionTitle?: string;
  onReelCreated: (reelId: string) => void;
  onClose: () => void;
}) {
  const [aspectRatio, setAspectRatio] = useState<AspectRatioValue>("9:16");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // Auto-select all moments by default, ordered by timeline
    return new Set(moments.map(m => m.id));
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Sorted moments for display
  const sortedMoments = useMemo(() => {
    return [...moments].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
  }, [moments]);

  // Selected moments in timeline order
  const selectedMoments = useMemo(() => {
    return sortedMoments.filter(m => selectedIds.has(m.id));
  }, [sortedMoments, selectedIds]);

  // Estimated duration (rough: 3s per moment + 0.5s transitions)
  const estimatedDuration = useMemo(() => {
    return selectedMoments.length * 3.5;
  }, [selectedMoments]);

  const toggleMoment = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(moments.map(m => m.id)));
  }, [moments]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleGenerate = useCallback(async () => {
    if (selectedMoments.length === 0) {
      toast.error("Select at least one moment");
      return;
    }

    setIsGenerating(true);
    
    try {
      // Create the reel entity in the database
      const reel = await createReel({
        sessionId,
        title: sessionTitle ? `${sessionTitle} Reel` : "Untitled Reel",
        aspectRatio: aspectRatio as AspectRatio,
        momentIds: Array.from(selectedIds),
      });
      
      // Navigate to Reel Editor
      onReelCreated(reel.id);
    } catch (error) {
      console.error("Failed to create reel:", error);
      toast.error("Failed to create reel");
      setIsGenerating(false);
    }
  }, [selectedMoments, selectedIds, aspectRatio, sessionId, sessionTitle, onReelCreated]);

  return (
    <div className="flex flex-col h-full max-h-[80vh] md:max-h-[600px]">
      {/* AI Badge */}
      <div className="shrink-0 px-4 pt-2 pb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-primary">
            AI assembled this for you
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            ~{Math.ceil(estimatedDuration)}s estimated
          </span>
        </div>
      </div>

      {/* Aspect Ratio Selection */}
      <section className="shrink-0 px-4 pb-4">
        <h4 className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wide mb-3">
          Format
        </h4>
        <div className="flex gap-2 justify-center overflow-x-auto pb-1">
          {ASPECT_RATIOS.map(ratio => (
            <AspectButton
              key={ratio.value}
              ratio={ratio}
              selected={aspectRatio === ratio.value}
              onClick={() => setAspectRatio(ratio.value)}
            />
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="shrink-0 border-t border-border/20" />

      {/* Moment Selection */}
      <section className="flex-1 min-h-0 flex flex-col">
        <div className="shrink-0 px-4 py-3 flex items-center justify-between">
          <h4 className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wide">
            Moments ({selectedMoments.length}/{sortedMoments.length})
          </h4>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={selectAll}
              disabled={selectedIds.size === moments.length}
            >
              Select all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={deselectAll}
              disabled={selectedIds.size === 0}
            >
              Clear
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-1.5 pb-4">
            {sortedMoments.map((moment, index) => (
              <div key={moment.id} className="flex items-center gap-2">
                {/* Order indicator */}
                <span className={cn(
                  "shrink-0 w-5 text-center text-xs font-mono",
                  selectedIds.has(moment.id) ? "text-primary" : "text-muted-foreground/30"
                )}>
                  {selectedIds.has(moment.id) 
                    ? [...selectedIds].indexOf(moment.id) + 1
                    : "–"
                  }
                </span>
                <div className="flex-1">
                  <MomentToggleRow
                    annotation={moment}
                    selected={selectedIds.has(moment.id)}
                    onToggle={() => toggleMoment(moment.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </section>

      {/* Footer CTA */}
      <div className="shrink-0 p-4 border-t border-border/30 bg-muted/10">
        <Button
          className="w-full h-12 text-sm font-semibold gap-2"
          onClick={handleGenerate}
          disabled={selectedMoments.length === 0 || isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Film className="h-4 w-4" />
              Create {aspectRatio} Reel
              {selectedMoments.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {selectedMoments.length} clips
                </Badge>
              )}
            </>
          )}
        </Button>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Moments will be auto-ordered by timeline
        </p>
      </div>
    </div>
  );
}

export function CreateReelModal({
  open,
  onOpenChange,
  moments,
  sessionId,
  sessionTitle,
}: CreateReelModalProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Only show moments that are reel-worthy (kill, death, highlight)
  const reelMoments = useMemo(() => {
    return moments.filter(m => 
      ["kill", "death", "highlight"].includes(m.annotation_type)
    );
  }, [moments]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // No-op for now since we navigate away on create
    }
  }, [open]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleReelCreated = useCallback((reelId: string) => {
    // Close modal and navigate to Reel Editor
    onOpenChange(false);
    navigate(`/reel/${reelId}`);
  }, [onOpenChange, navigate]);

  const title = "Create Reel";

  const content = (
    <ReelCreatorContent
      moments={reelMoments}
      sessionId={sessionId}
      sessionTitle={sessionTitle}
      onReelCreated={handleReelCreated}
      onClose={handleClose}
    />
  );

  // Use Drawer on mobile, Dialog on desktop
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="pb-0">
            <DrawerTitle className="flex items-center gap-2 text-base">
              <Film className="h-5 w-5 text-primary" />
              {title}
            </DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Film className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
