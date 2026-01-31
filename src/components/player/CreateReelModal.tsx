import { useState, useMemo, useCallback, memo } from "react";
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
import { Switch } from "@/components/ui/switch";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

interface CreateReelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moments: Annotation[];
  sessionId: string;
  sessionTitle?: string;
}

type AspectRatio = "16:9" | "9:16" | "1:1";

const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { value: "16:9", label: "Landscape", icon: RectangleHorizontal, desc: "YouTube, Desktop" },
  { value: "9:16", label: "Portrait", icon: Smartphone, desc: "TikTok, Reels, Shorts" },
  { value: "1:1", label: "Square", icon: Square, desc: "Instagram, X" },
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

function ReelCreatorContent({
  moments,
  sessionTitle,
  onClose,
}: {
  moments: Annotation[];
  sessionTitle?: string;
  onClose: () => void;
}) {
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
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
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast.success("Reel created! Check your exports.", {
      description: `${selectedMoments.length} moments assembled into a ${aspectRatio} reel`,
    });
    
    setIsGenerating(false);
    onClose();
  }, [selectedMoments, aspectRatio, onClose]);

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

  // Only show moments that are reel-worthy (kill, death, highlight)
  const reelMoments = useMemo(() => {
    return moments.filter(m => 
      ["kill", "death", "highlight"].includes(m.annotation_type)
    );
  }, [moments]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Use Drawer on mobile, Dialog on desktop
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="pb-0">
            <DrawerTitle className="flex items-center gap-2 text-base">
              <Film className="h-5 w-5 text-primary" />
              Create Reel
            </DrawerTitle>
          </DrawerHeader>
          <ReelCreatorContent
            moments={reelMoments}
            sessionTitle={sessionTitle}
            onClose={handleClose}
          />
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
            Create Reel
          </DialogTitle>
        </DialogHeader>
        <ReelCreatorContent
          moments={reelMoments}
          sessionTitle={sessionTitle}
          onClose={handleClose}
        />
      </DialogContent>
    </Dialog>
  );
}
