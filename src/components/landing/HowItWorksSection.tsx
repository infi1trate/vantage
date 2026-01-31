import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
  {
    number: "01",
    title: "RECORD",
    description: "Hit record and play. VANTAGE captures everything in the background.",
  },
  {
    number: "02", 
    title: "REVIEW",
    description: "Scrub through your session. AI highlights key moments automatically.",
  },
  {
    number: "03",
    title: "MARK",
    description: "Add notes, voice memos, drawings. Tag moments that matter.",
  },
  {
    number: "04",
    title: "IMPROVE",
    description: "Track patterns over time. Share with coaches. Level up.",
  },
];

export function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="how-it-works" className="py-32 relative overflow-hidden">
      {/* Background line */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      
      <div className="container mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <span className="text-sm font-mono text-primary uppercase tracking-widest">Workflow</span>
          <h2 className="font-display text-5xl md:text-7xl mt-4">
            HOW IT <span className="text-gradient-primary">WORKS</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="relative text-center"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-1/2 w-full h-px bg-gradient-to-r from-primary/50 to-transparent" />
              )}
              
              {/* Number */}
              <motion.div
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : {}}
                transition={{ duration: 0.4, delay: index * 0.15 + 0.2 }}
                className="relative inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-primary bg-background mb-6"
              >
                <span className="font-mono text-xl text-primary font-semibold">{step.number}</span>
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl -z-10" />
              </motion.div>

              <h3 className="font-display text-3xl mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
