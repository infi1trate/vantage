import { useMemo, useCallback, memo } from "react";
import { TimelineEvent, Annotation, VoiceNote } from "@/lib/captures";
import { 
  Crosshair, 
  Skull, 
  Target, 
  Star, 
  Flag, 
  Mic, 
  MessageSquare,
  Zap,
  Trophy,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineTrack {
  id: string;
  name: string;
  type: "events" | "annotations" | "voice" | "audio";
  color: string;
  items: TimelineItem[];
}

interface TimelineItem {
  id: string;
  startTime: number;
  endTime?: number;
  label: string;
  type: string;
  color: string;
  icon?: React.ReactNode;
}

interface LayeredTimelineProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  events?: TimelineEvent[];
  annotations?: Annotation[];
  voiceNotes?: VoiceNote[];
  showTracks?: {
    events?: boolean;
    annotations?: boolean;
    voice?: boolean;
  };
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  kill: <Crosshair className="h-3 w-3" />,
  death: <Skull className="h-3 w-3" />,
  assist: <Target className="h-3 w-3" />,
  headshot: <Zap className="h-3 w-3" />,
  multikill: <Trophy className="h-3 w-3" />,
  ace: <Star className="h-3 w-3" />,
  clutch: <Trophy className="h-3 w-3" />,
  round_win: <Flag className="h-3 w-3" />,
  round_loss: <AlertTriangle className="h-3 w-3" />,
};

const EVENT_COLORS: Record<string, string> = {
  kill: "bg-vantage-success",
  death: "bg-destructive",
  assist: "bg-primary",
  headshot: "bg-vantage-warning",
  multikill: "bg-accent",
  ace: "bg-accent",
  clutch: "bg-vantage-purple",
  round_win: "bg-vantage-success",
  round_loss: "bg-destructive",
  highlight: "bg-vantage-warning",
  marker: "bg-primary",
  note: "bg-muted-foreground",
  objective: "bg-accent",
};

// Memoized track item to prevent re-renders
const TrackItem = memo(function TrackItem({
  item,
  duration,
  onSeek,
}: {
  item: TimelineItem;
  duration: number;
  onSeek: (time: number) => void;
}) {
  const startPercent = (item.startTime / duration) * 100;
  const endPercent = item.endTime 
    ? ((item.endTime - item.startTime) / duration) * 100 
    : 1;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSeek(item.startTime);
  }, [item.startTime, onSeek]);

  return (
    <div
      className={cn(
        "absolute top-1 h-4 rounded-sm flex items-center justify-center",
        "hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer z-10",
        item.color
      )}
      style={{
        left: `${startPercent}%`,
        width: item.endTime ? `${endPercent}%` : "16px",
        minWidth: "16px",
      }}
      onClick={handleClick}
      title={item.label}
    >
      {item.icon && (
        <span className="text-white drop-shadow-sm">
          {item.icon}
        </span>
      )}
    </div>
  );
});

// Memoized playhead - uses ref to avoid re-renders
const Playhead = memo(function Playhead({ 
  percentage 
}: { 
  percentage: number;
}) {
  return (
    <div 
      className="absolute top-0 w-0.5 h-full bg-primary z-20 pointer-events-none"
      style={{ left: `${percentage}%` }}
    />
  );
});

export function LayeredTimeline({
  duration,
  currentTime,
  onSeek,
  events = [],
  annotations = [],
  voiceNotes = [],
  showTracks = { events: true, annotations: true, voice: true },
}: LayeredTimelineProps) {
  // Build tracks from data
  const tracks = useMemo<TimelineTrack[]>(() => {
    const result: TimelineTrack[] = [];

    // Events track
    if (showTracks.events && events.length > 0) {
      result.push({
        id: "events",
        name: "Events",
        type: "events",
        color: "hsl(var(--primary))",
        items: events.map((event) => ({
          id: event.id,
          startTime: event.timestamp_ms / 1000,
          endTime: event.duration_ms ? (event.timestamp_ms + event.duration_ms) / 1000 : undefined,
          label: event.title || event.event_type,
          type: event.event_type,
          color: EVENT_COLORS[event.event_type] || "bg-primary",
          icon: EVENT_ICONS[event.event_type],
        })),
      });
    }

    // Annotations track
    if (showTracks.annotations && annotations.length > 0) {
      result.push({
        id: "annotations",
        name: "Annotations",
        type: "annotations",
        color: "hsl(var(--accent))",
        items: annotations.map((annotation) => ({
          id: annotation.id,
          startTime: annotation.timestamp_seconds,
          endTime: annotation.end_timestamp_seconds || undefined,
          label: annotation.title || annotation.annotation_type,
          type: annotation.annotation_type,
          color: EVENT_COLORS[annotation.annotation_type] || "bg-primary",
          icon: <MessageSquare className="h-3 w-3" />,
        })),
      });
    }

    // Voice notes track
    if (showTracks.voice && voiceNotes.length > 0) {
      result.push({
        id: "voice",
        name: "Voice Notes",
        type: "voice",
        color: "hsl(var(--accent))",
        items: voiceNotes.map((note) => ({
          id: note.id,
          startTime: note.timestamp_seconds,
          endTime: note.timestamp_seconds + note.duration_seconds,
          label: note.transcription?.slice(0, 30) || "Voice note",
          type: "voice",
          color: "bg-accent",
          icon: <Mic className="h-3 w-3" />,
        })),
      });
    }

    return result;
  }, [events, annotations, voiceNotes, showTracks]);

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>, trackElement: HTMLDivElement) => {
    const rect = trackElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;
    onSeek(Math.max(0, Math.min(duration, time)));
  }, [duration, onSeek]);

  const progressPercentage = (currentTime / duration) * 100;

  return (
    <div className="space-y-1">
      {tracks.map((track) => (
        <div key={track.id} className="flex items-center gap-2">
          {/* Track label */}
          <div className="w-20 shrink-0 text-xs text-muted-foreground truncate">
            {track.name}
          </div>
          
          {/* Track content */}
          <div
            className="relative flex-1 h-6 bg-muted/30 rounded cursor-pointer group"
            onClick={(e) => handleTrackClick(e, e.currentTarget)}
          >
            {/* Progress indicator */}
            <div 
              className="absolute top-0 left-0 h-full bg-primary/10 rounded-l pointer-events-none"
              style={{ width: `${progressPercentage}%` }}
            />
            
            {/* Playhead - memoized */}
            <Playhead percentage={progressPercentage} />

            {/* Items - memoized components */}
            {track.items.map((item) => (
              <TrackItem
                key={item.id}
                item={item}
                duration={duration}
                onSeek={onSeek}
              />
            ))}

            {/* Empty state */}
            {track.items.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-muted-foreground/50">No items</span>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Empty state for no tracks */}
      {tracks.length === 0 && (
        <div className="h-12 flex items-center justify-center text-sm text-muted-foreground">
          No timeline data available
        </div>
      )}
    </div>
  );
}
