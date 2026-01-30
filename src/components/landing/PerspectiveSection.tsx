import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { MonitorPlay, Mic, Camera, MapPin } from "lucide-react";

const layers = [
  {
    id: "gameplay",
    icon: MonitorPlay,
    label: "Gameplay Feed",
    microcopy: "Frame-accurate capture",
    color: "primary",
  },
  {
    id: "voice",
    icon: Mic,
    label: "Voice & Team Comms",
    microcopy: "Voice synced to decision timing",
    color: "vantage-teal",
  },
  {
    id: "facecam",
    icon: Camera,
    label: "Facecam Reactions",
    microcopy: "Reaction context preserved",
    color: "vantage-warning",
  },
  {
    id: "annotations",
    icon: MapPin,
    label: "Timeline Annotations",
    microcopy: "Pinned to intent, not clips",
    color: "vantage-success",
  },
];

function getColorClasses(color: string) {
  switch (color) {
    case "primary":
      return {
        border: "border-primary/40 hover:border-primary/70",
        bg: "bg-primary/5 hover:bg-primary/10",
        icon: "text-primary",
        glow: "group-hover:shadow-[0_0_30px_hsl(var(--primary)/0.2)]",
      };
    case "vantage-teal":
      return {
        border: "border-vantage-teal/40 hover:border-vantage-teal/70",
        bg: "bg-vantage-teal/5 hover:bg-vantage-teal/10",
        icon: "text-vantage-teal",
        glow: "group-hover:shadow-[0_0_30px_hsl(var(--vantage-teal)/0.2)]",
      };
    case "vantage-warning":
      return {
        border: "border-vantage-warning/40 hover:border-vantage-warning/70",
        bg: "bg-vantage-warning/5 hover:bg-vantage-warning/10",
        icon: "text-vantage-warning",
        glow: "group-hover:shadow-[0_0_30px_hsl(var(--vantage-warning)/0.2)]",
      };
    case "vantage-success":
      return {
        border: "border-vantage-success/40 hover:border-vantage-success/70",
        bg: "bg-vantage-success/5 hover:bg-vantage-success/10",
        icon: "text-vantage-success",
        glow: "group-hover:shadow-[0_0_30px_hsl(var(--vantage-success)/0.2)]",
      };
    default:
      return {
        border: "border-border/40",
        bg: "bg-card/50",
        icon: "text-foreground",
        glow: "",
      };
  }
}

export function PerspectiveSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);

  return (
    <section className="py-32 relative overflow-hidden">
      {/* Background accent line */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-64 bg-gradient-to-b from-transparent via-primary/30 to-transparent" />

      <div className="container mx-auto px-6">
        <div ref={ref} className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-5xl md:text-7xl leading-tight mb-6">
              More Than Video.{" "}
              <span className="text-gradient-primary">It's Perspective.</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Gameplay alone doesn't explain decisions. Vantage captures the moment — not just the outcome.
            </p>
          </motion.div>

          {/* Layers stack */}
          <div className="relative max-w-xl mx-auto space-y-4">
            {/* Connection line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent" />

            {layers.map((layer, index) => {
              const Icon = layer.icon;
              const colors = getColorClasses(layer.color);
              const isHovered = hoveredLayer === layer.id;

              return (
                <motion.div
                  key={layer.id}
                  initial={{ opacity: 0, y: 40, x: -20 }}
                  animate={isInView ? { opacity: 1, y: 0, x: 0 } : {}}
                  transition={{
                    duration: 0.5,
                    delay: 0.2 + index * 0.15,
                    ease: "easeOut",
                  }}
                  onMouseEnter={() => setHoveredLayer(layer.id)}
                  onMouseLeave={() => setHoveredLayer(null)}
                  className={`group relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 cursor-default ${colors.border} ${colors.bg} ${colors.glow}`}
                >
                  {/* Icon */}
                  <div
                    className={`relative z-10 w-12 h-12 rounded-lg flex items-center justify-center bg-background border ${colors.border}`}
                  >
                    <Icon className={`w-5 h-5 ${colors.icon}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-foreground">
                        {layer.label}
                      </span>

                      {/* Microcopy - appears on hover */}
                      <motion.span
                        initial={{ opacity: 0, x: 10 }}
                        animate={isHovered ? { opacity: 1, x: 0 } : { opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                        className="text-sm text-muted-foreground italic hidden sm:block"
                      >
                        {layer.microcopy}
                      </motion.span>
                    </div>

                    {/* Mobile microcopy - always visible */}
                    <span className="text-sm text-muted-foreground sm:hidden">
                      {layer.microcopy}
                    </span>
                  </div>

                  {/* Layer number indicator */}
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {index + 1}
                    </span>
                  </div>
                </motion.div>
              );
            })}

            {/* Bottom accent */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={isInView ? { opacity: 1, scaleX: 1 } : {}}
              transition={{ duration: 0.6, delay: 1 }}
              className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent mt-8"
            />
          </div>

          {/* Bottom tagline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="text-center text-sm text-muted-foreground mt-12"
          >
            All layers. One timeline. Perfect sync.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
