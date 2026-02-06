import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Clock, 
  Target, 
  Skull, 
  Sparkles, 
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineAnnotationCreatorProps {
  currentTimeMs: number;
  clipStartMs: number;
  clipEndMs: number;
  onCancel: () => void;
  onSubmit: (annotation: {
    type: string;
    label: string;
    timestamp_seconds: number;
  }) => Promise<void>;
}

const ANNOTATION_TYPES = [
  { value: "kill", label: "Kill", icon: Target, color: "text-red-500" },
  { value: "death", label: "Death", icon: Skull, color: "text-purple-500" },
  { value: "highlight", label: "Highlight", icon: Sparkles, color: "text-yellow-500" },
  { value: "objective", label: "Objective", icon: CheckCircle2, color: "text-green-500" },
];

export function InlineAnnotationCreator({
  currentTimeMs,
  clipStartMs,
  clipEndMs,
  onCancel,
  onSubmit,
}: InlineAnnotationCreatorProps) {
  const [type, setType] = useState("highlight");
  const [label, setLabel] = useState("");
  const [timestampSec, setTimestampSec] = useState(
    Math.round(Math.max(clipStartMs, Math.min(clipEndMs, currentTimeMs)) / 1000)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isWithinClip = 
    timestampSec * 1000 >= clipStartMs && 
    timestampSec * 1000 <= clipEndMs;

  const handleSubmit = async () => {
    if (!label.trim()) {
      setError("Label is required");
      return;
    }

    if (!isWithinClip) {
      setError("Timestamp must be within clip range");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        type,
        label: label.trim(),
        timestamp_seconds: timestampSec,
      });
    } catch (err) {
      setError("Failed to create annotation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedType = ANNOTATION_TYPES.find(t => t.value === type);

  return (
    <div className="space-y-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between">
        <h5 className="font-medium flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          Quick Annotation
        </h5>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Type selector */}
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANNOTATION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <span className="flex items-center gap-2">
                    <t.icon className={cn("h-4 w-4", t.color)} />
                    {t.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Timestamp */}
        <div className="space-y-1.5">
          <Label className="text-xs">Timestamp</Label>
          <div className="relative">
            <Input
              type="number"
              min={Math.floor(clipStartMs / 1000)}
              max={Math.floor(clipEndMs / 1000)}
              value={timestampSec}
              onChange={(e) => setTimestampSec(Number(e.target.value))}
              className={cn(
                "h-9 font-mono pr-12",
                !isWithinClip && "border-destructive"
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              sec
            </span>
          </div>
          {!isWithinClip && (
            <p className="text-xs text-destructive">
              Must be between {formatTime(clipStartMs / 1000)} and {formatTime(clipEndMs / 1000)}
            </p>
          )}
        </div>
      </div>

      {/* Label input */}
      <div className="space-y-1.5">
        <Label className="text-xs">Label *</Label>
        <Input
          placeholder="e.g., Triple kill, Clutch moment"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            if (error) setError(null);
          }}
          className={cn(error && "border-destructive")}
          maxLength={50}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {/* Preview */}
      <div className="flex items-center gap-2 text-sm">
        <Badge
          variant="secondary"
          className={cn(
            "border",
            selectedType && `bg-${selectedType.color.replace('text-', '')}/20`
          )}
        >
          {selectedType && <selectedType.icon className={cn("h-3 w-3 mr-1", selectedType.color)} />}
          {label || "Your annotation"}
        </Badge>
        <span className="text-muted-foreground">at</span>
        <Badge variant="outline" className="font-mono">
          <Clock className="h-3 w-3 mr-1" />
          {formatTime(timestampSec)}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting || !label.trim() || !isWithinClip}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Create Annotation
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
