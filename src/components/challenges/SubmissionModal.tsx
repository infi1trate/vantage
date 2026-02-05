import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Loader2, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";
import { type Challenge } from "@/lib/challenges";
import { useCreateSubmission } from "@/hooks/useChallenges";

const submissionSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  proof_notes: z.string().max(1000, "Notes are too long").optional(),
});

type SubmissionFormData = z.infer<typeof submissionSchema>;

interface SubmissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: Challenge;
  selectedSession?: {
    id: string;
    title: string;
    thumbnail_url?: string | null;
    duration_seconds?: number | null;
  } | null;
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
  clipRange,
  onSuccess,
  onChangeSession,
}: SubmissionModalProps) {
  const createSubmission = useCreateSubmission();

  const form = useForm<SubmissionFormData>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      title: selectedSession?.title || "",
      description: "",
      proof_notes: "",
    },
  });

  const onSubmit = async (data: SubmissionFormData) => {
    if (!selectedSession) {
      toast.error("Please select a clip first");
      return;
    }

    try {
      await createSubmission.mutateAsync({
        challenge_id: challenge.id,
        session_id: selectedSession.id,
        clip_start_ms: clipRange?.start_ms,
        clip_end_ms: clipRange?.end_ms,
        title: data.title,
        description: data.description,
        proof_notes: data.proof_notes,
      });

      toast.success("Submission created!", {
        description: "Your entry is pending review.",
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create submission:", error);
      toast.error("Failed to submit", {
        description: "Please try again later.",
      });
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Submit Entry</DialogTitle>
          <DialogDescription>
            Submit your clip to "{challenge.title}"
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Selected Clip Preview */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Selected Clip</label>
              {selectedSession ? (
                <div className="relative group">
                  <AspectRatio ratio={16 / 9}>
                    {selectedSession.thumbnail_url ? (
                      <img
                        src={selectedSession.thumbnail_url}
                        alt={selectedSession.title}
                        className="h-full w-full object-cover rounded-lg border border-border"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted rounded-lg border border-border flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </AspectRatio>
                  
                  {/* Duration badge */}
                  {selectedSession.duration_seconds && (
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white">
                      {formatDuration(selectedSession.duration_seconds)}
                    </div>
                  )}

                  {/* Change button */}
                  {onChangeSession && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={onChangeSession}
                    >
                      Change
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-32 border-dashed"
                  onClick={onChangeSession}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-muted-foreground">Select a clip</span>
                  </div>
                </Button>
              )}
            </div>

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Give your submission a title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
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

            {/* Proof Notes */}
            <FormField
              control={form.control}
              name="proof_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proof Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional context for the judges..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Help judges understand the context of your clip
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createSubmission.isPending || !selectedSession}
              >
                {createSubmission.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Entry
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
