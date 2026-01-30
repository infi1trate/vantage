import { motion, useInView } from "framer-motion";
import { useRef, useState, useCallback } from "react";
import { AlertTriangle, Timer, Crosshair } from "lucide-react";

interface TimelineAnnotation {
  id: number;
  time: number; // 0-100 percentage
  label: string;
  icon: typeof AlertTriangle;
  color: string;
}

const annotations: TimelineAnnotation[] = [
  { id: 1, time: 15, label: "Hesitated after sound cue", icon: Timer, color: "vantage-warning" },
  { id: 2, time: 38, label: "Crosshair placement drifted", icon: Crosshair, color: "destructive" },
  { id: 3, time: 62, label: "Team call came too late", icon: AlertTriangle, color: "vantage-teal" },
  { id: 4, time: 85, label: "Over-rotated on contact", icon: Timer, color: "primary" },
];

function getAnnotationColors(color: string) {
  switch (color) {
    case "vantage-warning":
      return { bg: "bg-vantage-warning/15", border: "border-vantage-warning/50", text: "text-vantage-warning" };
    case "destructive":
      return { bg: "bg-destructive/15", border: "border-destructive/50", text: "text-destructive" };
    case "vantage-teal":
      return { bg: "bg-vantage-teal/15", border: "border-vantage-teal/50", text: "text-vantage-teal" };
    case "primary":
      return { bg: "bg-primary/15", border: "border-primary/50", text: "text-primary" };
    default:
      return { bg: "bg-muted", border: "border-border", text: "text-foreground" };
  }
}

export function TimelineSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [scrubberPosition, setScrubberPosition] = useState(25);
  const [isDragging, setIsDragging] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleDrag = useCallback((clientX: number) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setScrubberPosition(percentage);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleDrag(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleDrag(e.clientX);
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleDrag(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) handleDrag(e.touches[0].clientX);
  };

  // Find active annotation (within ±8% of scrubber)
  const activeAnnotation = annotations.find(
    (a) => Math.abs(a.time - scrubberPosition) < 8
  );

  // Visual "intensity" based on position (fake gameplay brightness)
  const intensity = Math.sin((scrubberPosition / 100) * Math.PI * 3) * 0.15 + 0.85;

  return (
    <section className="py-32 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div ref={ref} className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-5xl md:text-7xl leading-tight mb-6">
              Review the Moment,{" "}
              <span className="text-gradient-primary">Not the Highlight</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Scrub through your session. See exactly where decisions happened.
            </p>
          </motion.div>

          {/* Interactive player mock */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            {/* Gameplay frame */}
            <div
              className="relative aspect-video rounded-xl overflow-hidden border border-border/40 bg-card/50 mb-6"
              style={{ opacity: intensity }}
            >
              {/* Fake gameplay background with dynamic lighting */}
              <div 
                className="absolute inset-0 transition-all duration-150"
                style={{
                  background: `linear-gradient(${135 + scrubberPosition}deg, hsl(var(--muted) / 0.4) 0%, hsl(var(--background)) 50%, hsl(var(--muted) / 0.3) 100%)`,
                }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]" />
              </div>

              {/* Active annotation overlay */}
              {activeAnnotation && (
                <motion.div
                  key={activeAnnotation.id}
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  {(() => {
                    const colors = getAnnotationColors(activeAnnotation.color);
                    const Icon = activeAnnotation.icon;
                    return (
                      <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${colors.bg} ${colors.border} backdrop-blur-sm`}>
                        <Icon className={`w-5 h-5 ${colors.text}`} />
                        <span className="text-base font-medium text-foreground">
                          {activeAnnotation.label}
                        </span>
                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {/* Timestamp display */}
              <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-sm border border-border/50">
                <span className="font-mono text-sm text-foreground">
                  {Math.floor((scrubberPosition / 100) * 5)}:{String(Math.floor((scrubberPosition / 100) * 60) % 60).padStart(2, "0")}
                </span>
                <span className="text-muted-foreground text-sm"> / 5:00</span>
              </div>

              {/* Vignette */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,hsl(var(--background)/0.5)_100%)]" />
            </div>

            {/* Timeline scrubber */}
            <div
              ref={timelineRef}
              className="relative h-16 cursor-pointer select-none touch-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            >
              {/* Track background */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 rounded-full bg-muted/50">
                {/* Progress fill */}
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary/40"
                  style={{ width: `${scrubberPosition}%` }}
                  transition={{ duration: 0.05 }}
                />
              </div>

              {/* Annotation markers */}
              {annotations.map((annotation) => {
                const colors = getAnnotationColors(annotation.color);
                const isActive = activeAnnotation?.id === annotation.id;
                return (
                  <motion.div
                    key={annotation.id}
                    className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-transform ${
                      isActive ? "scale-150" : "scale-100"
                    } ${colors.bg} ${colors.border}`}
                    style={{ left: `${annotation.time}%`, marginLeft: "-6px" }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={isInView ? { opacity: 1, scale: isActive ? 1.5 : 1 } : {}}
                    transition={{ delay: 0.5 + annotation.id * 0.1 }}
                  />
                );
              })}

              {/* Scrubber handle */}
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${scrubberPosition}%` }}
                transition={{ duration: 0.05 }}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-primary border-2 border-background shadow-lg transition-transform ${
                    isDragging ? "scale-125" : "scale-100"
                  }`}
                >
                  {/* Glow */}
                  <div className="absolute inset-0 rounded-full bg-primary/50 blur-md -z-10" />
                </div>
                {/* Vertical line */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full h-6 w-px bg-gradient-to-t from-primary to-transparent mb-1" />
                <div className="absolute left-1/2 -translate-x-1/2 top-full h-6 w-px bg-gradient-to-b from-primary to-transparent mt-1" />
              </motion.div>

              {/* Drag hint */}
              {!isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : {}}
                  transition={{ delay: 1.2 }}
                  className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground"
                >
                  Drag to scrub
                </motion.div>
              )}
            </div>

            {/* Tooltip microcopy */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.8 }}
              className="text-center mt-12"
            >
              <p className="text-sm text-muted-foreground italic">
                "Annotations attach to decisions — not clips."
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
