import { motion, useInView, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, Mic, Camera, Trophy, ShieldCheck, Banknote, CheckCircle2 } from "lucide-react";
import fortniteGameplay from "@/assets/fortnite-gameplay.webp";
import { useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const isInView = useInView(heroRef, { amount: 0.3 });
  const prefersReducedMotion = useReducedMotion();
  
  // Simulated recording state
  const [recordingTime, setRecordingTime] = useState(107); // 1:47
  const [isRecording] = useState(true);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistError, setWaitlistError] = useState("");
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaitlistError("");
    if (!isValidEmail(waitlistEmail)) {
      setWaitlistError("Please enter a valid email.");
      return;
    }
    setWaitlistLoading(true);
    try {
      const { error } = await supabase.from("waitlist").insert({ email: waitlistEmail.trim().toLowerCase(), source: "landing" });
      if (error) {
        if (error.code === "23505") {
          setWaitlistSuccess(true);
        } else {
          setWaitlistError("Something went wrong. Try again.");
        }
      } else {
        setWaitlistSuccess(true);
      }
    } catch {
      setWaitlistError("Something went wrong. Try again.");
    } finally {
      setWaitlistLoading(false);
    }
  };

  const proofItems = [
    { icon: Trophy, label: "Weekly Challenges" },
    { icon: ShieldCheck, label: "Verified Submissions" },
    { icon: Banknote, label: "Cash + Perks" },
  ];

  // Increment recording time
  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = setInterval(() => {
      setRecordingTime((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <section 
      ref={heroRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 pb-12 px-6"
      aria-labelledby="hero-heading"
    >
      {/* Animated grid background */}
      <div className="absolute inset-0 bg-background">
        <motion.div 
          className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]"
          animate={prefersReducedMotion ? {} : { backgroundPosition: ["0px 0px", "48px 48px"] }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06)_0%,transparent_60%)]" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <motion.h1
            id="hero-heading"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: prefersReducedMotion ? 0 : 0 }}
            className="font-display text-5xl md:text-7xl lg:text-8xl leading-none tracking-tight text-primary mb-4"
            style={{ textShadow: "0 0 24px hsl(var(--primary) / 0.35)" }}
          >
            GET PAID TO GAME
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: prefersReducedMotion ? 0 : 0.12 }}
            className="text-xl md:text-2xl text-foreground/90 font-medium mb-2"
          >
            Turn your gameplay into challenges, rewards, and real-world payouts — automatically.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: prefersReducedMotion ? 0 : 0.24 }}
            className="text-base text-muted-foreground mb-6 max-w-2xl mx-auto"
          >
            Vantage analyzes your sessions, tags key moments, and unlocks rewards for competitive play.
          </motion.p>

          {/* Proof row */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : 0.36 }}
            className="flex items-center justify-center gap-4 md:gap-6 mb-6"
          >
            {proofItems.map((item, i) => (
              <motion.div
                key={item.label}
                whileHover={prefersReducedMotion ? {} : { boxShadow: "0 0 12px hsl(var(--primary) / 0.15)" }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/40 bg-card/30 backdrop-blur-sm transition-shadow"
              >
                <item.icon className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs uppercase tracking-wider font-mono text-muted-foreground">{item.label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Waitlist input */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : 0.48 }}
            className="max-w-sm mx-auto"
          >
            {waitlistSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-primary/30 bg-primary/5"
              >
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-foreground/90">You're on the list. We'll email you at launch.</span>
              </motion.div>
            ) : (
              <form onSubmit={handleWaitlistSubmit}>
                <div className="flex items-center gap-2">
                  <Input
                    id="waitlist-input"
                    type="email"
                    placeholder="you@example.com"
                    value={waitlistEmail}
                    onChange={(e) => { setWaitlistEmail(e.target.value); setWaitlistError(""); }}
                    className={`h-10 bg-card/40 border-border/50 ${waitlistError ? "border-destructive/60" : ""}`}
                    required
                  />
                  <Button type="submit" size="sm" className="shrink-0 h-10 px-5" disabled={waitlistLoading}>
                    {waitlistLoading ? "..." : "Get Early Access"}
                  </Button>
                </div>
                {waitlistError ? (
                  <p className="text-xs text-destructive mt-1.5 text-left">{waitlistError}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground/60 mt-1.5 text-center">No spam. First access goes to early signups.</p>
                )}
              </form>
            )}
          </motion.div>
        </div>

        {/* Live recording interface */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: prefersReducedMotion ? 0 : 0.8 }}
          className="relative aspect-video rounded-xl overflow-hidden border border-border/40 bg-card/30 shadow-elevated mb-12"
          role="img"
          aria-label="Live gameplay capture interface"
        >
          {/* Gameplay background with dynamic scan lines */}
          <div className="absolute inset-0 bg-gradient-to-br from-muted/20 via-background to-muted/10">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.008)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.008)_1px,transparent_1px)] bg-[size:24px_24px]" />
            
            {/* Subtle scan line effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent"
              animate={prefersReducedMotion ? {} : { y: ["-100%", "100%"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
          </div>

          {/* Recording indicator - top left */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 1.1 }}
            className="absolute top-4 left-4 flex items-center gap-3"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/20 border border-destructive/40 backdrop-blur-sm">
              <motion.div
                className="w-2 h-2 rounded-full bg-destructive"
                animate={prefersReducedMotion ? {} : { opacity: [1, 0.4, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-xs font-mono text-destructive font-medium uppercase tracking-wider">REC</span>
            </div>
            <span className="font-mono text-sm text-foreground/80">{formatTime(recordingTime)}</span>
          </motion.div>

          {/* Facecam bubble - top right */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="absolute top-4 right-4 w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden border-2 border-primary/30 bg-muted/50"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-muted/80 to-muted/40" />
            
            {/* Glow pulse */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              animate={prefersReducedMotion ? {} : { 
                boxShadow: [
                  "0 0 0px hsl(var(--primary) / 0)",
                  "0 0 30px hsl(var(--primary) / 0.2)",
                  "0 0 0px hsl(var(--primary) / 0)"
                ]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            
            {/* Camera icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera className="w-8 h-8 text-muted-foreground/40" />
            </div>
            
            {/* Facecam label */}
            <div className="absolute bottom-2 left-2 right-2">
              <div className="px-2 py-0.5 rounded bg-background/60 backdrop-blur-sm text-center">
                <span className="text-[10px] font-mono text-muted-foreground uppercase">Facecam</span>
              </div>
            </div>
          </motion.div>

          {/* Voice waveform - bottom left */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 1.4 }}
            className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-background/70 backdrop-blur-sm border border-border/50"
          >
            <Mic className="w-3.5 h-3.5 text-primary" />
            <div className="flex items-end gap-0.5 h-5">
              {[0.3, 0.6, 0.4, 0.8, 0.5, 0.9, 0.4, 0.7, 0.5, 0.6, 0.3].map((height, i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-primary rounded-full"
                  animate={prefersReducedMotion ? { height: `${height * 20}px` } : { 
                    height: [`${height * 20}px`, `${height * 10}px`, `${height * 20}px`]
                  }}
                  transition={{ 
                    duration: 0.6 + i * 0.08, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    delay: i * 0.04
                  }}
                />
              ))}
            </div>
            <span className="text-xs font-mono text-muted-foreground ml-1">-12dB</span>
          </motion.div>

          {/* Live annotation appearing */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2">
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.8, ease: [0.23, 1, 0.32, 1] }}
              className="relative"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/50 bg-primary/10 backdrop-blur-sm shadow-lg shadow-primary/10">
                <Star className="w-4 h-4 text-primary fill-primary" />
                <span className="font-medium text-foreground">Clutch Play</span>
                <span className="text-xs font-mono text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">{formatTime(recordingTime)}</span>
              </div>
              
              {/* Pin line */}
              <motion.div 
                className="absolute left-1/2 -translate-x-1/2 top-full w-px bg-gradient-to-b from-primary/60 to-transparent"
                initial={{ height: 0 }}
                animate={{ height: 24 }}
                transition={{ duration: 0.3, delay: 2.1 }}
              />
              
              {/* Pin dot */}
              <motion.div
                className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary"
                initial={{ opacity: 0, top: "100%" }}
                animate={{ opacity: 1, top: "calc(100% + 24px)" }}
                transition={{ duration: 0.2, delay: 2.3 }}
              />
            </motion.div>

            {/* AI Analysis tooltip */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.6, delay: 2.6, ease: "easeOut" }}
              className="absolute left-1/2 -translate-x-1/2 top-full mt-10 w-72"
            >
              <div className="relative px-4 py-3 rounded-xl border border-vantage-warning/30 bg-vantage-warning/5 backdrop-blur-sm">
                {/* Connector */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-px h-3 bg-gradient-to-t from-vantage-warning/30 to-transparent" />
                
                <div className="flex items-start gap-2">
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-vantage-warning mt-1.5 shrink-0"
                    animate={prefersReducedMotion ? {} : { opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <div>
                    <span className="text-xs font-mono text-vantage-warning uppercase tracking-wider">AI Analysis</span>
                    <p className="text-sm text-foreground/90 mt-1 leading-relaxed">
                      Over-peeked before reload — lost timing advantage
                    </p>
                  </div>
                </div>
                
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 rounded-xl overflow-hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 3.1 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-vantage-warning/10 to-transparent -translate-x-full"
                    animate={prefersReducedMotion ? {} : { x: ["-100%", "200%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 3.6 }}
                  />
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Reward unlocked annotation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 3.8, ease: "easeOut" }}
            className="absolute bottom-16 right-4 md:right-8"
          >
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-primary/40 bg-primary/10 backdrop-blur-sm shadow-[0_0_16px_hsl(var(--primary)/0.15)]">
              <Trophy className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-medium text-foreground">Reward Unlocked</span>
              <span className="text-xs font-mono text-muted-foreground">•</span>
              <span className="text-xs font-mono text-primary/80">$10 Weekly Challenge</span>
            </div>
          </motion.div>

          {/* Timeline preview at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background/90 via-background/60 to-transparent">
            <div className="absolute bottom-2 left-20 right-4 h-1 bg-muted/30 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary/50 rounded-full"
                animate={{ width: `${(recordingTime / 300) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,hsl(var(--background)/0.6)_100%)]" aria-hidden="true" />
          
          {/* Gameplay image */}
          <img 
            src={fortniteGameplay} 
            alt="Fortnite gameplay screenshot showing third-person shooter action" 
            className="absolute inset-0 w-full h-full object-cover -z-10"
          />
        </motion.div>

      </div>
    </section>
  );
}
