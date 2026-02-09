import { useState, useMemo, useCallback, memo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Annotation } from "@/lib/captures";
import { createReel, AspectRatio, ReelSourceNotReadyError } from "@/lib/reels";
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
import { PageTransitionOverlay } from "@/components/reel/PageTransitionOverlay";
import { 
  type ReelEligibilityResult,
  type ReelIneligibilityReason, 
  getReelIneligibilityMessage,
} from "@/lib/reelEligibility";
import { 
  startLegacyBackfill, 
  checkReelSourceReadiness,
} from "@/lib/reelSource";
import { useRefreshSessionMediaStatus } from "@/hooks/useSessionQueries";

// ============= Reason-specific toast messages =============

interface ReasonToastConfig {
  title: string;
  description: string;
  showSessionMediaCTA: boolean;
}

function getReasonToastConfig(reasonCode: ReelIneligibilityReason | undefined): ReasonToastConfig {
  switch (reasonCode) {
    case "video_processing":
      return {
        title: "Video still processing",
        description: "Session video is still processing — we'll start as soon as it's ready.",
        showSessionMediaCTA: true,
      };
    case "video_uploading":
      return {
        title: "Video still uploading",
        description: "Session video is still uploading — please wait a moment.",
        showSessionMediaCTA: true,
      };
    case "video_failed":
      return {
        title: "Video processing failed",
        description: "Session video failed to process — open Session Media to retry.",
        showSessionMediaCTA: true,
      };
    case "video_missing":
      return {
        title: "No recording",
        description: "This session doesn't have a gameplay recording.",
        showSessionMediaCTA: true,
      };
    case "unknown":
    default:
      return {
        title: "Cannot verify video",
        description: "We couldn't verify the session video.",
        showSessionMediaCTA: true,
      };
  }
}

/**
 * Map readiness message to reason code for consistent error handling
 */
function inferReasonFromMessage(message: string): ReelIneligibilityReason {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes("processing")) return "video_processing";
  if (lowerMessage.includes("uploading")) return "video_uploading";
  if (lowerMessage.includes("failed")) return "video_failed";
  if (lowerMessage.includes("no recording") || lowerMessage.includes("no video") || lowerMessage.includes("missing")) return "video_missing";
  return "unknown";
}

interface CreateReelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moments: Annotation[];
  sessionId: string;
  sessionTitle?: string;
  /** Centralized reel eligibility check result (single source of truth) */
  reelEligibility?: ReelEligibilityResult;
  /** Navigate to Session Media panel to check/retry video */
  onViewSessionMedia?: () => void;
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

// Memoized moment toggle row - aligned grid: checkbox | icon | label | timestamp
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
        "w-full grid grid-cols-[20px_20px_1fr_auto] items-center gap-3 px-3 py-2.5 h-11 rounded-lg text-left transition-all touch-manipulation",
        selected 
          ? "bg-primary/10 border border-primary/30" 
          : "bg-muted/20 border border-transparent opacity-60 hover:opacity-80 active:opacity-100"
      )}
      onClick={onToggle}
    >
      {/* Checkbox indicator */}
      <div className={cn(
        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
        selected 
          ? "bg-primary border-primary" 
          : "border-muted-foreground/40"
      )}>
        {selected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>

      {/* Event Icon */}
      <Icon className={cn("h-4 w-4", config.color)} />
      
      {/* Label */}
      <span className="text-sm font-medium truncate">
        {config.label}
      </span>
      
      {/* Timestamp */}
      <span className="text-xs font-mono tabular-nums text-muted-foreground">
        {formatTime(annotation.timestamp_seconds)}
      </span>
    </button>
  );
});

// Aspect ratio button - clear active state with glow + consistent sizing
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
        "flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all w-[100px] h-[88px]",
        selected 
          ? "bg-primary/15 ring-2 ring-primary shadow-[0_0_12px_-2px_hsl(var(--primary)/0.4)]" 
          : "bg-muted/30 hover:bg-muted/50 border border-transparent"
      )}
      onClick={onClick}
    >
      <Icon className={cn(
        "h-6 w-6 transition-colors",
        selected ? "text-primary" : "text-muted-foreground"
      )} />
      <div className="text-center">
        <p className={cn(
          "text-xs font-semibold transition-colors",
          selected ? "text-primary" : "text-foreground"
        )}>
          {ratio.label}
        </p>
        <p className="text-[10px] text-muted-foreground leading-tight">
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
  onViewSessionMedia,
  reelEligibility,
}: {
  moments: Annotation[];
  sessionId: string;
  sessionTitle?: string;
  onReelCreated: (reelId: string) => void;
  onClose: () => void;
  onViewSessionMedia?: () => void;
  reelEligibility: ReelEligibilityResult;
}) {
  // Default to 16:9 (Landscape) as per UX requirement
  const [aspectRatio, setAspectRatio] = useState<AspectRatioValue>("16:9");
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

  // State for legacy backfill preparation
  const [isPreparingLegacy, setIsPreparingLegacy] = useState(false);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  
  // Hook to refresh session media status before eligibility check
  const refreshMediaStatus = useRefreshSessionMediaStatus();

  const handleGenerate = useCallback(async () => {
    if (selectedMoments.length === 0) {
      toast.error("Select at least one moment");
      return;
    }

    console.log("[CreateReel] Starting reel generation", {
      sessionId,
      momentCount: selectedMoments.length,
      aspectRatio,
    });

    setIsGenerating(true);
    setPreparationError(null);
    
    try {
      // 0) Refresh session media status to ensure we have fresh data
      // This ensures Session Media and Create Reel see the same state
      console.log("[CreateReel] Refreshing session media status...");
      const freshMediaStatus = await refreshMediaStatus(sessionId);
      console.log("[CreateReel] Fresh media status:", freshMediaStatus);
      
      // 1) Check current ReelSource readiness (will also see fresh data)
      console.log("[CreateReel] Checking ReelSource readiness...");
      const readiness = await checkReelSourceReadiness(sessionId);
      console.log("[CreateReel] Readiness result:", readiness);
      
      // 2) If ready, proceed directly
      if (readiness.isReady) {
        console.log("[CreateReel] ReelSource ready, creating reel...");
        const reel = await createReel({
          sessionId,
          title: sessionTitle ? `${sessionTitle} Reel` : "Untitled Reel",
          aspectRatio: aspectRatio as AspectRatio,
          momentIds: Array.from(selectedIds),
        });
        console.log("[CreateReel] Reel created successfully:", reel.id);
        onReelCreated(reel.id);
        return;
      }
      
      // 3) If legacy session with video but no ReelSource, trigger backfill
      if (readiness.isLegacy && readiness.videoUrl) {
        console.log("[CreateReel] Legacy session detected, starting backfill...");
        setIsPreparingLegacy(true);
        
        // Start backfill
        const backfillResult = await startLegacyBackfill(sessionId);
        
        if (!backfillResult.success) {
          console.error("[CreateReel] Backfill failed:", backfillResult.message);
          setPreparationError(backfillResult.message);
          setIsPreparingLegacy(false);
          setIsGenerating(false);
          return;
        }
        
        // Backfill succeeded, now create the reel
        console.log("[CreateReel] Backfill complete, creating reel...");
        setIsPreparingLegacy(false);
        
        const reel = await createReel({
          sessionId,
          title: sessionTitle ? `${sessionTitle} Reel` : "Untitled Reel",
          aspectRatio: aspectRatio as AspectRatio,
          momentIds: Array.from(selectedIds),
        });
        console.log("[CreateReel] Reel created successfully after backfill:", reel.id);
        onReelCreated(reel.id);
        return;
      }
      
      // 4) Not ready - show reason-specific error with CTA
      console.error("[CreateReel] No video available:", readiness.message);
      const reasonCode = inferReasonFromMessage(readiness.message);
      const toastConfig = getReasonToastConfig(reasonCode);
      
      toast.error(toastConfig.title, {
        description: toastConfig.description,
        action: toastConfig.showSessionMediaCTA && onViewSessionMedia ? {
          label: "Check session video",
          onClick: onViewSessionMedia,
        } : undefined,
      });
      setIsGenerating(false);
      
    } catch (error) {
      console.error("[CreateReel] Failed to create reel:", error);
      
      // Log detailed error info for debugging
      if (error instanceof Error) {
        console.error("[CreateReel] Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      }
      
      // Handle ReelSource not ready (legacy backfill failed or no video)
      if (error instanceof ReelSourceNotReadyError) {
        const reasonCode = inferReasonFromMessage(error.userMessage || error.message);
        const toastConfig = getReasonToastConfig(reasonCode);
        
        toast.error(toastConfig.title, {
          description: toastConfig.description,
          action: toastConfig.showSessionMediaCTA && onViewSessionMedia ? {
            label: "Check session video",
            onClick: onViewSessionMedia,
          } : undefined,
        });
      } else {
        toast.error("Failed to create reel", {
          description: error instanceof Error ? error.message : "Please try again",
          action: {
            label: "Retry",
            onClick: () => handleGenerate(),
          },
        });
      }
      setIsPreparingLegacy(false);
      setIsGenerating(false);
    }
  }, [selectedMoments, selectedIds, aspectRatio, sessionId, sessionTitle, onReelCreated, onViewSessionMedia, refreshMediaStatus]);

  // If no moments available, show a clear empty state
  if (sortedMoments.length === 0) {
    return (
      <div className="flex flex-col h-full max-h-[80vh] md:max-h-[600px]">
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="h-8 w-8 text-primary/60" />
          </div>
          <div className="space-y-2 max-w-xs">
            <p className="text-sm font-semibold text-foreground">No moments tagged yet</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tag gameplay moments (Kill, Death, Highlight) on the timeline first. 
              Reels are assembled from your tagged moments.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="mt-2">
            Go back and tag moments
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[80vh] md:max-h-[600px]">
      {/* AI Badge - consistent padding, never overlaps content */}
      <div className="shrink-0 px-4 pt-3 pb-3">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-medium text-primary">
            AI assembled this for you
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0 tabular-nums">
            ~{Math.ceil(estimatedDuration)}s
          </span>
        </div>
      </div>

      {/* Aspect Ratio Selection */}
      <section className="shrink-0 px-4 pb-4">
        <h4 className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wide mb-3">
          Format
        </h4>
        <div className="flex gap-2 justify-center flex-wrap sm:flex-nowrap">
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
        <div className="shrink-0 px-4 py-3 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          <h4 className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wide whitespace-nowrap">
            Moments ({selectedMoments.length}/{sortedMoments.length})
          </h4>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={selectAll}
              disabled={selectedIds.size === moments.length}
            >
              Select all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2.5"
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

      {/* Preparation Error Banner */}
      {preparationError && (
        <div className="shrink-0 mx-4 mb-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Preparation failed</p>
              <p className="text-xs text-muted-foreground mt-0.5">{preparationError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer CTA - dynamic text based on format */}
      <div className="shrink-0 p-4 border-t border-border/30 bg-muted/10">
        <Button
          className="w-full h-12 text-sm font-semibold gap-2"
          onClick={handleGenerate}
          disabled={selectedMoments.length === 0 || isGenerating}
        >
          {isPreparingLegacy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing recording (one-time)...
            </>
          ) : isGenerating ? (
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
        <p className="text-[11px] text-muted-foreground text-center mt-2.5">
          {isPreparingLegacy 
            ? "This older recording needs one-time preparation for reels."
            : "You'll be taken to the Reel Editor next."
          }
        </p>
        
        {/* Dev-only eligibility debug info */}
        {import.meta.env.DEV && (
          <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5 font-mono">
            Eligibility: {reelEligibility.ok ? "OK" : "blocked"} 
            {reelEligibility.ok && reelEligibility.details && (
              <span>
                {" "}({reelEligibility.details.isLegacy ? "legacy" : 
                  reelEligibility.details.hasScreenVideo && reelEligibility.details.screenVideoStatus === "ready" ? "screenVideo.ready" :
                  reelEligibility.details.reelSourceStatus === "ready" ? "reelSource.ready" :
                  reelEligibility.details.hasVideoUrl ? "videoUrl" : "unknown"})
              </span>
            )}
            {!reelEligibility.ok && reelEligibility.reasonCode && (
              <span> ({reelEligibility.reasonCode})</span>
            )}
          </p>
        )}
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
  reelEligibility = { ok: true },
  onViewSessionMedia,
}: CreateReelModalProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Use centralized eligibility check
  const videoAvailable = reelEligibility.ok;
  
  // Get reason-specific messaging
  const toastConfig = !reelEligibility.ok && reelEligibility.reasonCode
    ? getReasonToastConfig(reelEligibility.reasonCode)
    : getReasonToastConfig("unknown");

  // Only show moments that are reel-worthy (kill, death, highlight)
  const reelMoments = useMemo(() => {
    return moments.filter(m => 
      ["kill", "death", "highlight"].includes(m.annotation_type)
    );
  }, [moments]);

  // Transition state for smooth mode change
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pendingReelId, setPendingReelId] = useState<string | null>(null);

  // Reset state when modal closes — but NOT if a transition is active
  useEffect(() => {
    if (!open && !isTransitioning) {
      setPendingReelId(null);
    }
  }, [open, isTransitioning]);

  // Cleanup on unmount - ensure overlay doesn't stay stuck
  useEffect(() => {
    return () => {
      setIsTransitioning(false);
      setPendingReelId(null);
    };
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleReelCreated = useCallback((reelId: string) => {
    console.log("[CreateReelModal] Reel created, starting transition to:", reelId);
    // Set transition state BEFORE closing modal to prevent cleanup effect from clearing it
    setPendingReelId(reelId);
    setIsTransitioning(true);
    // Defer modal close so transition state is established first
    setTimeout(() => onOpenChange(false), 0);
  }, [onOpenChange]);

  const handleTransitionComplete = useCallback(() => {
    if (pendingReelId) {
      console.log("[CreateReelModal] Transition complete, navigating to:", pendingReelId);
      navigate(`/reel/${pendingReelId}`);
    } else {
      console.error("[CreateReelModal] Transition complete but no pending reel ID");
      setIsTransitioning(false);
    }
  }, [pendingReelId, navigate]);

  // Handle transition timeout - cleanup and let user recover
  const handleTransitionTimeout = useCallback(() => {
    console.error("[CreateReelModal] Transition timed out, cleaning up");
    setIsTransitioning(false);
    setPendingReelId(null);
  }, []);

  const handleViewSessionMedia = useCallback(() => {
    onOpenChange(false);
    onViewSessionMedia?.();
  }, [onOpenChange, onViewSessionMedia]);

  const title = videoAvailable ? "Create Reel" : toastConfig.title;

  // Video not available - show fallback modal with specific reason
  const fallbackContent = (
    <div className="flex flex-col items-center justify-center p-6 gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-vantage-warning/10 flex items-center justify-center">
        <AlertCircle className="h-8 w-8 text-vantage-warning" />
      </div>
      <div className="space-y-2 max-w-xs">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {toastConfig.description}
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-[200px] pt-2">
        {toastConfig.showSessionMediaCTA && onViewSessionMedia && (
          <Button onClick={handleViewSessionMedia} className="w-full">
            Check session video
          </Button>
        )}
        <Button variant="outline" onClick={handleClose} className="w-full">
          Close
        </Button>
      </div>
    </div>
  );

  const content = videoAvailable ? (
    <ReelCreatorContent
      moments={reelMoments}
      sessionId={sessionId}
      sessionTitle={sessionTitle}
      onReelCreated={handleReelCreated}
      onClose={handleClose}
      onViewSessionMedia={onViewSessionMedia}
      reelEligibility={reelEligibility}
    />
  ) : fallbackContent;

  // Use Drawer on mobile, Dialog on desktop
  if (isMobile) {
    return (
      <>
        <PageTransitionOverlay
          isActive={isTransitioning}
          onFadeInComplete={handleTransitionComplete}
          onTimeout={handleTransitionTimeout}
        />
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="pb-0">
              <DrawerTitle className="flex items-center gap-2 text-base">
                {videoAvailable ? (
                  <Film className="h-5 w-5 text-primary" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-vantage-warning" />
                )}
                {title}
              </DrawerTitle>
            </DrawerHeader>
            {content}
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <>
      <PageTransitionOverlay
        isActive={isTransitioning}
        onFadeInComplete={handleTransitionComplete}
        onTimeout={handleTransitionTimeout}
      />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              {videoAvailable ? (
                <Film className="h-5 w-5 text-primary" />
              ) : (
                <AlertCircle className="h-5 w-5 text-vantage-warning" />
              )}
              {title}
            </DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    </>
  );
}
