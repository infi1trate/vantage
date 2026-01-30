import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Star, Crosshair, AlertTriangle, Timer } from "lucide-react";

const annotations = [
  { id: 1, icon: Crosshair, label: "Entry Frag", time: "1:23", x: 20, y: 30, color: "vantage-success" },
  { id: 2, icon: Star, label: "Clutch Round", time: "1:47", x: 55, y: 25, color: "primary" },
  { id: 3, icon: AlertTriangle, label: "Overextended", time: "2:04", x: 75, y: 55, color: "vantage-warning" },
  { id: 4, icon: Timer, label: "Rotate Timing", time: "2:18", x: 35, y: 65, color: "vantage-teal" },
];

function getAnnotationColors(color: string) {
  switch (color) {
    case "primary":
      return { bg: "bg-primary/15", border: "border-primary/50", icon: "text-primary" };
    case "vantage-success":
      return { bg: "bg-vantage-success/15", border: "border-vantage-success/50", icon: "text-vantage-success" };
    case "vantage-warning":
      return { bg: "bg-vantage-warning/15", border: "border-vantage-warning/50", icon: "text-vantage-warning" };
    case "vantage-teal":
      return { bg: "bg-vantage-teal/15", border: "border-vantage-teal/50", icon: "text-vantage-teal" };
    default:
      return { bg: "bg-muted", border: "border-border", icon: "text-foreground" };
  }
}

export function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-32 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div ref={ref} className="max-w-5xl mx-auto">
          {/* Gameplay frame with annotations */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="relative aspect-video rounded-xl overflow-hidden border border-border/40 bg-card/50 mb-16"
          >
            {/* Fake gameplay background */}
            <div className="absolute inset-0 bg-gradient-to-br from-muted/30 via-background to-muted/20">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]" />
            </div>

            {/* Annotations */}
            {annotations.map((annotation, index) => {
              const Icon = annotation.icon;
              const colors = getAnnotationColors(annotation.color);
              return (
                <motion.div
                  key={annotation.id}
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.15 }}
                  className="absolute"
                  style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
                >
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colors.bg} ${colors.border} backdrop-blur-sm`}>
                    <Icon className={`w-3.5 h-3.5 ${colors.icon}`} />
                    <span className="text-sm font-medium text-foreground">{annotation.label}</span>
                    <span className="text-xs font-mono text-muted-foreground">{annotation.time}</span>
                  </div>
                </motion.div>
              );
            })}

            {/* Paused timeline */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background/95 to-transparent">
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-3 mb-2">
                  {/* Pause indicator */}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/20 border border-primary/30">
                    <div className="w-1 h-3 bg-primary rounded-sm" />
                    <div className="w-1 h-3 bg-primary rounded-sm" />
                  </div>
                  <span className="font-mono text-sm text-primary">2:04</span>
                  <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <div className="h-full w-[41%] bg-primary/60 rounded-full" />
                  </div>
                  <span className="font-mono text-sm text-muted-foreground">5:00</span>
                </div>

                {/* Timeline markers */}
                <div className="relative h-1 ml-20 mr-12">
                  {annotations.map((annotation, i) => {
                    const colors = getAnnotationColors(annotation.color);
                    const position = [17, 35, 41, 52][i];
                    return (
                      <motion.div
                        key={annotation.id}
                        className={`absolute w-2 h-2 rounded-full ${colors.bg} ${colors.border} border`}
                        style={{ left: `${position}%`, top: "-2px" }}
                        initial={{ opacity: 0 }}
                        animate={isInView ? { opacity: 1 } : {}}
                        transition={{ delay: 0.8 + i * 0.1 }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background)/0.5)_100%)]" />
          </motion.div>

          {/* Closing copy */}
          <div className="text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="font-display text-4xl md:text-6xl lg:text-7xl leading-tight mb-4"
            >
              Great players don't just play more.
            </motion.h2>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.75 }}
              className="font-display text-4xl md:text-6xl lg:text-7xl leading-tight mb-12 text-gradient-primary"
            >
              They see more.
            </motion.h2>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="flex flex-col items-center gap-4"
            >
              <Button
                size="lg"
                className="h-14 px-10 text-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                asChild
              >
                <Link to="/auth">Record Your First Session</Link>
              </Button>

              <p className="text-sm text-muted-foreground">
                No highlights. No noise. Just perspective.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
