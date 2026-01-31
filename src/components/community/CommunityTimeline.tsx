import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CommunityReaction, ReactionCluster, clusterReactions, getReactionDensity } from "@/lib/communityReactions";
import { CommunityAnnotation } from "@/lib/community";
import { MessageSquare } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

interface CommunityTimelineProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  reactions: CommunityReaction[];
  annotations: CommunityAnnotation[];
  className?: string;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function CommunityTimeline({
  duration,
  currentTime,
  onSeek,
  reactions,
  annotations,
  className,
}: CommunityTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Cluster reactions for visualization
  const reactionClusters = useMemo(
    () => clusterReactions(reactions, 2),
    [reactions]
  );

  // Calculate reaction heat map for timeline background
  const reactionHeatGradient = useMemo(() => {
    if (reactions.length === 0 || duration <= 0) return "transparent";
    
    const density = getReactionDensity(reactions, duration, 5);
    if (density.length === 0) return "transparent";
    
    // Build gradient stops based on density
    const stops = density.map((d, i) => {
      const percent = (i / density.length) * 100;
      const alpha = Math.round(d * 0.25 * 100) / 100; // max 25% opacity
      return `rgba(var(--primary-rgb), ${alpha}) ${percent}%`;
    });
    
    return `linear-gradient(to right, ${stops.join(", ")})`;
  }, [reactions, duration]);

  const progressPercentage = (currentTime / duration) * 100;

  const getTimeFromPosition = useCallback(
    (clientX: number): number => {
      if (!trackRef.current || duration <= 0) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      return percentage * duration;
    },
    [duration]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const time = getTimeFromPosition(e.clientX);
    onSeek(time);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const time = getTimeFromPosition(e.clientX);
    setHoverTime(time);
    
    if (isDragging) {
      onSeek(time);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverTime(null);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    const touch = e.touches[0];
    const time = getTimeFromPosition(touch.clientX);
    onSeek(time);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const time = getTimeFromPosition(touch.clientX);
    onSeek(time);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMarkerClick = (timestamp: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onSeek(timestamp);
  };

  return (
    <div className={cn("relative w-full select-none", className)}>
      {/* Hover time indicator */}
      {hoverTime !== null && (
        <div
          className="absolute -top-6 px-1.5 py-0.5 bg-popover rounded text-[10px] font-mono text-muted-foreground pointer-events-none transform -translate-x-1/2"
          style={{ left: `${(hoverTime / duration) * 100}%` }}
        >
          {formatTimestamp(hoverTime)}
        </div>
      )}

      {/* Timeline track - increased touch target on mobile */}
      <div
        ref={trackRef}
        className={cn(
          "relative bg-muted/50 rounded-full cursor-pointer overflow-visible",
          isMobile ? "h-3" : "h-2"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Reaction heat map background */}
        {reactions.length > 0 && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none opacity-60"
            style={{ background: reactionHeatGradient }}
          />
        )}

        {/* Progress bar */}
        <div
          className="absolute top-0 left-0 h-full bg-primary/60 rounded-full pointer-events-none"
          style={{ width: `${progressPercentage}%` }}
        />

        {/* Playhead */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-lg shadow-primary/30 pointer-events-none z-20"
          style={{ left: `calc(${progressPercentage}% - 6px)` }}
        />

        {/* Annotation markers */}
        {annotations.map((annotation) => {
          const position = (annotation.timestamp_seconds / duration) * 100;
          return (
            <Tooltip key={annotation.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => handleMarkerClick(annotation.timestamp_seconds, e)}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/50 border border-border/50 flex items-center justify-center transition-all z-10 hover:scale-125"
                  style={{ left: `${position}%` }}
                >
                  <MessageSquare className="h-2 w-2 text-foreground/70" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <div className="text-xs">
                  <p className="font-mono text-muted-foreground mb-0.5">
                    {formatTimestamp(annotation.timestamp_seconds)}
                  </p>
                  <p className="line-clamp-2">{annotation.content}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {/* Reaction cluster markers */}
        {reactionClusters.map((cluster, idx) => (
          <ReactionClusterMarker
            key={idx}
            cluster={cluster}
            duration={duration}
            onSeek={onSeek}
          />
        ))}
      </div>
    </div>
  );
}

interface ReactionClusterMarkerProps {
  cluster: ReactionCluster;
  duration: number;
  onSeek: (time: number) => void;
}

function ReactionClusterMarker({
  cluster,
  duration,
  onSeek,
}: ReactionClusterMarkerProps) {
  const position = (cluster.timestamp_seconds / duration) * 100;
  const displayEmojis = cluster.reactions.slice(0, 3);
  const totalCount = cluster.total;

  // Scale marker based on reaction count for visual weight
  const intensity = Math.min(1, totalCount / 20); // caps at 20 reactions
  const glowIntensity = Math.round(intensity * 30);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSeek(cluster.timestamp_seconds);
  };

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          onClick={handleClick}
          className={cn(
            // Outer touch target: 44px minimum for accessibility
            "absolute -top-6 -translate-x-1/2 w-11 h-11 flex flex-col items-center justify-center transition-all z-10 group",
            "touch-manipulation"
          )}
          style={{ 
            left: `${position}%`,
          }}
        >
          {/* Visual indicator - smaller than touch target */}
          <div 
            className="flex -space-x-1.5 px-1.5 py-0.5 rounded-full bg-card/80 backdrop-blur-sm border border-border/40 shadow-sm transition-all group-hover:shadow-lg group-hover:scale-110 group-active:scale-95"
            style={{
              boxShadow: `0 0 ${glowIntensity}px rgba(var(--primary-rgb), 0.3)`,
            }}
          >
            {displayEmojis.map((r, i) => (
              <span
                key={i}
                className="text-sm drop-shadow-md transition-transform group-hover:scale-110"
                style={{ zIndex: 3 - i }}
              >
                {r.emoji}
              </span>
            ))}
            {/* Count badge */}
            {totalCount > 3 && (
              <span className="ml-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                +{totalCount - displayEmojis.reduce((sum, r) => sum + r.count, 0)}
              </span>
            )}
          </div>
          
          {/* Connection line to timeline */}
          <div className="w-px h-1.5 bg-primary/30 group-hover:bg-primary/60 transition-colors" />
        </button>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        className="p-3 max-w-[220px]"
        sideOffset={4}
      >
        <div className="space-y-2">
          <p className="font-mono text-[10px] text-muted-foreground">
            {formatTimestamp(cluster.timestamp_seconds)}
          </p>
          
          {/* Emoji breakdown with counts */}
          <div className="flex flex-wrap gap-2">
            {cluster.reactions.map((r, i) => (
              <div 
                key={i} 
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted/50"
              >
                <span className="text-base">{r.emoji}</span>
                <span className="text-xs font-medium text-muted-foreground">{r.count}</span>
              </div>
            ))}
          </div>
          
          {/* Total */}
          <p className="text-[11px] text-muted-foreground border-t border-border/30 pt-1.5">
            {totalCount} reaction{totalCount !== 1 ? 's' : ''} at this moment
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
