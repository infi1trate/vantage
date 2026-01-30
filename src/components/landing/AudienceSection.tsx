import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Gamepad2, Users2, Cpu } from "lucide-react";

const audiences = [
  {
    icon: Gamepad2,
    title: "Players",
    copy: "Grind smarter. Improve faster.",
  },
  {
    icon: Users2,
    title: "Teams & Coaches",
    copy: "Review with shared context.",
  },
  {
    icon: Cpu,
    title: "AI & Game Studios",
    copy: "Real human gameplay data.",
  },
];

export function AudienceSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-32 relative">
      <div className="container mx-auto px-6">
        <div ref={ref} className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {audiences.map((audience, index) => {
              const Icon = audience.icon;
              return (
                <motion.div
                  key={audience.title}
                  initial={{ opacity: 0, y: 25 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: index * 0.12 }}
                  className="text-center"
                >
                  {/* Icon */}
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 mb-5">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>

                  {/* Title */}
                  <h3 className="font-display text-3xl mb-2 text-foreground">
                    {audience.title}
                  </h3>

                  {/* Copy */}
                  <p className="text-muted-foreground mb-4">
                    {audience.copy}
                  </p>

                  {/* Microcopy */}
                  <p className="text-xs text-muted-foreground/60 uppercase tracking-widest">
                    Built from real sessions.
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
