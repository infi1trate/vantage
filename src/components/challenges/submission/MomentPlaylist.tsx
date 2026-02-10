import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Tag,
  Crosshair,
  Skull,
  Flame,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipTrimmer } from "./ClipTrimmer";
import type { MomentData } from "./MomentCollector";

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

// ── Types ──────────────────────────────────────────────────────────

interface MomentPlaylistProps {
  moments: MomentData[];
  onMomentsChange: (moments: MomentData[]) => void;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  totalDuration: number; // seconds
  minClipDuration?: number; // seconds
  maxClipDuration?: number; // seconds
}

interface MomentValidation {
  isValid: boolean;
  error?: string;
}

// ── Component ─────────────────────────────────────────────────────

export function MomentPlaylist({
  moments,
  onMomentsChange,
  videoUrl,
  thumbnailUrl,
  totalDuration,
  minClipDuration = 5,
  maxClipDuration = 60,
}: MomentPlaylistProps) {
  const [activeTab, setActiveTab] = useState(moments[0]?.annotationId ?? "");

  // Per-moment validation
  const validations = useMemo<Record<string, MomentValidation>>(() => {
    const result: Record<string, MomentValidation> = {};
    moments.forEach((m) => {
      const durationSec = (m.clipEndMs - m.clipStartMs) / 1000;
      if (durationSec < minClipDuration) {
        result[m.annotationId] = {
          isValid: false,
          error: `Too short (${Math.floor(durationSec)}s < ${minClipDuration}s)`,
        };
      } else if (durationSec > maxClipDuration) {
        result[m.annotationId] = {
          isValid: false,
          error: `Too long (${Math.floor(durationSec)}s > ${maxClipDuration}s)`,
        };
      } else {
        result[m.annotationId] = { isValid: true };
      }
    });
    return result;
  }, [moments, minClipDuration, maxClipDuration]);

  const allValid = useMemo(
    () => moments.every((m) => validations[m.annotationId]?.isValid),
    [moments, validations]
  );

  const invalidCount = useMemo(
    () => moments.filter((m) => !validations[m.annotationId]?.isValid).length,
    [moments, validations]
  );

  const handleRangeChange = (annotationId: string, startMs: number, endMs: number) => {
    onMomentsChange(
      moments.map((m) =>
        m.annotationId === annotationId
          ? { ...m, clipStartMs: startMs, clipEndMs: endMs }
          : m
      )
    );
  };

  if (moments.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Trim each moment</h4>
        {!allValid && (
          <Badge variant="destructive" className="text-xs gap-1">
            <AlertCircle className="h-3 w-3" />
            {invalidCount} clip{invalidCount !== 1 ? "s" : ""} need{invalidCount === 1 ? "s" : ""} fixing
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Select each moment to adjust its clip range. All clips must meet duration requirements.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Moment row tabs */}
        <TabsList className="w-full h-auto flex-col items-stretch bg-transparent gap-1.5 p-0">
          {moments.map((moment, index) => {
            const meta = getTypeMeta(moment.annotationType);
            const Icon = meta.icon;
            const validation = validations[moment.annotationId];
            const isActive = activeTab === moment.annotationId;

            return (
              <TabsTrigger
                key={moment.annotationId}
                value={moment.annotationId}
                className={cn(
                  "w-full justify-start gap-3 px-3 py-2.5 rounded-lg border text-left",
                  "data-[state=active]:shadow-none",
                  isActive
                    ? "border-primary bg-primary/5 data-[state=active]:bg-primary/5"
                    : "border-border bg-card hover:bg-accent/50",
                  !validation?.isValid && "border-destructive/50"
                )}
              >
                {/* Index */}
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-medium shrink-0">
                  {index + 1}
                </span>

                {/* Thumbnail */}
                <div className="relative h-8 w-12 shrink-0 rounded overflow-hidden bg-muted">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-muted to-background" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.color)} />
                    <span className="text-sm font-medium truncate">
                      {moment.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="font-mono">{formatTimestamp(moment.timestampSeconds)}</span>
                  </div>
                </div>

                {/* Validation status */}
                {validation?.isValid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Per-moment clip trimmer */}
        {moments.map((moment) => {
          const validation = validations[moment.annotationId];

          return (
            <TabsContent
              key={moment.annotationId}
              value={moment.annotationId}
              className="mt-4"
            >
              {/* Inline error */}
              {!validation?.isValid && validation?.error && (
                <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    Moment {moments.indexOf(moment) + 1}: {validation.error}
                  </span>
                </div>
              )}

              <ClipTrimmer
                videoUrl={videoUrl}
                thumbnailUrl={thumbnailUrl}
                totalDuration={totalDuration}
                minDuration={minClipDuration}
                maxDuration={maxClipDuration}
                startMs={moment.clipStartMs}
                endMs={moment.clipEndMs}
                onRangeChange={(startMs, endMs) =>
                  handleRangeChange(moment.annotationId, startMs, endMs)
                }
                annotationTimestamp={moment.timestampSeconds}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
