import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export function QuoteSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <div ref={ref} className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center"
          >
            {/* Quote mark */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 0.15 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="font-display text-8xl text-primary leading-none mb-4"
            >
              "
            </motion.div>

            {/* Quote text */}
            <blockquote className="text-2xl md:text-3xl lg:text-4xl font-light text-foreground/90 leading-relaxed mb-8">
              This feels like film review, not clipping.
            </blockquote>

            {/* Attribution */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center justify-center gap-3"
            >
              <span className="w-8 h-px bg-primary/40" />
              <span className="text-sm text-muted-foreground uppercase tracking-widest">
                FPS IGL
              </span>
              <span className="w-8 h-px bg-primary/40" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
