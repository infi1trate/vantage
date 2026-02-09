import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tag, Crosshair, Flame, Skull, Star, Clock } from "lucide-react";

interface Annotation {
  id: string;
  annotation_type: string;
  title?: string | null;
  content?: string | null;
  timestamp_seconds: number;
}

interface AnnotationSelectorProps {
  annotations: Annotation[];
  selectedAnnotationId?: string | null;
  onSelect: (annotation: Annotation) => void;
  thumbnailUrl?: string | null;
  totalDuration: number;
}

const TYPE_META: Record<string, { icon: typeof Tag; label: string; color: string }> = {
  kill: { icon: Crosshair, label: "Kill", color: "text-red-400" },
  death: { icon: Skull, label: "Death", color: "text-orange-400" },
  highlight: { icon: Flame, label: "Highlight", color: "text-yellow-400" },
  streak: { icon: Star, label: "Streak", color: "text-amber-400" },
};

function getTypeMeta(type: string) {
  return TYPE_META[type.toLowerCase()] ?? { icon: Tag, label: type, color: "text-muted-foreground" };
}

function formatTimestamp(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AnnotationSelector({
  annotations,
  selectedAnnotationId,
  onSelect,
  thumbnailUrl,
  totalDuration,
}: AnnotationSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Sort by timestamp
  const sorted = [...annotations].sort(
    (a, b) => a.timestamp_seconds - b.timestamp_seconds
  );

  return (
    <div className="space-y-2">
      {sorted.map((ann, idx) => {
        const meta = getTypeMeta(ann.annotation_type);
        const Icon = meta.icon;
        const isSelected = ann.id === selectedAnnotationId;
        const isHovered = ann.id === hoveredId;
        const positionPct = totalDuration > 0 ? (ann.timestamp_seconds / totalDuration) * 100 : 0;

        return (
          <button
            key={ann.id}
            type="button"
            onClick={() => onSelect(ann)}
            onMouseEnter={() => setHoveredId(ann.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-all",
              "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border bg-card"
            )}
          >
            {/* Thumbnail with timestamp marker */}
            <div className="relative h-12 w-20 shrink-0 rounded-md overflow-hidden bg-muted">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-muted to-background" />
              )}
              {/* Mini timeline position indicator */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/60">
                <div
                  className="absolute top-0 h-full w-1.5 rounded-full bg-primary"
                  style={{ left: `${Math.min(positionPct, 97)}%` }}
                />
              </div>
              {/* Timestamp badge */}
              <div className="absolute top-0.5 right-0.5">
                <Badge
                  variant="secondary"
                  className="h-4 px-1 text-[10px] font-mono leading-none bg-background/80 backdrop-blur-sm"
                >
                  {formatTimestamp(ann.timestamp_seconds)}
                </Badge>
              </div>
            </div>

            {/* Annotation info */}
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.color)} />
                <span className="text-sm font-medium truncate">
                  {ann.title || meta.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(ann.timestamp_seconds)}
                </span>
                {ann.content && (
                  <span className="truncate">{ann.content}</span>
                )}
              </div>
            </div>

            {/* Recommendation badge for first annotation (purely cosmetic) */}
            {idx === 0 && (
              <Badge
                variant="outline"
                className="shrink-0 text-[10px] border-primary/30 text-primary hidden sm:inline-flex"
              >
                Recommended
              </Badge>
            )}

            {/* Selection indicator */}
            <div
              className={cn(
                "h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                isSelected
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/30"
              )}
            >
              {isSelected && (
                <div className="h-full w-full flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
