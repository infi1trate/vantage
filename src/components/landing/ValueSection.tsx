import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";
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
  const prefersReducedMotion = useReducedMotion();
  const [focusedCard, setFocusedCard] = useState<number | null>(null);

  return (
    <section className="py-32 relative" aria-labelledby="value-heading">
      {/* Visually hidden heading for screen readers */}
      <h2 id="value-heading" className="sr-only">Core Values</h2>
      
      <div className="container mx-auto px-6">
        <div ref={ref} className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6" role="list">
            {values.map((value, index) => {
              const Icon = value.icon;
              const isActive = focusedCard === index;
              
              return (
                <motion.article
                  key={value.title}
                  initial={prefersReducedMotion ? {} : { opacity: 0, y: 30 }}
                  animate={isInView && !prefersReducedMotion ? { opacity: 1, y: 0 } : prefersReducedMotion ? {} : {}}
                  transition={prefersReducedMotion ? {} : { duration: 0.5, delay: index * 0.15 }}
                  className="group relative"
                  role="listitem"
                  tabIndex={0}
                  onFocus={() => setFocusedCard(index)}
                  onBlur={() => setFocusedCard(null)}
                  aria-label={`${value.title}: ${value.copy}`}
                >
                  {/* Card */}
                  <div className={cn(
                    "relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 ease-out h-full",
                    "group-hover:-translate-y-2 group-hover:border-primary/40",
                    "group-focus-visible:-translate-y-2 group-focus-visible:border-primary/40",
                    isActive && "-translate-y-2 border-primary/40"
                  )}>
                    {/* Icon */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20 mb-6 transition-colors",
                      "group-hover:bg-primary/15 group-focus-visible:bg-primary/15"
                    )}>
                      <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
                    </div>

                    {/* Title */}
                    <h3 className="font-display text-3xl mb-3 text-foreground">
                      {value.title}
                    </h3>

                    {/* Copy */}
                    <p className="text-muted-foreground leading-relaxed">
                      {value.copy}
                    </p>

                    {/* Edge glow effect on hover/focus */}
                    <div 
                      className={cn(
                        "absolute inset-0 rounded-2xl transition-opacity duration-300 pointer-events-none",
                        "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                        isActive && "opacity-100"
                      )}
                      aria-hidden="true"
                    >
                      <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.3),0_0_20px_hsl(var(--primary)/0.15)]" />
                    </div>
                  </div>

                  {/* Background glow */}
                  <div 
                    className={cn(
                      "absolute inset-0 rounded-2xl bg-primary/5 transition-opacity duration-300 blur-xl -z-10",
                      "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                      isActive && "opacity-100"
                    )}
                    aria-hidden="true"
                  />
                </motion.article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
