import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { 
  Video, 
  Pencil, 
  BarChart3, 
  Share2, 
  Mic, 
  Sparkles,
  Layers,
  Clock
} from "lucide-react";

const features = [
  {
    icon: Video,
    title: "CAPTURE",
    description: "Record gameplay with screen, webcam, and microphone. Everything synchronized.",
    accent: true,
  },
  {
    icon: Pencil,
    title: "MARK",
    description: "Tag kills, deaths, highlights. Add voice notes. Draw on frames.",
    accent: false,
  },
  {
    icon: BarChart3,
    title: "ANALYZE",
    description: "AI-powered insights identify patterns in your gameplay over time.",
    accent: false,
  },
  {
    icon: Share2,
    title: "SHARE",
    description: "Export clips to YouTube, TikTok, or share with your coach.",
    accent: true,
  },
];

const capabilities = [
  { icon: Mic, label: "Voice Notes" },
  { icon: Sparkles, label: "AI Analysis" },
  { icon: Layers, label: "Multi-track" },
  { icon: Clock, label: "Timeline Sync" },
];

export function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="features" className="py-32 relative">
      {/* Background accent */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-64 bg-gradient-to-b from-transparent via-primary to-transparent" />
      
      <div className="container mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <span className="text-sm font-mono text-primary uppercase tracking-widest">Core Features</span>
          <h2 className="font-display text-5xl md:text-7xl mt-4">
            BUILT FOR <span className="text-gradient-primary">IMPROVEMENT</span>
          </h2>
        </motion.div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`group relative p-6 rounded-2xl border transition-all duration-300 ${
                  feature.accent 
                    ? 'border-primary/30 bg-primary/5 hover:border-primary/60 hover:bg-primary/10' 
                    : 'border-border/50 bg-card hover:border-primary/30'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  feature.accent ? 'bg-primary/20' : 'bg-muted'
                }`}>
                  <Icon className={`w-6 h-6 ${feature.accent ? 'text-primary' : 'text-foreground'}`} />
                </div>
                <h3 className="font-display text-2xl mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl" />
              </motion.div>
            );
          })}
        </div>

        {/* Capabilities strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-8"
        >
          {capabilities.map((cap, index) => {
            const Icon = cap.icon;
            return (
              <motion.div
                key={cap.label}
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-sm">{cap.label}</span>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
