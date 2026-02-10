import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trophy, Send, CheckCircle2, Tag, Zap, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Challenge } from "@/lib/challenges.ts";
import { useCreateSubmission, useUserSubmissions } from "@/hooks/useChallenges";
import {
  AnnotationSelector,
  ChallengeContextBar,
  ClipTrimmer,
  InlineAnnotationCreator,
  MomentCollector,
  type MomentData,
  MomentPlaylist,
  SubmissionLimitsBar,
  SubmissionSuccess,
} from "./submission";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// ── Steps ─────────────────────────────────────────────────────────

type SubmissionStep = "moment" | "clip" | "metadata" | "success";

// Auto-generate title: "[Challenge Title] — [Session Name]"
function generateAutoTitle(challengeTitle: string, sessionTitle?: string, gameName?: string): string {
  const suffix = gameName || sessionTitle || "Submission";
  return `${challengeTitle} — ${suffix}`;
}

// ── Local types ───────────────────────────────────────────────────

interface Annotation {
  id: string;
  annotation_type: string;
  title?: string | null;
  content?: string | null;
  timestamp_seconds: number;
}

interface SelectedSession {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  video_url?: string | null;
  duration_seconds?: number | null;
  annotations?: Annotation[];
}

interface SubmissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: Challenge;
  selectedSession?: SelectedSession | null;
  selectedAnnotation?: Annotation | null;
  clipRange?: {
    start_ms: number;
    end_ms: number;
  } | null;
  onSuccess?: () => void;
  onChangeSession?: () => void;
}

// ── Component ─────────────────────────────────────────────────────

export function SubmissionModal({
  open,
  onOpenChange,
  challenge,
  selectedSession,
  selectedAnnotation: initialAnnotation,
  clipRange: initialClipRange,
  onSuccess,
  onChangeSession,
}: SubmissionModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createSubmission = useCreateSubmission();
  const { data: userSubmissions = [] } = useUserSubmissions(challenge.id);

  const requiredMin = challenge.required_moments_min ?? 1;
  const requiredMax = challenge.required_moments_max ?? 1;
  const momentLabel = challenge.moment_label ?? null;
  const isMultiMoment = requiredMax > 1;

  // Step management
  const [step, setStep] = useState<SubmissionStep>("moment");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Single-moment state (used when requiredMoments === 1) ──
  const [clipStartMs, setClipStartMs] = useState(initialClipRange?.start_ms ?? 0);
  const [clipEndMs, setClipEndMs] = useState(
    initialClipRange?.end_ms ?? (selectedSession?.duration_seconds ?? 60) * 1000
  );
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(
    initialAnnotation ?? selectedSession?.annotations?.[0] ?? null
  );
  const [showInlineCreator, setShowInlineCreator] = useState(false);

  // ── Multi-moment state ──
  const [collectedMoments, setCollectedMoments] = useState<MomentData[]>([]);

  // ── Editable moment labels (inline chip editing) ──
  const [editingChipIndex, setEditingChipIndex] = useState<number | null>(null);
  const chipInputRef = useRef<HTMLInputElement>(null);

  // Session annotations
  const sessionAnnotations = selectedSession?.annotations ?? [];
  const sessionHasAnnotations = sessionAnnotations.length > 0;
  const sessionHasMultipleAnnotations = sessionAnnotations.length > 1;

  // Auto-generated title
  const autoTitle = useMemo(
    () => generateAutoTitle(challenge.title, selectedSession?.title, challenge.game_name),
    [challenge.title, selectedSession?.title, challenge.game_name]
  );

  // ── Reset on open ──
  useEffect(() => {
    if (open && selectedSession) {
      setIsSubmitting(false);
      setShowInlineCreator(false);
      setCollectedMoments([]);
      setEditingChipIndex(null);

      const annotations = selectedSession.annotations ?? [];
      const annotation = initialAnnotation ?? annotations[0] ?? null;
      setSelectedAnnotation(annotation);

      setStep("moment");

      if (!isMultiMoment && annotation) {
        const annotationMs = annotation.timestamp_seconds * 1000;
        const totalMs = (selectedSession.duration_seconds ?? 60) * 1000;
        setClipStartMs(Math.max(0, annotationMs - 2000));
        setClipEndMs(Math.min(totalMs, annotationMs + 2000));
      } else if (initialClipRange) {
        setClipStartMs(initialClipRange.start_ms);
        setClipEndMs(initialClipRange.end_ms);
      } else {
        setClipStartMs(0);
        setClipEndMs((selectedSession.duration_seconds ?? 60) * 1000);
      }
    }
  }, [open, selectedSession, initialAnnotation, initialClipRange, isMultiMoment]);

  // ── Derived ──
  const totalDuration = selectedSession?.duration_seconds ?? 60;
  const minClipDuration = 5;
  const maxClipDuration = 60;
  const clipDuration = (clipEndMs - clipStartMs) / 1000;
  const isClipValid = clipDuration >= minClipDuration && clipDuration <= maxClipDuration;

  const currentSubmissions = userSubmissions.length;
  const maxSubmissions = challenge.max_submissions_per_user ?? 1;
  const remainingSubmissions = maxSubmissions - currentSubmissions;
  const hasReachedLimit = remainingSubmissions <= 0;

  const annotationWithinClip = useMemo(() => {
    if (!selectedAnnotation) return false;
    const annotationMs = selectedAnnotation.timestamp_seconds * 1000;
    return annotationMs >= clipStartMs && annotationMs <= clipEndMs;
  }, [selectedAnnotation, clipStartMs, clipEndMs]);

  // ── Per-moment clip validation (multi-moment) ──
  const allMomentClipsValid = useMemo(() => {
    if (!isMultiMoment) return true;
    return collectedMoments.every((m) => {
      const dur = (m.clipEndMs - m.clipStartMs) / 1000;
      return dur >= minClipDuration && dur <= maxClipDuration;
    });
  }, [collectedMoments, isMultiMoment, minClipDuration, maxClipDuration]);

  // ── Progress ──
  const getProgress = () => {
    switch (step) {
      case "moment": return 33;
      case "clip": return 66;
      case "metadata": return 100;
      case "success": return 100;
      default: return 0;
    }
  };

  // ── Can advance ──
  const canAdvance = useMemo(() => {
    switch (step) {
      case "moment":
        if (isMultiMoment) {
          return collectedMoments.length >= requiredMin;
        }
        return true;
      case "clip":
        if (isMultiMoment) {
          return allMomentClipsValid && collectedMoments.length >= requiredMin;
        }
        return isClipValid;
      case "metadata":
        if (isMultiMoment) {
          return collectedMoments.length >= requiredMin && allMomentClipsValid;
        }
        return selectedAnnotation !== null;
      default:
        return false;
    }
  }, [step, isClipValid, selectedAnnotation, isMultiMoment, collectedMoments, requiredMin, allMomentClipsValid]);

  // ── Navigation ──
  const goToNextStep = () => {
    switch (step) {
      case "moment":
        setStep("clip");
        break;
      case "clip":
        setStep("metadata");
        break;
      case "metadata":
        handleSubmit();
        break;
    }
  };

  const goToPreviousStep = () => {
    switch (step) {
      case "clip":
        setStep("moment");
        break;
      case "metadata":
        setStep("clip");
        break;
    }
  };

  // ── Annotation handlers (single-moment) ──
  const handleAnnotationSelect = (annotation: Annotation) => {
    setSelectedAnnotation(annotation);
    const annotationMs = annotation.timestamp_seconds * 1000;
    const totalMs = (selectedSession?.duration_seconds ?? 60) * 1000;
    setClipStartMs(Math.max(0, annotationMs - 2000));
    setClipEndMs(Math.min(totalMs, annotationMs + 2000));
  };

  const handleRangeChange = (startMs: number, endMs: number) => {
    setClipStartMs(startMs);
    setClipEndMs(endMs);
  };

  // ── Inline annotation creation ──
  const handleCreateInlineAnnotation = async (data: {
    type: string;
    label: string;
    timestamp_seconds: number;
  }): Promise<Annotation> => {
    if (!selectedSession || !user) {
      throw new Error("No session or user");
    }

    const { data: annotation, error } = await supabase
      .from("annotations")
      .insert({
        session_id: selectedSession.id,
        user_id: user.id,
        annotation_type: data.type,
        title: data.label,
        timestamp_seconds: data.timestamp_seconds,
      })
      .select()
      .single();

    if (error) throw error;

    const newAnnotation: Annotation = {
      id: annotation.id,
      annotation_type: annotation.annotation_type || data.type,
      title: annotation.title,
      content: annotation.content,
      timestamp_seconds: annotation.timestamp_seconds,
    };

    // For single-moment flow, also set as selected
    if (!isMultiMoment) {
      setSelectedAnnotation(newAnnotation);
    }

    toast.success("Annotation created!", {
      description: `"${data.label}" at ${formatTimestamp(data.timestamp_seconds)}`,
    });

    return newAnnotation;
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!selectedSession || hasReachedLimit) return;

    setIsSubmitting(true);

    try {
      if (isMultiMoment) {
        // Single entry with moments array
        const firstMoment = collectedMoments[0];
        await createSubmission.mutateAsync({
          challenge_id: challenge.id,
          session_id: selectedSession.id,
          clip_start_ms: firstMoment?.clipStartMs ?? 0,
          clip_end_ms: firstMoment?.clipEndMs ?? 0,
          title: autoTitle,
          description: undefined,
          moments: collectedMoments.map((m, i) => ({
            annotation_id: m.annotationId,
            start_ms: m.clipStartMs,
            end_ms: m.clipEndMs,
            order: i,
            label: m.label,
          })),
        });
      } else {
        // Single-moment: original flow
        await createSubmission.mutateAsync({
          challenge_id: challenge.id,
          session_id: selectedSession.id,
          clip_start_ms: clipStartMs,
          clip_end_ms: clipEndMs,
          title: autoTitle,
          description: undefined,
          proof_notes: selectedAnnotation
            ? `Annotation: ${selectedAnnotation.title || selectedAnnotation.annotation_type} at ${selectedAnnotation.timestamp_seconds}s`
            : undefined,
        });
      }

      setStep("success");
    } catch (error) {
      console.error("Failed to create submission:", error);
      toast.error("Failed to submit", {
        description: "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success actions ──
  const handleViewChallenge = () => {
    onOpenChange(false);
    navigate(`/challenges/${challenge.id}`);
  };

  const handleShare = () => {
    toast.info("Share functionality coming soon!");
  };

  const handleSubmitAnother = () => {
    setStep("moment");
    setCollectedMoments([]);
    setEditingChipIndex(null);
    onChangeSession?.();
  };

  const handleClose = () => {
    onOpenChange(false);
    if (step === "success") {
      onSuccess?.();
    }
  };

  const handleAddAnnotation = () => {
    if (selectedSession) {
      onOpenChange(false);
      navigate(`/session/${selectedSession.id}?action=annotate`);
    }
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const ruleSummary = useMemo(() => {
    const source = challenge.rules || challenge.description || "";
    const firstLine = source.split("\n")[0];
    return firstLine.length > 80 ? firstLine.substring(0, 80) + "..." : firstLine;
  }, [challenge.rules, challenge.description]);

  if (!selectedSession) {
    return null;
  }

  // ── Step labels ──
  const stepLabels = isMultiMoment
    ? ["Moments", "Clips", "Details"]
    : ["Moment", "Clip", "Details"];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg">
                Submit to Challenge
              </DialogTitle>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {challenge.title}
              </p>
            </div>
          </div>

          {/* Progress indicator */}
          {step !== "success" && (
            <div className="mt-4">
              <Progress value={getProgress()} className="h-1" />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                {stepLabels.map((label) => (
                  <span
                    key={label}
                    className={cn(
                      (label === "Moments" || label === "Moment") && step === "moment" && "text-primary font-medium",
                      (label === "Clip" || label === "Clips") && step === "clip" && "text-primary font-medium",
                      label === "Details" && step === "metadata" && "text-primary font-medium"
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Challenge context bar */}
            {step !== "success" && (
              <ChallengeContextBar
                ruleSummary={ruleSummary}
                minClipDuration={minClipDuration}
                maxClipDuration={maxClipDuration}
                endsAt={challenge.ends_at}
                requiredMoments={requiredMin}
              />
            )}

            {/* ══════════════════════════════════════════════════════════
                 STEP: MOMENT
                 ══════════════════════════════════════════════════════════ */}
            {step === "moment" && isMultiMoment && (
              <MomentCollector
                requiredMin={requiredMin}
                requiredMax={requiredMax}
                momentLabel={momentLabel}
                moments={collectedMoments}
                onMomentsChange={setCollectedMoments}
                annotations={sessionAnnotations}
                thumbnailUrl={selectedSession.thumbnail_url}
                videoUrl={selectedSession.video_url}
                totalDuration={totalDuration}
                minClipDuration={minClipDuration}
                maxClipDuration={maxClipDuration}
                onCreateInlineAnnotation={handleCreateInlineAnnotation}
                onOpenFullEditor={handleAddAnnotation}
              />
            )}

            {step === "moment" && !isMultiMoment && (
              <div className="space-y-4">
                {sessionHasAnnotations ? (
                  sessionHasMultipleAnnotations ? (
                    <>
                      <h4 className="font-medium">Which moment proves this challenge?</h4>
                      <p className="text-sm text-muted-foreground">
                        Pick the moment that best proves your entry. Your clip will be auto-positioned around it.
                      </p>
                      <AnnotationSelector
                        annotations={sessionAnnotations}
                        selectedAnnotationId={selectedAnnotation?.id}
                        onSelect={handleAnnotationSelect}
                        thumbnailUrl={selectedSession.thumbnail_url}
                        totalDuration={totalDuration}
                      />
                    </>
                  ) : (
                    selectedAnnotation && (
                      <div className="space-y-3">
                        <h4 className="font-medium">Moment selected</h4>
                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-primary/30 bg-primary/5">
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {selectedAnnotation.title || selectedAnnotation.annotation_type}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              at {formatTimestamp(selectedAnnotation.timestamp_seconds)}
                            </p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            Auto-selected
                          </Badge>
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <div className="space-y-4">
                    <h4 className="font-medium">Tag your moment</h4>
                    <p className="text-sm text-muted-foreground">
                      Almost there — tag the exact moment that proves this challenge.
                    </p>

                    {selectedAnnotation ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">
                          Moment selected · <strong>{selectedAnnotation.title || selectedAnnotation.annotation_type}</strong> at {formatTimestamp(selectedAnnotation.timestamp_seconds)}
                        </span>
                      </div>
                    ) : showInlineCreator ? (
                      <InlineAnnotationCreator
                        currentTimeMs={(clipStartMs + clipEndMs) / 2}
                        clipStartMs={0}
                        clipEndMs={totalDuration * 1000}
                        onCancel={() => setShowInlineCreator(false)}
                        onSubmit={async (data) => {
                          await handleCreateInlineAnnotation(data);
                          setShowInlineCreator(false);
                          const annotationMs = data.timestamp_seconds * 1000;
                          const totalMs = totalDuration * 1000;
                          setClipStartMs(Math.max(0, annotationMs - 2000));
                          setClipEndMs(Math.min(totalMs, annotationMs + 2000));
                        }}
                      />
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setShowInlineCreator(true)}
                          className="gap-2"
                        >
                          <Zap className="h-4 w-4" />
                          Quick Annotation
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddAnnotation}
                          className="gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open Full Editor
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                 STEP: CLIP
                 ══════════════════════════════════════════════════════════ */}
            {step === "clip" && isMultiMoment && (
              <MomentPlaylist
                moments={collectedMoments}
                onMomentsChange={setCollectedMoments}
                videoUrl={selectedSession.video_url}
                thumbnailUrl={selectedSession.thumbnail_url}
                totalDuration={totalDuration}
                minClipDuration={minClipDuration}
                maxClipDuration={maxClipDuration}
              />
            )}

            {step === "clip" && !isMultiMoment && (
              <div className="space-y-4">
                <h4 className="font-medium">
                  {selectedAnnotation ? "Clip looks good" : "Select your clip range"}
                </h4>
                {selectedAnnotation && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Moment selected</span>
                    <span className="text-xs text-muted-foreground ml-auto font-mono tabular-nums">
                      {formatTimestamp(selectedAnnotation.timestamp_seconds)}
                    </span>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {selectedAnnotation
                    ? "Auto-positioned around your moment. Adjust if needed."
                    : "Drag the trim handles to select the clip you want to submit."}
                </p>
                <ClipTrimmer
                  videoUrl={selectedSession.video_url}
                  thumbnailUrl={selectedSession.thumbnail_url}
                  totalDuration={totalDuration}
                  minDuration={minClipDuration}
                  maxDuration={maxClipDuration}
                  startMs={clipStartMs}
                  endMs={clipEndMs}
                  onRangeChange={handleRangeChange}
                  annotationTimestamp={selectedAnnotation?.timestamp_seconds}
                />
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                 STEP: METADATA
                 ══════════════════════════════════════════════════════════ */}
            {step === "metadata" && (
              <div className="space-y-4">
                {/* Summary card */}
                <div className="px-4 py-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium">
                      {isMultiMoment
                        ? `You're submitting ${collectedMoments.length} moment${collectedMoments.length !== 1 ? "s" : ""}:`
                        : selectedAnnotation
                          ? "Moment selected · Clip looks good"
                          : "Ready to submit"
                      }
                    </span>
                  </div>

                  {/* Editable moment chips */}
                  {isMultiMoment && collectedMoments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      {collectedMoments.map((m, i) => (
                        editingChipIndex === i ? (
                          <Input
                            key={m.annotationId}
                            ref={chipInputRef}
                            value={m.label}
                            onChange={(e) => {
                              const updated = collectedMoments.map((cm, ci) =>
                                ci === i ? { ...cm, label: e.target.value } : cm
                              );
                              setCollectedMoments(updated);
                            }}
                            onBlur={() => setEditingChipIndex(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Escape") {
                                setEditingChipIndex(null);
                              }
                            }}
                            className="h-6 w-32 text-xs px-2 py-0"
                            autoFocus
                          />
                        ) : (
                          <Badge
                            key={m.annotationId}
                            variant="secondary"
                            className="text-xs gap-1 font-normal cursor-pointer hover:bg-secondary/80 transition-colors"
                            onClick={() => setEditingChipIndex(i)}
                          >
                            {m.label}
                            <span className="text-muted-foreground flex items-center gap-0.5">
                              •
                              {formatTimestamp(m.timestampSeconds)}
                            </span>
                          </Badge>
                        )
                      ))}
                    </div>
                  )}

                  {/* Single-moment chip */}
                  {!isMultiMoment && selectedAnnotation && (
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      <Badge variant="secondary" className="text-xs gap-1 font-normal">
                        {selectedAnnotation.title || selectedAnnotation.annotation_type}
                        <span className="text-muted-foreground flex items-center gap-0.5">
                          •
                          {formatTimestamp(selectedAnnotation.timestamp_seconds)}
                        </span>
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Tap to rename hint (multi-moment only) */}
                {isMultiMoment && collectedMoments.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Tap a chip to rename it
                  </p>
                )}

                {/* Submissions remaining — subtle */}
                <SubmissionLimitsBar
                  currentSubmissions={currentSubmissions}
                  maxSubmissions={maxSubmissions}
                />
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                 STEP: SUCCESS
                 ══════════════════════════════════════════════════════════ */}
            {step === "success" && (
              <SubmissionSuccess
                challengeTitle={challenge.title}
                submissionTitle={autoTitle}
                remainingSubmissions={remainingSubmissions - 1}
                maxSubmissions={maxSubmissions}
                onViewChallenge={handleViewChallenge}
                onShare={handleShare}
                onSubmitAnother={remainingSubmissions > 1 ? handleSubmitAnother : undefined}
                onClose={handleClose}
              />
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {step !== "success" && (
          <div className="px-6 py-4 border-t border-border bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              {step === "moment" ? (
                <Button variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
              ) : (
                <Button variant="ghost" onClick={goToPreviousStep}>
                  Back
                </Button>
              )}

              {step === "metadata" ? (
                <div className="flex flex-col items-end gap-1">
                  <Button
                    onClick={goToNextStep}
                    disabled={!canAdvance || isSubmitting || hasReachedLimit}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Submit Entry
                      </>
                    )}
                  </Button>
                  {isMultiMoment && collectedMoments.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      Includes {collectedMoments.length} moment{collectedMoments.length !== 1 ? "s" : ""}
                    </span>
                  ) : !isMultiMoment && selectedAnnotation ? (
                    <span className="text-xs text-muted-foreground">
                      Includes 1 moment
                    </span>
                  ) : null}
                </div>
              ) : (
                <Button onClick={goToNextStep} disabled={!canAdvance}>
                  Continue
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
