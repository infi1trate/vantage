import { useState, useMemo, useCallback, memo, useRef, useEffect } from "react";
import { Annotation } from "@/lib/captures";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { AspectRatio } from "@/components/ui/aspect-ratio";

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

// Export status type
type ExportStatus = "idle" | "exporting" | "complete" | "error";

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
  
  // Export state
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [exportProgress, setExportProgress] = useState(0);

  const ratioConfig = ASPECT_RATIOS.find(r => r.value === reel.aspectRatio) || ASPECT_RATIOS[0];
  const AspectIcon = ratioConfig.icon;

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

  // Export with inline progress
  const handleExport = useCallback(async () => {
    if (exportStatus === "exporting") return;
    
    setExportStatus("exporting");
    setExportProgress(0);
    
    // Simulate export progress (replace with actual export logic)
    const progressInterval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 15;
      });
    }, 200);
    
    try {
      // Simulate export time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      clearInterval(progressInterval);
      setExportProgress(100);
      setExportStatus("complete");
      
      toast.success("Reel exported!", {
        description: "Your reel is ready to share",
      });
    } catch (error) {
      clearInterval(progressInterval);
      setExportStatus("error");
      toast.error("Export failed", {
        description: "Please try again",
      });
    }
  }, [exportStatus]);

  // Share link
  const handleShareLink = useCallback(async () => {
    // In production, this would copy a share link
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

  return (
    <div className="flex flex-col h-full max-h-[85vh] md:max-h-[650px]">
      {/* AI-generated header - clear labeling */}
      <div className="shrink-0 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-primary">
            AI-generated Reel
          </span>
          <Badge 
            variant="secondary" 
            className="ml-auto text-[10px] bg-muted/50"
          >
            {reel.momentCount} clips • {formatDuration(reel.duration)}
          </Badge>
        </div>
      </div>

      {/* Video Preview - no timeline, no scrubbing */}
      <div className="flex-1 min-h-0 px-4 py-2 flex items-center justify-center">
        <div 
          className={cn(
            "relative w-full max-w-full overflow-hidden rounded-xl bg-black shadow-2xl",
            reel.aspectRatio === "9:16" && "max-w-[280px]",
            reel.aspectRatio === "1:1" && "max-w-[320px]",
            reel.aspectRatio === "16:9" && "max-w-full"
          )}
        >
          <AspectRatio ratio={ratioConfig.ratio}>
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
              
              {/* Visual placeholder */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200",
                  isPlaying 
                    ? "bg-primary/10 backdrop-blur-sm" 
                    : "bg-white/90 shadow-lg"
                )}>
                  {isPlaying ? (
                    <Film className="h-8 w-8 text-primary animate-pulse" />
                  ) : (
                    <Play className="h-8 w-8 text-background ml-1" />
                  )}
                </div>
                {!isPlaying && (
                  <p className="text-xs text-muted-foreground">
                    {isMobile ? "Tap to play" : "Click to play"}
                  </p>
                )}
              </div>

              {/* Minimal overlay controls - only mute toggle */}
              {isPlaying && (
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <button
                    className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm transition-transform active:scale-95 touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                  >
                    {isMuted ? (
                      <VolumeX className="h-4 w-4 text-white" />
                    ) : (
                      <Volume2 className="h-4 w-4 text-white" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </AspectRatio>

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

      {/* Footer actions with export progress */}
      <div className="shrink-0 p-4 border-t border-border/30 bg-muted/10">
        {/* Export progress indicator */}
        {exportStatus === "exporting" && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-foreground">Exporting reel...</span>
              <span className="text-xs font-mono text-muted-foreground">{Math.round(exportProgress)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-200 ease-out"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Export complete state */}
        {exportStatus === "complete" && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-vantage-success/10 border border-vantage-success/20">
            <CheckCircle2 className="h-4 w-4 text-vantage-success" />
            <span className="text-xs font-medium text-vantage-success">
              Export complete!
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {exportStatus === "complete" ? (
            <>
              {/* After export: Share link becomes primary */}
              <Button
                size="lg"
                className="flex-1 h-12 gap-2"
                onClick={handleShareLink}
              >
                <Share2 className="h-4 w-4" />
                Share Link
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 gap-2 px-4"
                onClick={onClose}
              >
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">Done</span>
              </Button>
            </>
          ) : (
            <>
              {/* Primary: Export Reel */}
              <Button
                size="lg"
                className="flex-1 h-12 gap-2"
                onClick={handleExport}
                disabled={exportStatus === "exporting"}
              >
                {exportStatus === "exporting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export Reel
                  </>
                )}
              </Button>
              
              {/* Secondary: Share Link */}
              <Button
                variant="outline"
                size="lg"
                className="h-12 gap-2 px-4"
                onClick={handleShareLink}
                disabled={exportStatus === "exporting"}
              >
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </>
          )}
        </div>
        
        {/* Back link */}
        <button
          className="w-full mt-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1 touch-manipulation"
          onClick={onBack}
          disabled={exportStatus === "exporting"}
        >
          <ArrowLeft className="h-3 w-3" />
          Create another reel
        </button>
      </div>
    </div>
  );
}

function ReelCreatorContent({
  moments,
  sessionTitle,
  onGenerated,
  onClose,
}: {
  moments: Annotation[];
  sessionTitle?: string;
  onGenerated: (reel: GeneratedReel) => void;
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
    
    // Simulate generation (replace with actual API call)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Transition to preview
    onGenerated({
      aspectRatio,
      duration: estimatedDuration,
      momentCount: selectedMoments.length,
    });
  }, [selectedMoments, aspectRatio, estimatedDuration, onGenerated]);

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
  const [step, setStep] = useState<ModalStep>("create");
  const [generatedReel, setGeneratedReel] = useState<GeneratedReel | null>(null);

  // Only show moments that are reel-worthy (kill, death, highlight)
  const reelMoments = useMemo(() => {
    return moments.filter(m => 
      ["kill", "death", "highlight"].includes(m.annotation_type)
    );
  }, [moments]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Small delay to avoid visual glitch during close animation
      const timer = setTimeout(() => {
        setStep("create");
        setGeneratedReel(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleGenerated = useCallback((reel: GeneratedReel) => {
    setGeneratedReel(reel);
    setStep("preview");
  }, []);

  const handleBack = useCallback(() => {
    setStep("create");
    setGeneratedReel(null);
  }, []);

  const title = step === "create" ? "Create Reel" : "Your Reel";

  const content = step === "preview" && generatedReel ? (
    <ReelPreviewContent
      reel={generatedReel}
      onBack={handleBack}
      onClose={handleClose}
    />
  ) : (
    <ReelCreatorContent
      moments={reelMoments}
      sessionTitle={sessionTitle}
      onGenerated={handleGenerated}
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
