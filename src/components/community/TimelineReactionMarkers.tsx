/**
 * TimelineReactionMarkers - Displays emoji reaction markers on video scrubber
 * Handles clustering, hover tooltips, and click-to-seek
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CommunityReaction,
  ReactionCluster,
  clusterReactions,
  ReactionType,
} from "@/lib/communityReactions";

interface TimelineReactionMarkersProps {
  reactions: CommunityReaction[];
  duration: number;
  currentUserId?: string;
  onSeek: (time: number) => void;
  className?: string;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TimelineReactionMarkers({
  reactions,
  duration,
  currentUserId,
  onSeek,
  className,
}: TimelineReactionMarkersProps) {
  const clusters = useMemo(
    () => clusterReactions(reactions, currentUserId, 2), // 2-second clusters
    [reactions, currentUserId]
  );

  if (clusters.length === 0 || duration <= 0) {
    return null;
  }

  return (
    <div className={cn("relative w-full h-6 pointer-events-none", className)}>
      {clusters.map((cluster, index) => (
        <ReactionMarker
          key={`${cluster.timestamp_seconds}-${index}`}
          cluster={cluster}
          duration={duration}
          onSeek={onSeek}
        />
      ))}
    </div>
  );
}

interface ReactionMarkerProps {
  cluster: ReactionCluster;
  duration: number;
  onSeek: (time: number) => void;
}

function ReactionMarker({ cluster, duration, onSeek }: ReactionMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const position = (cluster.timestamp_seconds / duration) * 100;

  // Take top 3 reactions to display
  const topReactions = cluster.reactions.slice(0, 3);
  const remainingCount = cluster.reactions
    .slice(3)
    .reduce((sum, r) => sum + r.count, 0);

  // Opacity/size based on density
  const intensity = Math.min(cluster.totalCount / 10, 1);
  const baseOpacity = 0.5 + intensity * 0.5;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          className={cn(
            "absolute top-1/2 -translate-y-1/2 pointer-events-auto",
            "flex items-center gap-px z-10",
            "hover:z-20 focus:outline-none cursor-pointer"
          )}
          style={{ left: `${position}%`, transform: "translate(-50%, -50%)" }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => onSeek(cluster.timestamp_seconds)}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
        >
          {/* Stacked emojis */}
          <div
            className="flex flex-col-reverse items-center gap-0"
            style={{ opacity: isHovered ? 1 : baseOpacity }}
          >
            {topReactions.map((reaction, idx) => (
              <motion.span
                key={reaction.type}
                className={cn(
                  "text-sm leading-none drop-shadow-sm",
                  idx > 0 && "-mt-1"
                )}
                initial={false}
                animate={{ scale: isHovered ? 1.1 : 1 }}
              >
                {reaction.type}
              </motion.span>
            ))}
          </div>

          {/* Remaining count badge */}
          {remainingCount > 0 && (
            <span className="text-[9px] font-medium text-muted-foreground ml-0.5">
              +{remainingCount}
            </span>
          )}

          {/* Glow effect on hover */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 -m-1 rounded-full bg-primary/20 blur-sm -z-10"
              />
            )}
          </AnimatePresence>
        </motion.button>
      </TooltipTrigger>

      <TooltipContent
        side="top"
        className="bg-background/95 backdrop-blur-md border-border/50 p-2"
      >
        <div className="space-y-1.5">
          <div className="text-xs font-mono text-muted-foreground">
            {formatTimestamp(cluster.timestamp_seconds)}
          </div>
          <div className="flex flex-wrap gap-2">
            {cluster.reactions.map((reaction) => (
              <div
                key={reaction.type}
                className={cn(
                  "flex items-center gap-1 text-sm",
                  reaction.userReacted && "text-primary"
                )}
              >
                <span>{reaction.type}</span>
                <span className="text-xs text-muted-foreground font-medium">
                  {reaction.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Annotation markers for written notes
 */
interface AnnotationMarker {
  id: string;
  timestamp_seconds: number;
  content: string;
}

interface TimelineAnnotationMarkersProps {
  annotations: AnnotationMarker[];
  duration: number;
  onSeek: (time: number) => void;
  className?: string;
}

export function TimelineAnnotationMarkers({
  annotations,
  duration,
  onSeek,
  className,
}: TimelineAnnotationMarkersProps) {
  if (annotations.length === 0 || duration <= 0) {
    return null;
  }

  return (
    <div className={cn("relative w-full h-4 pointer-events-none", className)}>
      {annotations.map((annotation) => {
        const position = (annotation.timestamp_seconds / duration) * 100;
        return (
          <Tooltip key={annotation.id}>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 pointer-events-auto",
                  "w-2 h-2 rounded-full bg-muted-foreground/60",
                  "hover:bg-primary hover:scale-150 transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50"
                )}
                style={{ left: `${position}%`, transform: "translate(-50%, -50%)" }}
                onClick={() => onSeek(annotation.timestamp_seconds)}
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-xs bg-background/95 backdrop-blur-md border-border/50"
            >
              <div className="text-xs font-mono text-muted-foreground mb-1">
                {formatTimestamp(annotation.timestamp_seconds)}
              </div>
              <p className="text-sm line-clamp-2">{annotation.content}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
