import { useState, useMemo, memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Annotation } from "@/lib/captures";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  Target,
  Skull,
  Star,
  ChevronRight,
  Trash2,
  Film,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateReelModal } from "../CreateReelModal";
import { useSessionReels } from "@/hooks/useReel";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  type ReelEligibilityResult, 
  getCreateReelDisabledTooltip,
} from "@/lib/reelEligibility";

interface MomentsSectionProps {
  annotations: Annotation[];
  currentTime: number;
  onAnnotationClick?: (annotation: Annotation) => void;
  onMarkerClick: (time: number) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  /** Centralized reel eligibility check result (single source of truth) */
  reelEligibility?: ReelEligibilityResult;
  /** Callback to navigate to Session Media panel */
  onViewSessionMedia?: () => void;
}

// Unified Moment type configuration
const MOMENT_CONFIG: Record<string, { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  color: string; 
  bg: string 
}> = {
  kill: { label: "Kill", icon: Target, color: "text-vantage-success", bg: "bg-vantage-success/10" },
  death: { label: "Death", icon: Skull, color: "text-destructive", bg: "bg-destructive/10" },
  highlight: { label: "Highlight", icon: Star, color: "text-vantage-warning", bg: "bg-vantage-warning/10" },
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatRange = (start: number, end: number) => {
  return `${formatTime(start)} – ${formatTime(end)}`;
};

// Memoized Moment row for scannable, calm presentation
const MomentRow = memo(function MomentRow({
  annotation,
  isActive,
  onClick,
  onDelete,
}: {
  annotation: Annotation;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const config = MOMENT_CONFIG[annotation.annotation_type] || MOMENT_CONFIG.highlight;
  const Icon = config.icon;
  
  return (
    <button
      className={cn(
        // Generous tap target for mobile (min-h-14)
        "w-full flex items-center gap-3 p-3 min-h-14 rounded-xl text-left transition-all group touch-manipulation",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        isActive 
          ? "bg-primary/10 border border-primary/30" 
          : "hover:bg-muted/30 active:bg-muted/40 border border-transparent"
      )}
      onClick={onClick}
    >
      {/* Event Icon */}
      <div className={cn(
        "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
        isActive ? "bg-primary/20" : config.bg
      )}>
        <Icon className={cn(
          "h-5 w-5",
          isActive ? "text-primary" : config.color
        )} />
      </div>
      
      {/* Event Label + Timestamp */}
      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-3">
        <span className={cn(
          "text-sm font-medium",
          isActive ? "text-primary" : config.color
        )}>
          {config.label}
        </span>
        <span className="text-xs font-mono tabular-nums text-muted-foreground">
          {annotation.end_timestamp_seconds 
            ? formatRange(annotation.timestamp_seconds, annotation.end_timestamp_seconds)
            : formatTime(annotation.timestamp_seconds)
          }
        </span>
      </div>
      
      {/* Delete action - visible on mobile via active state, hover on desktop */}
      <div className="shrink-0 flex items-center gap-1">
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 transition-opacity touch-manipulation",
              // Always visible on mobile when active, hover-reveal on desktop
              isActive 
                ? "opacity-100" 
                : "opacity-0 group-hover:opacity-100 sm:opacity-0"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete moment"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        )}
        <ChevronRight className={cn(
          "h-4 w-4 transition-opacity hidden sm:block",
          isActive ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-40 text-muted-foreground"
        )} />
      </div>
    </button>
  );
});

export const HighlightsSection = memo(function HighlightsSection({
  annotations,
  currentTime,
  onAnnotationClick,
  onMarkerClick,
  onAnnotationDelete,
  sessionId = "",
  sessionTitle,
  reelEligibility = { ok: true },
  onViewSessionMedia,
}: MomentsSectionProps) {
  const [reelModalOpen, setReelModalOpen] = useState(false);
  const navigate = useNavigate();
  
  // Fetch existing reels for this session
  const { data: sessionReels } = useSessionReels(sessionId || undefined);
  
  // Determine if reel creation is possible using centralized eligibility
  const canCreateReel = reelEligibility.ok;
  const disabledTooltip = !canCreateReel && reelEligibility.reasonCode 
    ? getCreateReelDisabledTooltip(reelEligibility.reasonCode) 
    : "Session video not available yet";
  // Sort moments chronologically
  const moments = useMemo(() => {
    return [...annotations].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
  }, [annotations]);

  // Find active moment based on current playback time
  const activeMomentId = useMemo(() => {
    const tolerance = 0.5;
    const active = moments.find(item => {
      if (item.end_timestamp_seconds) {
        return currentTime >= item.timestamp_seconds - tolerance && 
               currentTime <= item.end_timestamp_seconds + tolerance;
      }
      return Math.abs(currentTime - item.timestamp_seconds) <= tolerance;
    });
    return active?.id;
  }, [moments, currentTime]);

  const handleMomentClick = useCallback((annotation: Annotation) => {
    onAnnotationClick?.(annotation) ?? onMarkerClick(annotation.timestamp_seconds);
  }, [onAnnotationClick, onMarkerClick]);

  if (moments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-vantage-warning/10 flex items-center justify-center">
          <Star className="h-7 w-7 text-vantage-warning/50" />
        </div>
        <h4 className="font-semibold mb-2">No moments tagged yet</h4>
        <p className="text-sm text-muted-foreground max-w-xs">
          Tag kills, deaths, and highlights to jump to key points. Your full session is always preserved.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Create Reel CTA - prominent but not overwhelming */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-border/20">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full h-auto py-2.5 gap-2 transition-all group flex-col items-start",
                  canCreateReel
                    ? "bg-gradient-to-r from-primary/5 via-transparent to-accent/5 border-primary/20 hover:border-primary/40 hover:bg-primary/10"
                    : "bg-muted/30 border-border/50 opacity-60 cursor-not-allowed"
                )}
                onClick={() => canCreateReel && setReelModalOpen(true)}
                disabled={!canCreateReel}
              >
                <div className="flex items-center gap-2 w-full">
                  {canCreateReel ? (
                    <Sparkles className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">Create Reel</span>
                  <Film className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                </div>
                <span className="text-[11px] text-muted-foreground font-normal pl-6">
                  {canCreateReel 
                    ? "Edit clips, add effects, and export"
                    : disabledTooltip
                  }
                </span>
              </Button>
            </div>
          </TooltipTrigger>
          {!canCreateReel && (
            <TooltipContent side="bottom" className="max-w-[200px]">
              <p className="text-xs">
                {disabledTooltip}. Reel creation will be available once the video is ready.
              </p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* Existing Reels */}
      {sessionReels && sessionReels.length > 0 && (
        <div className="shrink-0 px-3 pt-2 pb-1 border-b border-border/20">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Reels ({sessionReels.length})
          </p>
          <div className="space-y-1 pb-1">
            {sessionReels.map((reel) => (
              <button
                key={reel.id}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/30 active:bg-muted/40 transition-colors text-left group touch-manipulation"
                onClick={() => navigate(`/reel/${reel.id}`)}
              >
                <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <Film className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{reel.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {reel.aspect_ratio} • {reel.status}
                  </p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable moment list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          <div className="space-y-1">
            {moments.map((annotation) => (
              <MomentRow
                key={annotation.id}
                annotation={annotation}
                isActive={annotation.id === activeMomentId}
                onClick={() => handleMomentClick(annotation)}
                onDelete={onAnnotationDelete ? () => onAnnotationDelete(annotation.id) : undefined}
              />
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Create Reel Modal */}
      <CreateReelModal
        open={reelModalOpen}
        onOpenChange={setReelModalOpen}
        moments={moments}
        sessionId={sessionId}
        sessionTitle={sessionTitle}
        reelEligibility={reelEligibility}
        onViewSessionMedia={onViewSessionMedia}
      />
    </div>
  );
});
