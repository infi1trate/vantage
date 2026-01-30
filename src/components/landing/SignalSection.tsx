import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const dataPoints = [
  "Vision",
  "Voice", 
  "Reaction",
  "Decision timing",
  "Social coordination",
];

export function SignalSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-32 relative overflow-hidden bg-[hsl(0_0%_2%)]">
      {/* Animated graph lines background */}
      <div className="absolute inset-0 overflow-hidden opacity-30">
        {/* Horizontal grid lines */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`h-${i}`}
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent"
            style={{ top: `${12 + i * 12}%` }}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 0.3 } : {}}
            transition={{ delay: i * 0.05 }}
          />
        ))}

        {/* Animated wave lines */}
        <svg 
          className="absolute inset-0 w-full h-full" 
          preserveAspectRatio="none"
          viewBox="0 0 1200 400"
        >
          {/* Wave 1 - slow drift */}
          <motion.path
            d="M0,200 Q150,180 300,200 T600,200 T900,200 T1200,200"
            fill="none"
            stroke="hsl(var(--primary) / 0.15)"
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: 2, delay: 0.3 }}
          />
          <motion.path
            d="M0,200 Q150,180 300,200 T600,200 T900,200 T1200,200"
            fill="none"
            stroke="hsl(var(--primary) / 0.1)"
            strokeWidth="1"
            initial={{ translateY: 0 }}
            animate={{ translateY: [0, -20, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Wave 2 - offset */}
          <motion.path
            d="M0,220 Q200,240 400,220 T800,220 T1200,220"
            fill="none"
            stroke="hsl(var(--vantage-teal) / 0.12)"
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: 2.5, delay: 0.5 }}
          />
          <motion.path
            d="M0,220 Q200,240 400,220 T800,220 T1200,220"
            fill="none"
            stroke="hsl(var(--vantage-teal) / 0.08)"
            strokeWidth="1"
            initial={{ translateY: 0 }}
            animate={{ translateY: [0, 15, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />

          {/* Wave 3 - subtle */}
          <motion.path
            d="M0,180 Q100,160 200,180 T400,180 T600,180 T800,180 T1000,180 T1200,180"
            fill="none"
            stroke="hsl(var(--muted-foreground) / 0.08)"
            strokeWidth="1"
            initial={{ translateY: 0 }}
            animate={{ translateY: [0, -10, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />

          {/* Data point dots */}
          {[150, 350, 550, 750, 950].map((x, i) => (
            <motion.circle
              key={i}
              cx={x}
              cy={200}
              r="3"
              fill="hsl(var(--primary) / 0.4)"
              initial={{ opacity: 0, scale: 0 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 1 + i * 0.15 }}
            />
          ))}
        </svg>

        {/* Vertical scan line */}
        <motion.div
          className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent"
          initial={{ left: "0%" }}
          animate={{ left: ["0%", "100%", "0%"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 relative z-10">
        <div ref={ref} className="max-w-3xl mx-auto text-center">
          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="font-display text-4xl md:text-6xl lg:text-7xl leading-tight mb-10 text-foreground/90"
          >
            Gameplay Is One of the Richest Human Signals
          </motion.h2>

          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-10"
          >
            <p className="text-lg text-muted-foreground mb-6">
              Every Vantage session generates synchronized multimodal data:
            </p>

            {/* Data points list */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
              {dataPoints.map((point, index) => (
                <motion.div
                  key={point}
                  initial={{ opacity: 0, y: 10 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  <span className="text-foreground/80 font-light">{point}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Closing line */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="text-xl md:text-2xl text-primary/80 font-light tracking-wide"
          >
            Vantage is the capture layer.
          </motion.p>

          {/* Subtle divider */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.8, delay: 1 }}
            className="mt-16 h-px w-32 mx-auto bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          />
        </div>
      </div>

      {/* Top/bottom fade edges */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
