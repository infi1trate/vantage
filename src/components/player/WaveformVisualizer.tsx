import { useRef, useEffect, useMemo } from "react";

interface WaveformVisualizerProps {
  audioUrl?: string | null;
  duration: number;
  currentTime: number;
  height?: number;
  barWidth?: number;
  barGap?: number;
  color?: string;
  progressColor?: string;
}

// Generate mock waveform data for demo
function generateMockWaveform(numBars: number): number[] {
  const data: number[] = [];
  let lastValue = 0.5;
  
  for (let i = 0; i < numBars; i++) {
    // Create somewhat realistic audio waveform pattern
    const noise = (Math.random() - 0.5) * 0.3;
    const trend = Math.sin(i / 20) * 0.2;
    const spike = Math.random() > 0.95 ? Math.random() * 0.4 : 0;
    
    lastValue = Math.max(0.1, Math.min(1, lastValue + noise + spike));
    data.push(lastValue * (0.5 + trend));
  }
  
  return data;
}

export function WaveformVisualizer({
  audioUrl,
  duration,
  currentTime,
  height = 48,
  barWidth = 2,
  barGap = 1,
  color = "hsl(var(--muted-foreground) / 0.3)",
  progressColor = "hsl(var(--primary))",
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Generate or load waveform data
  const waveformData = useMemo(() => {
    // In production, this would load actual waveform data from the audio file
    // For now, generate mock data
    const numBars = 200;
    return generateMockWaveform(numBars);
  }, [audioUrl]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const totalBarWidth = barWidth + barGap;
    const numBars = Math.floor(width / totalBarWidth);
    const progressPosition = (currentTime / duration) * width;

    // Resample waveform data to fit canvas
    const step = waveformData.length / numBars;

    for (let i = 0; i < numBars; i++) {
      const dataIndex = Math.floor(i * step);
      const value = waveformData[dataIndex] || 0;
      const barHeight = value * (height * 0.8);
      const x = i * totalBarWidth;
      const y = (height - barHeight) / 2;

      // Use progress color for bars before current time
      ctx.fillStyle = x < progressPosition ? progressColor : color;
      
      // Draw bar with rounded ends
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
      ctx.fill();
    }
  }, [waveformData, currentTime, duration, height, barWidth, barGap, color, progressColor]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      // Trigger redraw on resize
      const canvas = canvasRef.current;
      if (canvas) {
        const event = new Event("resize");
        canvas.dispatchEvent(event);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} className="w-full" />
    </div>
  );
}
