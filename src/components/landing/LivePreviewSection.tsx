import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Crosshair, Skull, Star, MessageSquare } from "lucide-react";

interface Annotation {
  id: number;
  type: "kill" | "death" | "highlight" | "note";
  time: string;
  label: string;
  position: { x: number; y: number };
  delay: number;
}

const annotationSets = [
  [
    { id: 1, type: "kill" as const, time: "2:34", label: "Triple Kill", position: { x: 18, y: 28 }, delay: 0.5 },
    { id: 2, type: "highlight" as const, time: "2:36", label: "Perfect Timing", position: { x: 62, y: 38 }, delay: 1.2 },
    { id: 3, type: "note" as const, time: "2:38", label: "Check flank earlier", position: { x: 78, y: 68 }, delay: 2 },
  ],
  [
    { id: 4, type: "death" as const, time: "3:12", label: "Overextended", position: { x: 25, y: 45 }, delay: 0.5 },
    { id: 5, type: "kill" as const, time: "3:15", label: "Trade Kill", position: { x: 55, y: 30 }, delay: 1.2 },
    { id: 6, type: "highlight" as const, time: "3:18", label: "Clutch 1v2", position: { x: 70, y: 55 }, delay: 2 },
  ],
];

function getAnnotationConfig(type: Annotation["type"]) {
  switch (type) {
    case "kill":
      return { icon: Crosshair, color: "text-vantage-success", bg: "bg-vantage-success/15", border: "border-vantage-success/50" };
    case "death":
      return { icon: Skull, color: "text-destructive", bg: "bg-destructive/15", border: "border-destructive/50" };
    case "highlight":
      return { icon: Star, color: "text-primary", bg: "bg-primary/15", border: "border-primary/50" };
    case "note":
      return { icon: MessageSquare, color: "text-vantage-teal", bg: "bg-vantage-teal/15", border: "border-vantage-teal/50" };
  }
}

export function LivePreviewSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, margin: "-100px" });
  const prefersReducedMotion = useReducedMotion();
  
  const [visibleAnnotations, setVisibleAnnotations] = useState<number[]>([]);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(154);

  const annotations = annotationSets[currentSetIndex];

  useEffect(() => {
    if (!isInView) {
      setVisibleAnnotations([]);
      return;
    }
    
    setVisibleAnnotations([]);
    setCurrentTime(currentSetIndex === 0 ? 154 : 192);
    
    annotations.forEach((annotation) => {
      setTimeout(() => {
        setVisibleAnnotations(prev => [...prev, annotation.id]);
        setCurrentTime(t => t + 2);
      }, annotation.delay * 1000);
    });

    // Cycle to next set
    const cycleTimeout = setTimeout(() => {
      setVisibleAnnotations([]);
      setTimeout(() => {
        setCurrentSetIndex((prev) => (prev + 1) % annotationSets.length);
      }, 500);
    }, 5000);

    return () => clearTimeout(cycleTimeout);
  }, [isInView, currentSetIndex, annotations]);

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

        {/* Video preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative max-w-5xl mx-auto"
        >
          <div className="relative aspect-video rounded-2xl overflow-hidden border border-border/40 bg-card/30 shadow-elevated">
            {/* Gameplay background with scan effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-muted/30 to-background">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.008)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.008)_1px,transparent_1px)] bg-[size:36px_36px]" />
              
              {/* Scan line */}
              <motion.div
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
                animate={prefersReducedMotion ? {} : { y: [0, 400, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
            </div>

            {/* Session info */}
            <div className="absolute top-4 left-4 flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/60 backdrop-blur-sm border border-border/30">
                <motion.div
                  className="w-2 h-2 rounded-full bg-vantage-success"
                  animate={prefersReducedMotion ? {} : { opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs font-mono text-foreground/80">ANALYZING</span>
              </div>
            </div>

            {/* Annotations */}
            {annotations.map((annotation) => {
              const config = getAnnotationConfig(annotation.type);
              const Icon = config.icon;
              const isVisible = visibleAnnotations.includes(annotation.id);

              return (
                <motion.div
                  key={annotation.id}
                  initial={{ opacity: 0, scale: 0.5, y: 10 }}
                  animate={isVisible ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.5, y: 10 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute"
                  style={{ left: `${annotation.position.x}%`, top: `${annotation.position.y}%` }}
                >
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border} backdrop-blur-sm shadow-lg`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    <span className="text-sm font-medium text-foreground">{annotation.label}</span>
                    <span className="text-xs font-mono text-muted-foreground">{annotation.time}</span>
                  </div>
                </motion.div>
              );
            })}

            {/* Timeline */}
            <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-background/95 to-transparent">
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-primary">{formatTime(currentTime)}</span>
                  <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden relative">
                    <motion.div 
                      className="h-full bg-primary/60 rounded-full"
                      animate={{ width: `${30 + visibleAnnotations.length * 5}%` }}
                      transition={{ duration: 0.5 }}
                    />
                    
                    {/* Timeline markers */}
                    {annotations.map((annotation, i) => {
                      const config = getAnnotationConfig(annotation.type);
                      const isVisible = visibleAnnotations.includes(annotation.id);
                      const position = 30 + i * 8;
                      return (
                        <motion.div
                          key={annotation.id}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={isVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                          className={`absolute w-2.5 h-2.5 rounded-full ${config.bg} border ${config.border} -translate-y-1/2 top-1/2`}
                          style={{ left: `${position}%` }}
                        />
                      );
                    })}
                  </div>
                  <span className="font-mono text-sm text-muted-foreground">5:00</span>
                </div>
              </div>
            </div>

            {/* Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,hsl(var(--background)/0.5)_100%)]" />
          </div>

          {/* Ambient glow */}
          <motion.div 
            className="absolute -inset-8 bg-primary/5 blur-3xl rounded-3xl -z-10"
            animate={prefersReducedMotion ? {} : { opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </motion.div>
      </div>
    </section>
  );
}
