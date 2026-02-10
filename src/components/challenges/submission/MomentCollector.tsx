import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  Clock,
  Plus,
  Tag,
  Trash2,
  Crosshair,
  Skull,
  Flame,
  Star,
  Zap,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineAnnotationCreator } from "./InlineAnnotationCreator";

// ── Types ──────────────────────────────────────────────────────────

export interface MomentData {
  annotationId: string;
  annotationType: string;
  label: string;
  timestampSeconds: number;
  clipStartMs: number;
  clipEndMs: number;
}

interface Annotation {
  id: string;
  annotation_type: string;
  title?: string | null;
  content?: string | null;
  timestamp_seconds: number;
}

interface MomentCollectorProps {
  requiredMin: number;
  requiredMax: number;
  momentLabel?: string | null;
  moments: MomentData[];
  onMomentsChange: (moments: MomentData[]) => void;
  annotations: Annotation[];
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  totalDuration: number;
  minClipDuration?: number;
  maxClipDuration?: number;
  onCreateInlineAnnotation?: (data: {
    type: string;
    label: string;
    timestamp_seconds: number;
  }) => Promise<Annotation>;
  onOpenFullEditor?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────

const TYPE_META: Record<string, { icon: typeof Tag; color: string }> = {
  kill: { icon: Crosshair, color: "text-red-400" },
  death: { icon: Skull, color: "text-orange-400" },
  highlight: { icon: Flame, color: "text-yellow-400" },
  streak: { icon: Star, color: "text-amber-400" },
};

function getTypeMeta(type: string) {
  return TYPE_META[type.toLowerCase()] ?? { icon: Tag, color: "text-muted-foreground" };
}

function formatTimestamp(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function annotationToMoment(annotation: Annotation, totalDurationMs: number): MomentData {
  const annotationMs = annotation.timestamp_seconds * 1000;
  return {
    annotationId: annotation.id,
    annotationType: annotation.annotation_type,
    label: annotation.title || annotation.annotation_type,
    timestampSeconds: annotation.timestamp_seconds,
    clipStartMs: Math.max(0, annotationMs - 2000),
    clipEndMs: Math.min(totalDurationMs, annotationMs + 2000),
  };
}

// ── Component ─────────────────────────────────────────────────────

export function MomentCollector({
  requiredMin,
  requiredMax,
  momentLabel,
  moments,
  onMomentsChange,
  annotations,
  thumbnailUrl,
  totalDuration,
  onCreateInlineAnnotation,
  onOpenFullEditor,
}: MomentCollectorProps) {
  const [showInlineCreator, setShowInlineCreator] = useState(false);
  // Track annotations created inline so they appear in the list
  const [inlineAnnotations, setInlineAnnotations] = useState<Annotation[]>([]);

  const totalDurationMs = totalDuration * 1000;
  const displayLabel = momentLabel || "moments";
  const targetCount = requiredMin === requiredMax ? requiredMin : requiredMax;
  const isMaxReached = moments.length >= requiredMax;
  const isMinMet = moments.length >= requiredMin;

  // Combine original + inline-created annotations
  const allAnnotations = useMemo(() => {
    const ids = new Set(annotations.map((a) => a.id));
    const merged = [...annotations];
    for (const ia of inlineAnnotations) {
      if (!ids.has(ia.id)) merged.push(ia);
    }
    return merged.sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
  }, [annotations, inlineAnnotations]);

  const selectedIds = new Set(moments.map((m) => m.annotationId));

  const handleToggle = (annotation: Annotation, checked: boolean) => {
    if (checked) {
      if (isMaxReached) return;
      const newMoment = annotationToMoment(annotation, totalDurationMs);
      onMomentsChange([...moments, newMoment]);
    } else {
      onMomentsChange(moments.filter((m) => m.annotationId !== annotation.id));
    }
  };

  const handleInlineCreated = async (data: {
    type: string;
    label: string;
    timestamp_seconds: number;
  }) => {
    if (!onCreateInlineAnnotation) return;
    const annotation = await onCreateInlineAnnotation(data);
    setInlineAnnotations((prev) => [...prev, annotation]);
    setShowInlineCreator(false);

    // Auto-select the newly created annotation if not at max
    if (moments.length < requiredMax) {
      const newMoment = annotationToMoment(annotation, totalDurationMs);
      onMomentsChange([...moments, newMoment]);
    }
  };

  // ── Counter display ──
  const counterText = requiredMin === requiredMax
    ? `${moments.length} / ${requiredMin} ${displayLabel} added`
    : `${moments.length} / ${requiredMin}–${requiredMax} ${displayLabel} added`;

  // ── Has annotations to show? ──
  const hasAnnotations = allAnnotations.length > 0;

  return (
    <div className="space-y-4">
      {/* Title */}
      <h4 className="font-medium">Add moments that prove this challenge</h4>

      {/* Counter */}
      <div className="flex items-center justify-between">
        <Badge
          variant={isMinMet ? "default" : "secondary"}
          className={cn(
            "text-xs",
            isMinMet && "bg-primary/20 text-primary border-primary/30"
          )}
        >
          {counterText}
        </Badge>
        {isMaxReached && (
          <span className="text-xs text-muted-foreground">Maximum reached</span>
        )}
      </div>

      {/* Helper text */}
      <p className="text-sm text-muted-foreground">
        Your submission will include multiple moments. We'll stitch them as a sequence.
      </p>

      {/* ── Annotation checkbox list ── */}
      {hasAnnotations && (
        <TooltipProvider delayDuration={200}>
          <div className="space-y-2">
            {allAnnotations.map((ann) => {
              const meta = getTypeMeta(ann.annotation_type);
              const Icon = meta.icon;
              const isSelected = selectedIds.has(ann.id);
              const isDisabled = !isSelected && isMaxReached;
              const positionPct = totalDuration > 0
                ? (ann.timestamp_seconds / totalDuration) * 100
                : 0;

              const row = (
                <label
                  key={ann.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card",
                    isDisabled
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer hover:bg-accent/50"
                  )}
                >
                  {/* Checkbox */}
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => handleToggle(ann, !!checked)}
                    className="shrink-0"
                  />

                  {/* Thumbnail with position marker */}
                  <div className="relative h-10 w-16 shrink-0 rounded-md overflow-hidden bg-muted">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-muted to-background" />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/60">
                      <div
                        className="absolute top-0 h-full w-1.5 rounded-full bg-primary"
                        style={{ left: `${Math.min(positionPct, 97)}%` }}
                      />
                    </div>
                    <div className="absolute top-0.5 right-0.5">
                      <Badge
                        variant="secondary"
                        className="h-4 px-1 text-[10px] font-mono leading-none bg-background/80 backdrop-blur-sm"
                      >
                        {formatTimestamp(ann.timestamp_seconds)}
                      </Badge>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.color)} />
                      <span className="text-sm font-medium truncate">
                        {ann.title || ann.annotation_type}
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
                </label>
              );

              // Wrap disabled rows in tooltip
              if (isDisabled) {
                return (
                  <Tooltip key={ann.id}>
                    <TooltipTrigger asChild>
                      <div>{row}</div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>This challenge allows up to {requiredMax} {displayLabel}.</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return row;
            })}
          </div>
        </TooltipProvider>
      )}

      {/* ── Inline creator ── */}
      {showInlineCreator && onCreateInlineAnnotation ? (
        <InlineAnnotationCreator
          key={`inline-${moments.length}`}
          currentTimeMs={0}
          clipStartMs={0}
          clipEndMs={totalDurationMs}
          onCancel={() => setShowInlineCreator(false)}
          onSubmit={handleInlineCreated}
        />
      ) : !isMaxReached && onCreateInlineAnnotation ? (
        <Button
          variant={!isMinMet && !hasAnnotations ? "default" : "outline"}
          size="sm"
          onClick={() => setShowInlineCreator(true)}
          className="w-full gap-2"
        >
          <Zap className="h-4 w-4" />
          {moments.length === 0
            ? "Tag your first moment"
            : !isMinMet
              ? `Add another moment (${requiredMin - moments.length} more needed)`
              : "Add another moment"}
        </Button>
      ) : null}

      {/* Full editor fallback — only when no annotations exist */}
      {!hasAnnotations && moments.length === 0 && !showInlineCreator && onOpenFullEditor && (
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFullEditor}
          className="w-full gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Open Full Editor
        </Button>
      )}

      {/* Empty state guidance */}
      {!hasAnnotations && moments.length === 0 && !showInlineCreator && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No moments tagged yet. Use Quick Annotation to mark each {displayLabel.replace(/s$/, "")} in your recording.
        </p>
      )}
    </div>
  );
}
