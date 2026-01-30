import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Crosshair, Skull, Star, MessageSquare } from "lucide-react";

interface Annotation {
  id: number;
  type: "kill" | "death" | "highlight" | "note";
  time: string;
  label: string;
  position: { x: number; y: number };
  delay: number;
}

const annotations: Annotation[] = [
  { id: 1, type: "kill", time: "2:34", label: "Triple Kill", position: { x: 15, y: 25 }, delay: 0.5 },
  { id: 2, type: "highlight", time: "2:36", label: "Perfect Timing", position: { x: 65, y: 40 }, delay: 1.2 },
  { id: 3, type: "note", time: "2:38", label: "Check flank earlier", position: { x: 80, y: 70 }, delay: 2 },
  { id: 4, type: "death", time: "2:41", label: "Positioning Error", position: { x: 30, y: 60 }, delay: 3 },
  { id: 5, type: "kill", time: "2:45", label: "Clutch Play", position: { x: 50, y: 35 }, delay: 4 },
];

function getAnnotationConfig(type: Annotation["type"]) {
  switch (type) {
    case "kill":
      return { icon: Crosshair, color: "text-vantage-success", bg: "bg-vantage-success/20", border: "border-vantage-success/50" };
    case "death":
      return { icon: Skull, color: "text-destructive", bg: "bg-destructive/20", border: "border-destructive/50" };
    case "highlight":
      return { icon: Star, color: "text-primary", bg: "bg-primary/20", border: "border-primary/50" };
    case "note":
      return { icon: MessageSquare, color: "text-vantage-teal", bg: "bg-vantage-teal/20", border: "border-vantage-teal/50" };
  }
}

export function LivePreviewSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [visibleAnnotations, setVisibleAnnotations] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(154); // 2:34

  useEffect(() => {
    if (!isInView) return;
    
    annotations.forEach((annotation, index) => {
      setTimeout(() => {
        setVisibleAnnotations(prev => [...prev, annotation.id]);
        setCurrentTime(154 + index * 2);
      }, annotation.delay * 1000);
    });
  }, [isInView]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <section className="py-32 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-mono text-primary uppercase tracking-widest">Live Analysis</span>
          <h2 className="font-display text-5xl md:text-7xl mt-4 mb-6">
            ANNOTATIONS IN <span className="text-gradient-primary">REAL TIME</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Watch as moments are captured and tagged automatically. Every kill, every death, every crucial play.
          </p>
        </motion.div>

        {/* Video preview mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Frame */}
          <div className="relative aspect-video rounded-2xl overflow-hidden border border-border/50 bg-card shadow-elevated">
            {/* Fake video background */}
            <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-background">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px]" />
            </div>

            {/* Annotations */}
            {annotations.map((annotation) => {
              const config = getAnnotationConfig(annotation.type);
              const Icon = config.icon;
              const isVisible = visibleAnnotations.includes(annotation.id);

              return (
                <motion.div
                  key={annotation.id}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={isVisible ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute"
                  style={{ left: `${annotation.position.x}%`, top: `${annotation.position.y}%` }}
                >
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border} backdrop-blur-sm`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    <span className="text-sm font-medium text-foreground">{annotation.label}</span>
                    <span className="text-xs font-mono text-muted-foreground">{annotation.time}</span>
                  </div>
                </motion.div>
              );
            })}

            {/* Timeline bar */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background/90 to-transparent">
              <div className="absolute bottom-3 left-4 right-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-primary">{formatTime(currentTime)}</span>
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary rounded-full"
                      initial={{ width: "40%" }}
                      animate={{ width: `${40 + visibleAnnotations.length * 4}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <span className="font-mono text-sm text-muted-foreground">5:00</span>
                </div>

                {/* Timeline markers */}
                <div className="absolute bottom-3 left-16 right-16 h-1">
                  {annotations.map((annotation) => {
                    const config = getAnnotationConfig(annotation.type);
                    const isVisible = visibleAnnotations.includes(annotation.id);
                    const position = ((154 + annotations.indexOf(annotation) * 2) / 300) * 100;

                    return (
                      <motion.div
                        key={annotation.id}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={isVisible ? { opacity: 1, scale: 1 } : {}}
                        className={`absolute w-2 h-2 rounded-full ${config.bg.replace('/20', '')} -translate-x-1/2 -translate-y-0.5`}
                        style={{ left: `${position}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Glow effect */}
          <div className="absolute -inset-4 bg-primary/5 blur-3xl rounded-3xl -z-10" />
        </motion.div>
      </div>
    </section>
  );
}
