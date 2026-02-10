import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { AnnotationSelector } from "./AnnotationSelector";
import { ClipTrimmer } from "./ClipTrimmer";
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
  requiredCount: number;
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

// ── Sub-steps within the collector ─────────────────────────────────

type CollectorPhase = "list" | "pick-annotation" | "trim-clip";

// ── Component ─────────────────────────────────────────────────────

export function MomentCollector({
  requiredCount,
  moments,
  onMomentsChange,
  annotations,
  thumbnailUrl,
  videoUrl,
  totalDuration,
  minClipDuration = 5,
  maxClipDuration = 60,
  onCreateInlineAnnotation,
  onOpenFullEditor,
}: MomentCollectorProps) {
  const [phase, setPhase] = useState<CollectorPhase>(
    moments.length === 0 && annotations.length > 0 ? "pick-annotation" : "list"
  );
  const [draftAnnotation, setDraftAnnotation] = useState<Annotation | null>(null);
  const [draftClipStart, setDraftClipStart] = useState(0);
  const [draftClipEnd, setDraftClipEnd] = useState(0);
  const [showInlineCreator, setShowInlineCreator] = useState(false);

  const isFull = moments.length >= requiredCount;

  // Annotations already used in collected moments
  const usedAnnotationIds = new Set(moments.map((m) => m.annotationId));
  const availableAnnotations = annotations.filter((a) => !usedAnnotationIds.has(a.id));

  // ── Handlers ──

  const startAddMoment = () => {
    setDraftAnnotation(null);
    setDraftClipStart(0);
    setDraftClipEnd(0);
    if (availableAnnotations.length > 0) {
      setPhase("pick-annotation");
    } else {
      // No remaining annotations — show inline creator or prompt
      setShowInlineCreator(true);
      setPhase("pick-annotation");
    }
  };

  const handleAnnotationSelect = (annotation: Annotation) => {
    setDraftAnnotation(annotation);
    const annotationMs = annotation.timestamp_seconds * 1000;
    const totalMs = totalDuration * 1000;
    setDraftClipStart(Math.max(0, annotationMs - 2000));
    setDraftClipEnd(Math.min(totalMs, annotationMs + 2000));
    setPhase("trim-clip");
  };

  const handleClipConfirm = () => {
    if (!draftAnnotation) return;
    const newMoment: MomentData = {
      annotationId: draftAnnotation.id,
      annotationType: draftAnnotation.annotation_type,
      label: draftAnnotation.title || draftAnnotation.annotation_type,
      timestampSeconds: draftAnnotation.timestamp_seconds,
      clipStartMs: draftClipStart,
      clipEndMs: draftClipEnd,
    };
    const updated = [...moments, newMoment];
    onMomentsChange(updated);
    setDraftAnnotation(null);

    // If still need more, stay on list; otherwise go to list
    setPhase("list");
  };

  const removeMoment = (index: number) => {
    const updated = moments.filter((_, i) => i !== index);
    onMomentsChange(updated);
  };

  const handleInlineCreated = async (data: {
    type: string;
    label: string;
    timestamp_seconds: number;
  }) => {
    if (!onCreateInlineAnnotation) return;
    const annotation = await onCreateInlineAnnotation(data);
    setShowInlineCreator(false);
    handleAnnotationSelect(annotation);
  };

  // ── Render: Collected Moments List ──

  if (phase === "list") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">
            Moments ({moments.length}/{requiredCount})
          </h4>
          <Badge
            variant={isFull ? "default" : "secondary"}
            className={cn(
              "text-xs",
              isFull && "bg-green-500/20 text-green-500 border-green-500/30"
            )}
          >
            {isFull ? "All moments added" : `${requiredCount - moments.length} more needed`}
          </Badge>
        </div>

        {moments.length > 0 && (
          <div className="space-y-2">
            {moments.map((moment, idx) => {
              const meta = getTypeMeta(moment.annotationType);
              const Icon = meta.icon;
              return (
                <div
                  key={moment.annotationId + idx}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-primary/20 bg-primary/5"
                >
                  <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    {idx + 1}
                  </div>
                  <Icon className={cn("h-4 w-4 shrink-0", meta.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{moment.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {formatTimestamp(moment.timestampSeconds)} ·{" "}
                      {formatTimestamp(moment.clipStartMs / 1000)}–
                      {formatTimestamp(moment.clipEndMs / 1000)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMoment(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {!isFull && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={startAddMoment}
          >
            <Plus className="h-4 w-4" />
            Add Moment {moments.length + 1} of {requiredCount}
          </Button>
        )}

        {moments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            This challenge requires {requiredCount} moment{requiredCount !== 1 ? "s" : ""}. Add each one by selecting an annotation and trimming its clip.
          </p>
        )}
      </div>
    );
  }

  // ── Render: Pick Annotation ──

  if (phase === "pick-annotation") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">
            Select moment {moments.length + 1} of {requiredCount}
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowInlineCreator(false);
              setPhase("list");
            }}
          >
            Back
          </Button>
        </div>

        {showInlineCreator && onCreateInlineAnnotation ? (
          <InlineAnnotationCreator
            currentTimeMs={0}
            clipStartMs={0}
            clipEndMs={totalDuration * 1000}
            onCancel={() => setShowInlineCreator(false)}
            onSubmit={handleInlineCreated}
          />
        ) : availableAnnotations.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              Pick the annotation for this moment.
            </p>
            <AnnotationSelector
              annotations={availableAnnotations}
              selectedAnnotationId={null}
              onSelect={handleAnnotationSelect}
              thumbnailUrl={thumbnailUrl}
              totalDuration={totalDuration}
            />
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No unused annotations remaining. Create a new one:
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              {onCreateInlineAnnotation && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowInlineCreator(true)}
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Quick Annotation
                </Button>
              )}
              {onOpenFullEditor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenFullEditor}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Full Editor
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render: Trim Clip ──

  if (phase === "trim-clip" && draftAnnotation) {
    const clipDuration = (draftClipEnd - draftClipStart) / 1000;
    const isClipValid = clipDuration >= minClipDuration && clipDuration <= maxClipDuration;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">
            Trim clip for moment {moments.length + 1}
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPhase("pick-annotation")}
          >
            Back
          </Button>
        </div>

        {/* Selected annotation summary */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/5 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate">
            {draftAnnotation.title || draftAnnotation.annotation_type}
          </span>
          <span className="text-xs text-muted-foreground ml-auto font-mono">
            {formatTimestamp(draftAnnotation.timestamp_seconds)}
          </span>
        </div>

        <ClipTrimmer
          videoUrl={videoUrl}
          thumbnailUrl={thumbnailUrl}
          totalDuration={totalDuration}
          minDuration={minClipDuration}
          maxDuration={maxClipDuration}
          startMs={draftClipStart}
          endMs={draftClipEnd}
          onRangeChange={(s, e) => {
            setDraftClipStart(s);
            setDraftClipEnd(e);
          }}
          annotationTimestamp={draftAnnotation.timestamp_seconds}
        />

        <Button
          className="w-full"
          onClick={handleClipConfirm}
          disabled={!isClipValid}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Add Moment {moments.length + 1}
        </Button>
      </div>
    );
  }

  return null;
}
