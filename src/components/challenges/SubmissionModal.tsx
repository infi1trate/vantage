import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trophy, Send, CheckCircle2, Tag, Zap, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { type Challenge } from "@/lib/challenges";
import { useCreateSubmission, useUserSubmissions } from "@/hooks/useChallenges";
import {
  AnnotationSelector,
  ChallengeContextBar,
  ClipTrimmer,
  InlineAnnotationCreator,
  ProofConfirmation,
  SubmissionLimitsBar,
  SubmissionSuccess,
} from "./submission";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// Submission steps
type SubmissionStep = "moment" | "clip" | "metadata" | "success";

const submissionSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().max(500, "Description is too long").optional(),
});

type SubmissionFormData = z.infer<typeof submissionSchema>;

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

  // Step management — always: moment → clip → metadata → success
  const [step, setStep] = useState<SubmissionStep>("moment");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clip trim state
  const [clipStartMs, setClipStartMs] = useState(initialClipRange?.start_ms ?? 0);
  const [clipEndMs, setClipEndMs] = useState(
    initialClipRange?.end_ms ?? (selectedSession?.duration_seconds ?? 60) * 1000
  );
  const [currentPlaybackMs, setCurrentPlaybackMs] = useState(0);

  // Annotation state
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(
    initialAnnotation ?? selectedSession?.annotations?.[0] ?? null
  );
  const [isProofConfirmed, setIsProofConfirmed] = useState(false);
  const [isAnnotationPreExisting, setIsAnnotationPreExisting] = useState(false);
  const [showInlineCreator, setShowInlineCreator] = useState(false);

  // Derived: does session have annotations?
  const sessionAnnotations = selectedSession?.annotations ?? [];
  const sessionHasAnnotations = sessionAnnotations.length > 0;
  const sessionHasMultipleAnnotations = sessionAnnotations.length > 1;

  // Form state
  const form = useForm<SubmissionFormData>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      title: selectedSession?.title || "",
      description: "",
    },
  });

  // Reset state when modal opens with new session
  useEffect(() => {
    if (open && selectedSession) {
      setIsSubmitting(false);
      setShowInlineCreator(false);

      const annotations = selectedSession.annotations ?? [];
      const annotation = initialAnnotation ?? annotations[0] ?? null;
      setSelectedAnnotation(annotation);

      // Always start at moment step
      setStep("moment");

      // Pre-compute clip range if we have an annotation
      if (annotation) {
        const annotationMs = annotation.timestamp_seconds * 1000;
        const totalMs = (selectedSession.duration_seconds ?? 60) * 1000;
        setClipStartMs(Math.max(0, annotationMs - 2000));
        setClipEndMs(Math.min(totalMs, annotationMs + 2000));
        setIsAnnotationPreExisting(true);
        setIsProofConfirmed(true);
      } else if (initialClipRange) {
        setClipStartMs(initialClipRange.start_ms);
        setClipEndMs(initialClipRange.end_ms);
        setIsAnnotationPreExisting(false);
        setIsProofConfirmed(false);
      } else {
        setClipStartMs(0);
        setClipEndMs((selectedSession.duration_seconds ?? 60) * 1000);
        setIsAnnotationPreExisting(false);
        setIsProofConfirmed(false);
      }

      form.reset({
        title: selectedSession.title || "",
        description: "",
      });
    }
  }, [open, selectedSession, initialAnnotation, initialClipRange, form]);

  // Derived values
  const totalDuration = selectedSession?.duration_seconds ?? 60;
  const minClipDuration = 5;
  const maxClipDuration = 60;
  const clipDuration = (clipEndMs - clipStartMs) / 1000;
  const isClipValid = clipDuration >= minClipDuration && clipDuration <= maxClipDuration;

  // Submission limits
  const currentSubmissions = userSubmissions.length;
  const maxSubmissions = challenge.max_submissions_per_user ?? 1;
  const remainingSubmissions = maxSubmissions - currentSubmissions;
  const hasReachedLimit = remainingSubmissions <= 0;

  // Check if annotation is within clip
  const annotationWithinClip = useMemo(() => {
    if (!selectedAnnotation) return false;
    const annotationMs = selectedAnnotation.timestamp_seconds * 1000;
    return annotationMs >= clipStartMs && annotationMs <= clipEndMs;
  }, [selectedAnnotation, clipStartMs, clipEndMs]);

  const skipProofStep = isAnnotationPreExisting && annotationWithinClip;

  // Progress: moment → clip → metadata (always 3 steps)
  const getProgress = () => {
    switch (step) {
      case "moment": return 33;
      case "clip": return 66;
      case "metadata": return 100;
      case "success": return 100;
      default: return 0;
    }
  };

  // Can advance to next step
  const canAdvance = useMemo(() => {
    switch (step) {
      case "moment":
        // If annotations exist, one must be selected. If none, user can still proceed
        // (they'll need to create one inline or via full editor, but we don't block moment step)
        return true;
      case "clip":
        return isClipValid;
      case "metadata":
        // Only block at final step if no annotation at all
        return form.formState.isValid && (selectedAnnotation !== null);
      default:
        return false;
    }
  }, [step, isClipValid, selectedAnnotation, form.formState.isValid]);

  // Handle annotation selection from the selector
  const handleAnnotationSelect = (annotation: Annotation) => {
    setSelectedAnnotation(annotation);
    const annotationMs = annotation.timestamp_seconds * 1000;
    const totalMs = (selectedSession?.duration_seconds ?? 60) * 1000;
    setClipStartMs(Math.max(0, annotationMs - 2000));
    setClipEndMs(Math.min(totalMs, annotationMs + 2000));
    setIsProofConfirmed(true);
    setIsAnnotationPreExisting(true);
  };

  // Handle clip range change
  const handleRangeChange = (startMs: number, endMs: number) => {
    setClipStartMs(startMs);
    setClipEndMs(endMs);
  };

  // Navigate between steps
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

  // Handle submission
  const handleSubmit = async () => {
    if (!selectedSession || hasReachedLimit) return;

    const data = form.getValues();
    setIsSubmitting(true);

    try {
      await createSubmission.mutateAsync({
        challenge_id: challenge.id,
        session_id: selectedSession.id,
        clip_start_ms: clipStartMs,
        clip_end_ms: clipEndMs,
        title: data.title,
        description: data.description,
        proof_notes: selectedAnnotation
          ? `Annotation: ${selectedAnnotation.title || selectedAnnotation.annotation_type} at ${selectedAnnotation.timestamp_seconds}s`
          : undefined,
      });

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

  // Success state actions
  const handleViewChallenge = () => {
    onOpenChange(false);
    navigate(`/challenges/${challenge.id}`);
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    toast.info("Share functionality coming soon!");
  };

  const handleSubmitAnother = () => {
    setStep("moment");
    setIsProofConfirmed(false);
    form.reset({ title: "", description: "" });
    onChangeSession?.();
  };

  const handleClose = () => {
    onOpenChange(false);
    if (step === "success") {
      onSuccess?.();
    }
  };

  // Handle add annotation action (full editor)
  const handleAddAnnotation = () => {
    if (selectedSession) {
      onOpenChange(false);
      navigate(`/session/${selectedSession.id}?action=annotate`);
    }
  };

  // Handle inline annotation creation
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

    setSelectedAnnotation(newAnnotation);
    toast.success("Annotation created!", {
      description: `"${data.label}" at ${formatTimestamp(data.timestamp_seconds)}`,
    });

    return newAnnotation;
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get rule summary (first line of rules or description)
  const ruleSummary = useMemo(() => {
    const source = challenge.rules || challenge.description || "";
    const firstLine = source.split("\n")[0];
    return firstLine.length > 80 ? firstLine.substring(0, 80) + "..." : firstLine;
  }, [challenge.rules, challenge.description]);

  if (!selectedSession) {
    return null;
  }

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
                <span className={cn(step === "moment" && "text-primary font-medium")}>
                  Moment
                </span>
                <span className={cn(step === "clip" && "text-primary font-medium")}>
                  Clip
                </span>
                <span className={cn(step === "metadata" && "text-primary font-medium")}>
                  Details
                </span>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Challenge context bar - always visible except success */}
            {step !== "success" && (
              <ChallengeContextBar
                ruleSummary={ruleSummary}
                minClipDuration={minClipDuration}
                maxClipDuration={maxClipDuration}
                endsAt={challenge.ends_at}
              />
            )}

            {/* Step 1: Moment */}
            {step === "moment" && (
              <div className="space-y-4">
                {sessionHasAnnotations ? (
                  sessionHasMultipleAnnotations ? (
                    <>
                      <h4 className="font-medium">Select a moment to submit</h4>
                      <p className="text-sm text-muted-foreground">
                        Pick the moment that best proves your challenge entry. The clip will be auto-generated around it.
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
                    /* Single annotation — show confirmation card */
                    selectedAnnotation && (
                      <div className="space-y-3">
                        <h4 className="font-medium">Submitting moment</h4>
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
                  /* No annotations — helper text + inline creator */
                  <div className="space-y-4">
                    <h4 className="font-medium">Tag the moment</h4>
                    <p className="text-sm text-muted-foreground">
                      Tag the exact moment that proves this challenge. Add a quick annotation or use the full editor.
                    </p>

                    {selectedAnnotation ? (
                      /* Annotation just created — show confirmation */
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">
                          <strong>{selectedAnnotation.title || selectedAnnotation.annotation_type}</strong> at {formatTimestamp(selectedAnnotation.timestamp_seconds)}
                        </span>
                      </div>
                    ) : showInlineCreator ? (
                      /* Inline annotation creator */
                      <InlineAnnotationCreator
                        currentTimeMs={(clipStartMs + clipEndMs) / 2}
                        clipStartMs={0}
                        clipEndMs={totalDuration * 1000}
                        onCancel={() => setShowInlineCreator(false)}
                        onSubmit={async (data) => {
                          await handleCreateInlineAnnotation(data);
                          setShowInlineCreator(false);
                          // Auto-generate clip range around the new annotation
                          const annotationMs = data.timestamp_seconds * 1000;
                          const totalMs = totalDuration * 1000;
                          setClipStartMs(Math.max(0, annotationMs - 2000));
                          setClipEndMs(Math.min(totalMs, annotationMs + 2000));
                          setIsAnnotationPreExisting(true);
                          setIsProofConfirmed(true);
                        }}
                      />
                    ) : (
                      /* CTAs to start annotation */
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

            {/* Step 2: Clip */}
            {step === "clip" && (
              <div className="space-y-4">
                <h4 className="font-medium">
                  {selectedAnnotation ? "Refine your clip range" : "Select your clip range"}
                </h4>
                {selectedAnnotation && (
                  <p className="text-sm text-muted-foreground">
                    Clip auto-positioned around your moment. Adjust the trim handles if needed.
                  </p>
                )}
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

            {/* Step: Metadata */}
            {step === "metadata" && (
              <div className="space-y-4">
                <h4 className="font-medium">Add details</h4>
                <Form {...form}>
                  <form className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Give your submission a title"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe what makes this clip special..."
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Optional</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>

                {/* Submission limits */}
                <SubmissionLimitsBar
                  currentSubmissions={currentSubmissions}
                  maxSubmissions={maxSubmissions}
                />
              </div>
            )}

            {/* Step: Success */}
            {step === "success" && (
              <SubmissionSuccess
                challengeTitle={challenge.title}
                submissionTitle={form.getValues().title}
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

        {/* Footer - Navigation buttons */}
        {step !== "success" && (
          <div className="px-6 py-4 border-t border-border bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              {/* Back / Cancel */}
              {step === "moment" ? (
                <Button variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
              ) : (
                <Button variant="ghost" onClick={goToPreviousStep}>
                  Back
                </Button>
              )}

              {/* Next / Submit */}
              {step === "metadata" ? (
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
