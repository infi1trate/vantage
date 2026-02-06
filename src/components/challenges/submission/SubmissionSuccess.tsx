import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, Share2, Plus, Trophy } from "lucide-react";
import { motion } from "framer-motion";

interface SubmissionSuccessProps {
  challengeTitle: string;
  submissionTitle?: string;
  remainingSubmissions: number;
  maxSubmissions: number;
  onViewChallenge: () => void;
  onShare: () => void;
  onSubmitAnother?: () => void;
  onClose: () => void;
}

export function SubmissionSuccess({
  challengeTitle,
  submissionTitle,
  remainingSubmissions,
  maxSubmissions,
  onViewChallenge,
  onShare,
  onSubmitAnother,
  onClose,
}: SubmissionSuccessProps) {
  const canSubmitMore = remainingSubmissions > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center py-6 px-4"
    >
      {/* Success icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.1 }}
        className="relative mb-6"
      >
        <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.3 }}
          className="absolute -top-1 -right-1 h-8 w-8 rounded-full bg-primary flex items-center justify-center"
        >
          <Trophy className="h-4 w-4 text-primary-foreground" />
        </motion.div>
      </motion.div>

      {/* Title */}
      <h3 className="text-xl font-display font-semibold mb-2">
        Your entry is live! 🎉
      </h3>

      {/* Description */}
      <p className="text-muted-foreground mb-1">
        Successfully submitted to
      </p>
      <p className="font-medium text-foreground mb-4">
        "{challengeTitle}"
      </p>

      {submissionTitle && (
        <div className="px-4 py-2 rounded-lg bg-muted/50 border border-border mb-6">
          <p className="text-sm text-muted-foreground">Submission title:</p>
          <p className="font-medium">{submissionTitle}</p>
        </div>
      )}

      {/* Status badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 text-sm font-medium mb-6">
        <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
        Pending Review
      </div>

      {/* Remaining submissions info */}
      {maxSubmissions > 1 && (
        <p className="text-sm text-muted-foreground mb-6">
          You have <strong>{remainingSubmissions}</strong> submission
          {remainingSubmissions !== 1 ? "s" : ""} remaining for this challenge.
        </p>
      )}

      {/* Actions */}
      <div className="w-full space-y-3">
        {/* Primary actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onViewChallenge}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Challenge
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={onShare}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Entry
          </Button>
        </div>

        {/* Submit another */}
        {canSubmitMore && onSubmitAnother && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={onSubmitAnother}
          >
            <Plus className="h-4 w-4 mr-2" />
            Submit Another
          </Button>
        )}

        {/* Done */}
        <Button className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </motion.div>
  );
}
