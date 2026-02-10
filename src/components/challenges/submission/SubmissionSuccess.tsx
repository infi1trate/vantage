import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, Share2, Plus, Trophy, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface MomentChip {
  label: string;
  timestampDisplay: string; // e.g. "2:30"
}

interface SponsorInfo {
  name: string;
  logoUrl?: string;
}

interface SubmissionSuccessProps {
  challengeTitle: string;
  submissionTitle?: string; // kept for backward compat, no longer rendered
  remainingSubmissions: number;
  maxSubmissions: number;
  sponsor?: SponsorInfo | null;
  moments?: MomentChip[];
  onViewChallenge: () => void;
  onShare: () => void;
  onSubmitAnother?: () => void;
  onClose: () => void;
}

export function SubmissionSuccess({
  challengeTitle,
  remainingSubmissions,
  maxSubmissions,
  sponsor,
  moments,
  onViewChallenge,
  onShare,
  onSubmitAnother,
  onClose,
}: SubmissionSuccessProps) {
  const canSubmitMore = remainingSubmissions > 0;
  const momentCount = moments?.length || 0;

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
        <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-primary" />
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
        Entry submitted! 🎉
      </h3>

      {/* Description */}
      <p className="text-muted-foreground mb-1">
        Successfully submitted to
      </p>
      <p className="font-medium text-foreground mb-4">
        "{challengeTitle}"
      </p>

      {/* Moments summary */}
      {momentCount > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            Includes {momentCount} moment{momentCount !== 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {moments!.map((m, i) => (
              <Badge key={i} variant="secondary" className="text-xs font-mono">
                {m.label} • {m.timestampDisplay}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Sponsor acknowledgment */}
      {sponsor && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          {sponsor.logoUrl ? (
            <img
              src={sponsor.logoUrl}
              alt={sponsor.name}
              className="h-4 w-4 object-contain opacity-70"
            />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          <span>This challenge is sponsored by <span className="font-medium text-foreground">{sponsor.name}</span>.</span>
        </div>
      )}

      {/* Status badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
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
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onViewChallenge}>
            <ExternalLink className="h-4 w-4 mr-2" />
            View Challenge
          </Button>
          <Button variant="outline" className="flex-1" onClick={onShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share Entry
          </Button>
        </div>

        {canSubmitMore && onSubmitAnother && (
          <Button variant="secondary" className="w-full" onClick={onSubmitAnother}>
            <Plus className="h-4 w-4 mr-2" />
            Submit Another
          </Button>
        )}

        <Button className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </motion.div>
  );
}
