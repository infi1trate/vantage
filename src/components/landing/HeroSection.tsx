import { motion, useInView, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { useRef } from "react";

export function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const isInView = useInView(heroRef, { amount: 0.3 });
  const prefersReducedMotion = useReducedMotion();

  // Disable animations if user prefers reduced motion
  const animate = prefersReducedMotion ? {} : { opacity: 1, y: 0 };
  const initial = prefersReducedMotion ? {} : { opacity: 0, y: 20 };

  return (
    <section 
      ref={heroRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 pb-12 px-6"
      aria-labelledby="hero-heading"
    >
      {/* Animated grid background - static for reduced motion */}
      <div className="absolute inset-0 bg-background">
        {prefersReducedMotion ? (
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />
        ) : (
          <motion.div 
            className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]"
            animate={{ backgroundPosition: ["0px 0px", "48px 48px"] }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>

      {/* Subtle radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.04)_0%,transparent_60%)]" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-5xl mx-auto">
        {/* Gameplay frame mockup */}
        <motion.div
          initial={initial}
          animate={animate}
          transition={prefersReducedMotion ? {} : { duration: 0.8, delay: 0.2 }}
          className="relative aspect-video rounded-xl overflow-hidden border border-border/40 bg-card/50 shadow-elevated mb-12"
          role="img"
          aria-label="Gameplay capture preview showing a video frame with facecam overlay, voice waveform indicator, and an annotation pin marking a clutch play moment"
        >
          {/* Fake gameplay background */}
          <div className="absolute inset-0 bg-gradient-to-br from-muted/30 via-background to-muted/20">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]" />
          </div>

          {/* Facecam bubble - top right */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
            transition={prefersReducedMotion ? {} : { duration: 0.5, delay: 0.6 }}
            className="absolute top-4 right-4 w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-primary/40"
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50" />
            {/* Glow pulse - disabled for reduced motion */}
            {!prefersReducedMotion && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                animate={{ 
                  boxShadow: [
                    "0 0 0px hsl(var(--primary) / 0)",
                    "0 0 20px hsl(var(--primary) / 0.3)",
                    "0 0 0px hsl(var(--primary) / 0)"
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-muted-foreground/20" />
            </div>
          </motion.div>

          {/* Voice waveform - bottom left */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
            transition={prefersReducedMotion ? {} : { duration: 0.5, delay: 0.8 }}
            className="absolute bottom-4 left-4 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border/50"
            aria-hidden="true"
          >
            <div className="w-2 h-2 rounded-full bg-vantage-danger" />
            <div className="flex items-end gap-0.5 h-4">
              {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4, 0.7, 0.5].map((height, i) => (
                prefersReducedMotion ? (
                  <div
                    key={i}
                    className="w-0.5 bg-primary rounded-full"
                    style={{ height: `${height * 16}px` }}
                  />
                ) : (
                  <motion.div
                    key={i}
                    className="w-0.5 bg-primary rounded-full"
                    animate={{ height: [`${height * 16}px`, `${height * 8}px`, `${height * 16}px`] }}
                    transition={{ duration: 0.8 + i * 0.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 }}
                  />
                )
              ))}
            </div>
          </motion.div>

          {/* Annotation pin with tooltip */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2">
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.5, y: 10 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
              transition={prefersReducedMotion ? {} : { duration: 0.4, delay: 1.2, ease: "easeOut" }}
              className="relative"
            >
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/50 bg-primary/10 backdrop-blur-sm">
                <Star className="w-4 h-4 text-primary fill-primary" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground">Clutch Play</span>
                <span className="text-xs font-mono text-muted-foreground">1:47</span>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0.5 h-3 bg-gradient-to-b from-primary/50 to-transparent" aria-hidden="true" />
            </motion.div>

            {/* Analysis tooltip - accessible via focus */}
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 8, scale: 0.95 }}
              animate={isInView && !prefersReducedMotion ? { opacity: 1, y: 0, scale: 1 } : prefersReducedMotion ? {} : { opacity: 0, y: 8, scale: 0.95 }}
              transition={prefersReducedMotion ? {} : { duration: 0.5, delay: 1.8, ease: "easeOut" }}
              className="absolute left-1/2 -translate-x-1/2 top-full mt-6 w-64 md:w-72"
              role="note"
              aria-label="AI Analysis: Over-peeked before reload — lost timing advantage"
            >
              <div className="relative px-4 py-3 rounded-lg border border-vantage-warning/40 bg-vantage-warning/10 backdrop-blur-sm">
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-px h-2 bg-gradient-to-t from-vantage-warning/40 to-transparent" aria-hidden="true" />
                <div className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-vantage-warning mt-2 shrink-0" aria-hidden="true" />
                  <p className="text-sm text-foreground leading-relaxed">
                    <span className="text-vantage-warning font-medium">Analysis: </span>
                    Over-peeked before reload — lost timing advantage
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background)/0.4)_100%)]" aria-hidden="true" />
        </motion.div>

        {/* Text content */}
        <div className="text-center">
          <motion.h1
            id="hero-heading"
            initial={initial}
            animate={animate}
            transition={prefersReducedMotion ? {} : { duration: 0.6, delay: 0.4 }}
            className="font-display text-5xl md:text-7xl lg:text-8xl leading-none tracking-tight mb-4"
          >
            See the Game Differently
          </motion.h1>

          <motion.p
            initial={initial}
            animate={animate}
            transition={prefersReducedMotion ? {} : { duration: 0.5, delay: 0.6 }}
            className="text-xl md:text-2xl text-primary font-medium mb-4"
          >
            Vantage is the Loom for Gamers.
          </motion.p>

          <motion.p
            initial={initial}
            animate={animate}
            transition={prefersReducedMotion ? {} : { duration: 0.5, delay: 0.7 }}
            className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Record gameplay, voice, reactions, and intent — all synchronized in one continuous perspective.
          </motion.p>

          {/* CTAs - fully keyboard accessible */}
          <motion.div
            initial={initial}
            animate={animate}
            transition={prefersReducedMotion ? {} : { duration: 0.5, delay: 0.9 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            role="group"
            aria-label="Call to action buttons"
          >
            <Button
              size="lg"
              className="h-12 px-8 text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-offset-background"
              asChild
            >
              <Link to="/auth">Start Recording</Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-12 px-6 text-base text-muted-foreground hover:text-foreground focus-visible:ring-offset-background"
              asChild
            >
              <Link to="/auth">Log in</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
