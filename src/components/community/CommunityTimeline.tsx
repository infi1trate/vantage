import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CommunityReaction, ReactionCluster, clusterReactions } from "@/lib/communityReactions";
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
  const overflow = cluster.total - displayEmojis.reduce((sum, r) => sum + r.count, 0);

  // Scale marker size based on reaction density
  const scale = Math.min(1.3, 0.8 + cluster.total * 0.05);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSeek(cluster.timestamp_seconds);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleClick}
          className="absolute -top-4 -translate-x-1/2 flex flex-col items-center gap-0.5 transition-all hover:scale-110 z-10"
          style={{ 
            left: `${position}%`,
            transform: `translateX(-50%) scale(${scale})`,
          }}
        >
          {/* Stacked emojis */}
          <div className="flex -space-x-1">
            {displayEmojis.map((r, i) => (
              <span
                key={i}
                className="text-sm drop-shadow-md"
                style={{ zIndex: 3 - i }}
              >
                {r.emoji}
              </span>
            ))}
          </div>
          {/* Connection line to timeline */}
          <div className="w-px h-2 bg-muted-foreground/20" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="p-2">
        <div className="text-xs space-y-1">
          <p className="font-mono text-muted-foreground">
            {formatTimestamp(cluster.timestamp_seconds)}
          </p>
          <div className="flex items-center gap-2">
            {cluster.reactions.map((r, i) => (
              <span key={i} className="flex items-center gap-0.5">
                <span>{r.emoji}</span>
                <span className="text-muted-foreground">{r.count}</span>
              </span>
            ))}
          </div>
          {overflow > 0 && (
            <p className="text-muted-foreground">+{overflow} more</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
