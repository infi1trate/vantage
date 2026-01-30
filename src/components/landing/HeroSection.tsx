import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 pb-12 px-6">
      {/* Animated grid background */}
      <div className="absolute inset-0 bg-background">
        <motion.div 
          className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]"
          animate={{ 
            backgroundPosition: ["0px 0px", "48px 48px"]
          }}
          transition={{ 
            duration: 60, 
            repeat: Infinity, 
            ease: "linear" 
          }}
        />
      </div>

      {/* Subtle radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.04)_0%,transparent_60%)]" />

      <div className="relative z-10 w-full max-w-5xl mx-auto">
        {/* Gameplay frame mockup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative aspect-video rounded-xl overflow-hidden border border-border/40 bg-card/50 shadow-elevated mb-12"
        >
          {/* Fake gameplay background */}
          <div className="absolute inset-0 bg-gradient-to-br from-muted/30 via-background to-muted/20">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]" />
          </div>

          {/* Facecam bubble - top right */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="absolute top-4 right-4 w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-primary/40"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50" />
            {/* Glow pulse */}
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
            {/* Placeholder silhouette */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-muted-foreground/20" />
            </div>
          </motion.div>

          {/* Voice waveform - bottom left */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="absolute bottom-4 left-4 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border/50"
          >
            <div className="w-2 h-2 rounded-full bg-vantage-danger animate-pulse" />
            <div className="flex items-end gap-0.5 h-4">
              {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4, 0.7, 0.5].map((height, i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-primary rounded-full"
                  animate={{ 
                    height: [`${height * 16}px`, `${height * 8}px`, `${height * 16}px`]
                  }}
                  transition={{ 
                    duration: 0.8 + i * 0.1, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    delay: i * 0.05
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* Annotation pin */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.2, ease: "easeOut" }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/50 bg-primary/10 backdrop-blur-sm">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <span className="text-sm font-medium text-foreground">Clutch Play</span>
              <span className="text-xs font-mono text-muted-foreground">1:47</span>
            </div>
            {/* Pin tail */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0.5 h-3 bg-gradient-to-b from-primary/50 to-transparent" />
          </motion.div>

          {/* Subtle vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background)/0.4)_100%)]" />
        </motion.div>

        {/* Text content */}
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="font-display text-5xl md:text-7xl lg:text-8xl leading-none tracking-tight mb-4"
          >
            See the Game Differently
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-xl md:text-2xl text-primary font-medium mb-4"
          >
            Vantage is the Loom for Gamers.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Record gameplay, voice, reactions, and intent — all synchronized in one continuous perspective.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              className="h-12 px-8 text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90"
              asChild
            >
              <Link to="/auth">Start Recording</Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-12 px-6 text-base text-muted-foreground hover:text-foreground"
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
