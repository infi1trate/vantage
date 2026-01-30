import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useState, useCallback, useEffect } from "react";
import { AlertTriangle, Timer, Crosshair, Play, Pause } from "lucide-react";

interface TimelineAnnotation {
  id: number;
  time: number;
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
      return { bg: "bg-vantage-warning/15", border: "border-vantage-warning/50", text: "text-vantage-warning", glow: "shadow-vantage-warning/20" };
    case "destructive":
      return { bg: "bg-destructive/15", border: "border-destructive/50", text: "text-destructive", glow: "shadow-destructive/20" };
    case "vantage-teal":
      return { bg: "bg-vantage-teal/15", border: "border-vantage-teal/50", text: "text-vantage-teal", glow: "shadow-vantage-teal/20" };
    case "primary":
      return { bg: "bg-primary/15", border: "border-primary/50", text: "text-primary", glow: "shadow-primary/20" };
    default:
      return { bg: "bg-muted", border: "border-border", text: "text-foreground", glow: "" };
  }
}

export function TimelineSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const prefersReducedMotion = useReducedMotion();
  
  const [scrubberPosition, setScrubberPosition] = useState(25);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Auto-play demo
  useEffect(() => {
    if (!isInView || isDragging || prefersReducedMotion) return;
    
    const timeout = setTimeout(() => {
      setIsPlaying(true);
    }, 1500);
    
    return () => clearTimeout(timeout);
  }, [isInView, isDragging, prefersReducedMotion]);

  // Playback animation
  useEffect(() => {
    if (!isPlaying || isDragging) return;
    
    const interval = setInterval(() => {
      setScrubberPosition((pos) => {
        if (pos >= 95) {
          setIsPlaying(false);
          return 25;
        }
        return pos + 0.3;
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [isPlaying, isDragging]);

  const handleDrag = useCallback((clientX: number) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setScrubberPosition(percentage);
    setIsPlaying(false);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setIsPlaying(false);
    handleDrag(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleDrag(e.clientX);
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setIsPlaying(false);
    handleDrag(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) handleDrag(e.touches[0].clientX);
  };

  const activeAnnotation = annotations.find(
    (a) => Math.abs(a.time - scrubberPosition) < 6
  );

  const formatTime = (percentage: number) => {
    const totalSeconds = (percentage / 100) * 300;
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

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

          {/* Interactive player */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            {/* Gameplay frame */}
            <div className="relative aspect-video rounded-xl overflow-hidden border border-border/40 bg-card/30 mb-4">
              {/* Dynamic background */}
              <motion.div 
                className="absolute inset-0 transition-all duration-100"
                style={{
                  background: `linear-gradient(${120 + scrubberPosition * 0.5}deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--background)) 40%, hsl(var(--muted) / 0.2) 100%)`,
                }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.008)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.008)_1px,transparent_1px)] bg-[size:28px_28px]" />
              </motion.div>

              {/* Frame counter */}
              <div className="absolute top-4 left-4 px-2 py-1 rounded bg-background/60 backdrop-blur-sm border border-border/30">
                <span className="font-mono text-xs text-muted-foreground">
                  Frame {Math.floor(scrubberPosition * 9)}
                </span>
              </div>

              {/* Active annotation overlay */}
              {activeAnnotation && (
                <motion.div
                  key={activeAnnotation.id}
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  {(() => {
                    const colors = getAnnotationColors(activeAnnotation.color);
                    const Icon = activeAnnotation.icon;
                    return (
                      <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${colors.bg} ${colors.border} backdrop-blur-sm shadow-lg ${colors.glow}`}>
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
              <div className="absolute bottom-4 left-4 flex items-center gap-3">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-8 h-8 rounded-lg bg-background/70 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background/90 transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 text-foreground" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-foreground ml-0.5" />
                  )}
                </button>
                <div className="px-3 py-1.5 rounded-lg bg-background/70 backdrop-blur-sm border border-border/50">
                  <span className="font-mono text-sm text-primary">{formatTime(scrubberPosition)}</span>
                  <span className="text-muted-foreground text-sm"> / 5:00</span>
                </div>
              </div>

              {/* Vignette */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background)/0.5)_100%)]" />
            </div>

            {/* Timeline scrubber */}
            <div
              ref={timelineRef}
              className="relative h-20 cursor-pointer select-none touch-none rounded-lg bg-card/30 border border-border/30 p-4"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            >
              {/* Waveform visualization */}
              <div className="absolute inset-x-4 top-4 bottom-10 flex items-end gap-px opacity-30">
                {[...Array(120)].map((_, i) => {
                  const height = Math.sin(i * 0.3) * 0.3 + Math.random() * 0.4 + 0.3;
                  const isPast = (i / 120) * 100 < scrubberPosition;
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-t transition-colors duration-75 ${isPast ? 'bg-primary/60' : 'bg-muted-foreground/30'}`}
                      style={{ height: `${height * 100}%` }}
                    />
                  );
                })}
              </div>

              {/* Track */}
              <div className="absolute bottom-4 left-4 right-4 h-2 rounded-full bg-muted/40">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary/50"
                  style={{ width: `${scrubberPosition}%` }}
                />
              </div>

              {/* Annotation markers */}
              {annotations.map((annotation) => {
                const colors = getAnnotationColors(annotation.color);
                const isActive = activeAnnotation?.id === annotation.id;
                return (
                  <motion.div
                    key={annotation.id}
                    className="absolute bottom-4"
                    style={{ left: `calc(${annotation.time}% - 4px + 16px)` }}
                  >
                    <motion.div
                      className={`w-3 h-3 rounded-full border-2 transition-all ${colors.bg} ${colors.border} ${isActive ? 'scale-150 shadow-lg' : ''}`}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={isInView ? { opacity: 1, scale: isActive ? 1.5 : 1 } : {}}
                      transition={{ delay: 0.5 + annotation.id * 0.1 }}
                    />
                    {isActive && (
                      <motion.div
                        className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-xs font-mono whitespace-nowrap ${colors.bg} ${colors.border} border`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        {formatTime(annotation.time)}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}

              {/* Scrubber handle */}
              <motion.div
                className="absolute bottom-3 -translate-x-1/2"
                style={{ left: `calc(${scrubberPosition}% * 0.92 + 16px)` }}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-primary border-2 border-background shadow-lg transition-transform ${
                    isDragging ? "scale-125" : "scale-100"
                  }`}
                >
                  <motion.div 
                    className="absolute inset-0 rounded-full bg-primary/40 blur-md -z-10"
                    animate={prefersReducedMotion ? {} : { scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                
                {/* Vertical playhead line */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full h-12 w-px bg-gradient-to-t from-primary to-transparent" />
              </motion.div>
            </div>

            {/* Microcopy */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.8 }}
              className="text-center text-sm text-muted-foreground mt-6 italic"
            >
              "Annotations attach to decisions — not clips."
            </motion.p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
