import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Eye, TrendingUp, Users } from "lucide-react";

const values = [
  {
    icon: Eye,
    title: "Clarity",
    copy: "Understand why a fight was lost — not just that it was.",
  },
  {
    icon: TrendingUp,
    title: "Consistency",
    copy: "Spot patterns across sessions, not isolated moments.",
  },
  {
    icon: Users,
    title: "Team IQ",
    copy: "Share context, not arguments.",
  },
];

export function ValueSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-32 relative">
      <div className="container mx-auto px-6">
        <div ref={ref} className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  className="group relative"
                >
                  {/* Card */}
                  <div className="relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 ease-out group-hover:-translate-y-2 group-hover:border-primary/40 h-full">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20 mb-6 transition-colors group-hover:bg-primary/15">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>

                    {/* Title */}
                    <h3 className="font-display text-3xl mb-3 text-foreground">
                      {value.title}
                    </h3>

                    {/* Copy */}
                    <p className="text-muted-foreground leading-relaxed">
                      {value.copy}
                    </p>

                    {/* Edge glow effect on hover */}
                    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.3),0_0_20px_hsl(var(--primary)/0.15)]" />
                    </div>
                  </div>

                  {/* Background glow */}
                  <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl -z-10" />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
