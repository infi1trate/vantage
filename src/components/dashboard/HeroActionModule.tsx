import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Monitor, Trophy, Video, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaptureSession } from "@/lib/captures";
import type { Challenge } from "@/lib/challenges";
import { motion } from "framer-motion";

interface HeroActionModuleProps {
  user: { email?: string } | null;
  sessions: CaptureSession[];
  activeChallenges: Challenge[];
  onOpenVantage: () => void;
}

/**
 * Determines the primary "next action" CTA based on user state.
 */
function getNextAction(sessions: CaptureSession[], activeChallenges: Challenge[]) {
  const readySessions = sessions.filter((s) => s.status === "ready");
  const processingSessions = sessions.filter((s) => s.status === "processing");

  // If there are sessions processing, nudge them to wait / review
  if (processingSessions.length > 0) {
    return {
      headline: "YOUR SESSION IS PROCESSING",
      subtext: `${processingSessions.length} capture${processingSessions.length > 1 ? "s" : ""} still cooking. Review your ready sessions while you wait.`,
      cta: "Go to Library",
      route: "/library",
      icon: Video,
      variant: "teal" as const,
    };
  }

  // If there are active challenges and the user has some sessions, suggest a challenge
  if (activeChallenges.length > 0 && readySessions.length > 0) {
    return {
      headline: "ENTER A CHALLENGE",
      subtext: `${activeChallenges.length} challenge${activeChallenges.length > 1 ? "s" : ""} open now. Submit your best clip and compete for prizes.`,
      cta: "Browse Challenges",
      route: "/challenges",
      icon: Trophy,
      variant: "primary" as const,
    };
  }

  // If the user has ready sessions but no challenges, review them
  if (readySessions.length > 0) {
    return {
      headline: "REVIEW YOUR CAPTURES",
      subtext: `You have ${readySessions.length} session${readySessions.length > 1 ? "s" : ""} ready for film room review. Add annotations, create reels, and share.`,
      cta: "Open Library",
      route: "/library",
      icon: Video,
      variant: "primary" as const,
    };
  }

  // New user — prompt to capture
  return {
    headline: "START YOUR FIRST CAPTURE",
    subtext: "Record your gameplay with the Vantage desktop app, then review, annotate, and share your best moments.",
    cta: "Open Vantage (Desktop)",
    route: null,
    icon: Monitor,
    variant: "primary" as const,
  };
}

export function HeroActionModule({ user, sessions, activeChallenges, onOpenVantage }: HeroActionModuleProps) {
  const navigate = useNavigate();
  const action = getNextAction(sessions, activeChallenges);

  const displayName = user?.email?.split("@")[0].toUpperCase() || "PLAYER";

  return (
    <section className="relative overflow-hidden rounded-xl border border-border/30">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-dark" />
      <div
        className={cn(
          "absolute inset-0 -z-10 opacity-[0.08]",
          action.variant === "primary"
            ? "bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)),transparent_70%)]"
            : "bg-[radial-gradient(ellipse_at_top_right,hsl(var(--vantage-teal)),transparent_70%)]"
        )}
      />

      <div className="px-6 py-10 md:px-10 md:py-14 lg:px-14 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Welcome back, {displayName}
          </p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-wide text-foreground mb-4">
            {action.headline}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed font-sans">
            {action.subtext}
          </p>
          <Button
            size="lg"
            onClick={() => {
              if (action.route) {
                navigate(action.route);
              } else {
                onOpenVantage();
              }
            }}
            className="font-bold uppercase tracking-wider glow-primary group"
          >
            <action.icon className="mr-2 h-5 w-5" />
            {action.cta}
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
