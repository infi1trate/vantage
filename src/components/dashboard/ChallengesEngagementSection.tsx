import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Trophy,
  ArrowRight,
  Users,
  Clock,
  Hourglass,
  Gamepad2,
  Monitor,
  Sparkles,
  Flame,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChallenges } from "@/hooks/useChallenges";
import { type Challenge, getTimeRemaining } from "@/lib/challenges";
import { DifficultyIndicator } from "@/components/challenges/card/DifficultyIndicator";
import { motion } from "framer-motion";

export function ChallengesEngagementSection() {
  const navigate = useNavigate();
  const { data: challenges, isLoading } = useChallenges("active");

  // Sort: ending soonest first (urgency), then by submission count
  const sorted = useMemo(() => {
    if (!challenges) return [];
    return [...challenges].sort((a, b) => {
      // Ending soonest first
      const aEnd = a.ends_at ? new Date(a.ends_at).getTime() : Infinity;
      const bEnd = b.ends_at ? new Date(b.ends_at).getTime() : Infinity;
      if (aEnd !== bEnd) return aEnd - bEnd;
      // Then by submission count descending
      return (b.submission_count || 0) - (a.submission_count || 0);
    });
  }, [challenges]);

  const featured = sorted[0] || null;
  const secondary = sorted.slice(1, 4); // up to 3 more

  if (isLoading) {
    return (
      <section>
        <SectionHeader />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        </div>
      </section>
    );
  }

  if (!featured) {
    return (
      <section>
        <SectionHeader />
        <Card className="p-12 border-border/30 border-dashed text-center">
          <Trophy className="h-10 w-10 text-primary/30 mx-auto mb-4" />
          <p className="font-display text-2xl mb-2">NEW CHALLENGES INCOMING</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
            No active challenges right now. New ones drop regularly — check back soon or browse past winners.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate("/challenges")}
            className="uppercase tracking-wider text-xs"
          >
            Browse Challenges
          </Button>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        onViewAll={() => navigate("/challenges")}
        showViewAll={(challenges?.length || 0) > 4}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Featured (large) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <FeaturedChallengeCard challenge={featured} />
        </motion.div>

        {/* Secondary stack */}
        <div className="flex flex-col gap-4 justify-between">
          {secondary.length > 0 ? (
            secondary.map((c, idx) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.1 + idx * 0.08 }}
              >
                <CompactChallengeCard challenge={c} />
              </motion.div>
            ))
          ) : (
            <Card className="flex-1 border-border/30 border-dashed flex items-center justify-center p-6">
              <p className="text-sm text-muted-foreground text-center">
                More challenges coming soon.
              </p>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({
  onViewAll,
  showViewAll,
}: {
  onViewAll?: () => void;
  showViewAll?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full bg-primary" />
        <div>
          <h2 className="font-display text-2xl tracking-wide">
            CHALLENGES YOU CAN JUMP INTO
          </h2>
          <p className="text-xs text-muted-foreground tracking-wide mt-0.5">
            Compete, prove yourself, win prizes
          </p>
        </div>
      </div>
      {showViewAll && (
        <Button
          variant="ghost"
          onClick={onViewAll}
          className="uppercase text-xs tracking-wider group"
        >
          All challenges
          <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </Button>
      )}
    </div>
  );
}

// ─── Time helpers ────────────────────────────────────────────────────────────

function getUrgency(endsAt: string | null): "normal" | "warning" | "critical" {
  if (!endsAt) return "normal";
  const hoursLeft =
    (new Date(endsAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursLeft <= 2) return "critical";
  if (hoursLeft <= 48) return "warning";
  return "normal";
}

function urgencyBadgeClass(u: ReturnType<typeof getUrgency>) {
  switch (u) {
    case "critical":
      return "bg-destructive text-destructive-foreground animate-pulse-subtle";
    case "warning":
      return "bg-amber-500/90 text-amber-50";
    default:
      return "bg-background/80 backdrop-blur-sm text-foreground";
  }
}

// ─── Featured Card (large) ──────────────────────────────────────────────────

function FeaturedChallengeCard({ challenge }: { challenge: Challenge }) {
  const timeLeft = getTimeRemaining(challenge.ends_at);
  const urgency = getUrgency(challenge.ends_at);
  const difficulty = Math.min(5, Math.max(1, challenge.difficulty || 3)) as
    | 1
    | 2
    | 3
    | 4
    | 5;

  const imageUrl = challenge.thumbnail_url || challenge.preview_video_url || null;
  const isImage =
    imageUrl && !/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(imageUrl);

  return (
    <Link to={`/challenges/${challenge.id}`} className="block h-full">
      <Card
        className={cn(
          "group relative overflow-hidden h-full",
          "border-border/30 bg-card/50",
          "hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10",
          "transition-all duration-300 hover:-translate-y-0.5"
        )}
      >
        {/* Hero image */}
        <div className="relative">
          <AspectRatio ratio={16 / 9}>
            {isImage ? (
              <img
                src={imageUrl}
                alt={challenge.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Trophy className="h-14 w-14 text-primary/40" />
              </div>
            )}
          </AspectRatio>

          {/* Overlay badges */}
          <div className="absolute inset-0 p-3 flex flex-col justify-between pointer-events-none">
            <div className="flex items-start justify-between">
              {challenge.game_name && (
                <Badge
                  variant="secondary"
                  className="bg-background/80 backdrop-blur-sm text-xs"
                >
                  <Gamepad2 className="mr-1 h-3 w-3" />
                  {challenge.game_name}
                </Badge>
              )}
              {timeLeft && (
                <Badge
                  className={cn(
                    "font-mono text-xs ml-auto shadow-lg",
                    urgencyBadgeClass(urgency)
                  )}
                >
                  {urgency === "critical" ? (
                    <Hourglass className="mr-1 h-3 w-3" />
                  ) : (
                    <Clock className="mr-1 h-3 w-3" />
                  )}
                  {timeLeft}
                </Badge>
              )}
            </div>

            <div className="flex items-end justify-between">
              {challenge.is_sponsored && (
                <Badge
                  variant="outline"
                  className="bg-background/80 backdrop-blur-sm text-xs border-primary/30"
                >
                  <Star className="mr-1 h-2.5 w-2.5 text-primary fill-primary" />
                  Sponsored
                </Badge>
              )}
              <Badge className="ml-auto font-semibold uppercase tracking-wider text-xs shadow-lg bg-primary text-primary-foreground">
                Open
              </Badge>
            </div>
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display text-xl md:text-2xl leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {challenge.title}
          </h3>

          <div className="flex items-center justify-between">
            <DifficultyIndicator level={difficulty} />
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{challenge.submission_count || 0} entries</span>
            </div>
          </div>

          {/* Prize */}
          {(challenge.prize_crypto_amount || challenge.prize_description) && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span className="font-mono font-bold text-primary text-sm">
                {challenge.prize_crypto_amount
                  ? `${challenge.prize_crypto_amount} ${challenge.prize_crypto || ""}`
                  : challenge.prize_description}
              </span>
            </div>
          )}

          <Button
            className="w-full font-display uppercase tracking-wider group-hover:shadow-md group-hover:shadow-primary/20 min-h-[44px]"
            tabIndex={-1}
          >
            <Trophy className="mr-2 h-4 w-4" />
            View Challenge
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Compact Card (secondary) ───────────────────────────────────────────────

function CompactChallengeCard({ challenge }: { challenge: Challenge }) {
  const timeLeft = getTimeRemaining(challenge.ends_at);
  const urgency = getUrgency(challenge.ends_at);
  const difficulty = Math.min(5, Math.max(1, challenge.difficulty || 3)) as
    | 1
    | 2
    | 3
    | 4
    | 5;

  const imageUrl = challenge.thumbnail_url || challenge.preview_video_url || null;
  const isImage =
    imageUrl && !/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(imageUrl);

  return (
    <Link to={`/challenges/${challenge.id}`} className="block">
      <Card
        className={cn(
          "group relative overflow-hidden",
          "border-border/30 bg-card/50",
          "hover:border-primary/40 transition-all duration-300",
          "hover:-translate-y-0.5"
        )}
      >
        <div className="flex gap-4 p-3">
          {/* Thumbnail */}
          <div className="w-28 md:w-32 shrink-0 rounded-lg overflow-hidden">
            <AspectRatio ratio={16 / 9}>
              {isImage ? (
                <img
                  src={imageUrl}
                  alt={challenge.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-primary/40" />
                </div>
              )}
            </AspectRatio>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div>
              <h4 className="font-display text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                {challenge.title}
              </h4>

              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {challenge.game_name && (
                  <span className="flex items-center gap-1">
                    <Gamepad2 className="h-3 w-3" />
                    {challenge.game_name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {challenge.submission_count || 0}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <DifficultyIndicator level={difficulty} />

              {timeLeft && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0 font-mono",
                    urgency === "critical" &&
                      "border-destructive/50 text-destructive",
                    urgency === "warning" &&
                      "border-amber-500/50 text-amber-500"
                  )}
                >
                  {urgency === "critical" ? (
                    <Hourglass className="mr-1 h-2.5 w-2.5" />
                  ) : (
                    <Clock className="mr-1 h-2.5 w-2.5" />
                  )}
                  {timeLeft}
                </Badge>
              )}
            </div>
          </div>

          {/* Arrow affordance */}
          <div className="flex items-center shrink-0">
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
