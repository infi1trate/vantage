import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Clock, Plus, Tag, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineAnnotationCreator } from "./InlineAnnotationCreator";

interface Annotation {
  id: string;
  annotation_type: string;
  title?: string | null;
  content?: string | null;
  timestamp_seconds: number;
}

interface ProofConfirmationProps {
  annotation: Annotation | null;
  isConfirmed: boolean;
  onConfirmChange: (confirmed: boolean) => void;
  onAddAnnotation?: () => void;
  onCreateInlineAnnotation?: (annotation: {
    type: string;
    label: string;
    timestamp_seconds: number;
  }) => Promise<Annotation>;
  clipStartMs: number;
  clipEndMs: number;
  currentTimeMs?: number;
}

export function ProofConfirmation({
  annotation,
  isConfirmed,
  onConfirmChange,
  onAddAnnotation,
  onCreateInlineAnnotation,
  clipStartMs,
  clipEndMs,
  currentTimeMs = clipStartMs,
}: ProofConfirmationProps) {
  const [showInlineCreator, setShowInlineCreator] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getAnnotationTypeLabel = (type: string) => {
    switch (type) {
      case "kill": return "Kill";
      case "death": return "Death";
      case "highlight": return "Highlight";
      case "objective": return "Objective";
      case "save": return "Save";
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const getAnnotationColor = (type: string) => {
    switch (type) {
      case "kill": return "bg-red-500/20 text-red-500 border-red-500/30";
      case "death": return "bg-purple-500/20 text-purple-500 border-purple-500/30";
      case "highlight": return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
      case "objective": return "bg-green-500/20 text-green-500 border-green-500/30";
      default: return "bg-primary/20 text-primary border-primary/30";
    }
  };

  // Check if annotation is within clip range
  const annotationMs = annotation ? annotation.timestamp_seconds * 1000 : 0;
  const isWithinClip = annotation && annotationMs >= clipStartMs && annotationMs <= clipEndMs;

  const handleInlineCreate = async (data: {
    type: string;
    label: string;
    timestamp_seconds: number;
  }) => {
    if (onCreateInlineAnnotation) {
      await onCreateInlineAnnotation(data);
      setShowInlineCreator(false);
    }
  };

  if (!annotation) {
    // Show inline creator if active
    if (showInlineCreator && onCreateInlineAnnotation) {
      return (
        <InlineAnnotationCreator
          currentTimeMs={currentTimeMs}
          clipStartMs={clipStartMs}
          clipEndMs={clipEndMs}
          onCancel={() => setShowInlineCreator(false)}
          onSubmit={handleInlineCreate}
        />
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-destructive">
              Annotation required
            </p>
            <p className="text-sm text-muted-foreground">
              To submit to this challenge, you must annotate the moment that proves you completed it.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {onCreateInlineAnnotation && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowInlineCreator(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Quick Annotation
                </Button>
              )}
              {onAddAnnotation && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddAnnotation}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Open Full Editor
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Annotation display */}
      <div
        className={cn(
          "p-3 rounded-lg border",
          isWithinClip
            ? "bg-muted/50 border-border"
            : "bg-yellow-500/10 border-yellow-500/30"
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "shrink-0 px-2 py-1 rounded border text-xs font-medium",
              getAnnotationColor(annotation.annotation_type)
            )}
          >
            <Tag className="h-3 w-3 inline mr-1" />
            {getAnnotationTypeLabel(annotation.annotation_type)}
          </div>
          <div className="flex-1 min-w-0">
            {annotation.title && (
              <p className="font-medium text-sm truncate">{annotation.title}</p>
            )}
            {annotation.content && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {annotation.content}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="font-mono">
                {formatTime(annotation.timestamp_seconds)}
              </span>
            </div>
          </div>
        </div>

        {!isWithinClip && (
          <div className="mt-3 pt-3 border-t border-yellow-500/20">
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              ⚠️ This annotation is outside your selected clip range. Adjust your trim to include it.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation checkbox */}
      <div
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg border transition-colors",
          isConfirmed
            ? "bg-green-500/10 border-green-500/30"
            : "bg-muted/30 border-border hover:border-primary/50"
        )}
      >
        <Checkbox
          id="proof-confirmation"
          checked={isConfirmed}
          onCheckedChange={(checked) => onConfirmChange(checked === true)}
          className="mt-0.5"
        />
        <div className="flex-1">
          <Label
            htmlFor="proof-confirmation"
            className={cn(
              "text-sm font-medium cursor-pointer",
              isConfirmed ? "text-green-600 dark:text-green-500" : "text-foreground"
            )}
          >
            This clip clearly shows me completing the challenge.
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            Submissions without valid proof may be rejected by moderators.
          </p>
        </div>
        {isConfirmed && (
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
        )}
      </div>
    </div>
  );
}
