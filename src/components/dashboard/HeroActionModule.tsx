import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Monitor, Download, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaptureSession } from "@/lib/captures";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

interface HeroActionModuleProps {
  user: { email?: string } | null;
  sessions: CaptureSession[];
  onOpenVantage: () => void;
}

/**
 * Derive the motivational headline, copy, and CTA based on user state.
 * The primary action is always "get the user recording" via the desktop app.
 */
function deriveHeroContent(sessions: CaptureSession[]) {
  const hasSessions = sessions.length > 0;
  const mostRecent = hasSessions ? sessions[0] : null; // already sorted desc

  // Build the "last played" micro-copy
  let lastPlayedLine: string | null = null;
  if (mostRecent) {
    const gameName = mostRecent.game_name || "a session";
    const timeAgo = formatDistanceToNow(new Date(mostRecent.created_at), { addSuffix: true });
    lastPlayedLine = `Last played: ${gameName} · ${timeAgo}`;
  }

  if (!hasSessions) {
    return {
      headline: "YOUR NEXT MOVE",
      subtext: "Record your gameplay, review every play, and prove you're built different. One click to start.",
      lastPlayed: null,
    };
  }

  const processing = sessions.filter((s) => s.status === "processing");
  if (processing.length > 0) {
    return {
      headline: "YOUR NEXT MOVE",
      subtext: `${processing.length} session${processing.length > 1 ? "s" : ""} still processing. Jump back in and capture your next highlight.`,
      lastPlayed: lastPlayedLine,
    };
  }

  return {
    headline: "YOUR NEXT MOVE",
    subtext: "Your clips are ready. Capture your next session, enter a challenge, or push your rank higher.",
    lastPlayed: lastPlayedLine,
  };
}

export function HeroActionModule({ user, sessions, onOpenVantage }: HeroActionModuleProps) {
  const navigate = useNavigate();
  const hero = deriveHeroContent(sessions);

  const displayName = user?.email?.split("@")[0]?.toUpperCase() || "PLAYER";

  return (
    <section className="relative overflow-hidden rounded-xl border border-border/30">
      {/* Layered background */}
      <div className="absolute inset-0 -z-10 bg-gradient-dark" />
      <div className="absolute inset-0 -z-10 opacity-[0.07] bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)),transparent_60%)]" />
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="px-6 py-12 md:px-10 md:py-16 lg:px-14 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-2xl"
        >
          {/* Eyebrow */}
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Welcome back, {displayName}
          </p>

          {/* Headline */}
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-wide text-foreground mb-5 leading-[0.95]">
            {hero.headline}
          </h1>

          {/* Supporting copy */}
          <p className="text-base md:text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed font-sans">
            {hero.subtext}
          </p>

          {/* CTA cluster */}
          <div className="flex flex-col sm:flex-row items-start gap-3">
            <Button
              size="lg"
              onClick={onOpenVantage}
              className="font-bold uppercase tracking-wider glow-primary group min-h-[48px]"
            >
              <Monitor className="mr-2 h-5 w-5" />
              Open Vantage (Desktop)
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="uppercase tracking-wider text-xs min-h-[48px]"
              asChild
            >
              <a
                href="https://www.dropbox.com/scl/fi/nibofwti4pf9rtw591i6e/Vantage-Desktop-0.1.0-arm64-mac.zip?rlkey=vtcmh6zpanea8poou7lbqwtf8&dl=1"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="mr-2 h-4 w-4" />
                Download for Mac
              </a>
            </Button>
          </div>

          {/* Last played micro-copy */}
          {hero.lastPlayed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="mt-6 text-xs text-muted-foreground/70 tracking-wide font-mono-data"
            >
              {hero.lastPlayed}
            </motion.p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
