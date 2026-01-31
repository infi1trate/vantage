import { useState, useCallback, useRef } from "react";
import { SelectionState } from "./TimelineSelection";
import { cn } from "@/lib/utils";

interface FrameClickHandlerProps {
  selection: SelectionState;
  currentTime: number;
  onFrameClick?: (x: number, y: number, time: number, endTime?: number) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function FrameClickHandler({
  selection,
  currentTime,
  onFrameClick,
  children,
  className,
  disabled = false,
  onClick,
}: FrameClickHandlerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showCursor, setShowCursor] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const hasSelection = selection.type !== null;
  const isEnabled = hasSelection && !disabled;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isEnabled || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    setCursorPos({ x, y });
    setShowCursor(true);
  }, [isEnabled]);

  const handleMouseLeave = useCallback(() => {
    setShowCursor(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Call parent onClick first (for stopPropagation etc.)
    onClick?.(e);
    
    if (!isEnabled || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Clamp to valid range
    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));
    
    const time = selection.type === "range" ? selection.rangeStart! : (selection.point ?? currentTime);
    const endTime = selection.type === "range" ? selection.rangeEnd : undefined;
    
    onFrameClick?.(clampedX, clampedY, time, endTime);
  }, [isEnabled, selection, currentTime, onFrameClick, onClick]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative",
        isEnabled && "cursor-crosshair",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      
      {/* Crosshair cursor indicator */}
      {isEnabled && showCursor && (
        <div
          className="absolute pointer-events-none z-30"
          style={{
            left: `${cursorPos.x * 100}%`,
            top: `${cursorPos.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Vertical line */}
          <div className="absolute w-px h-6 bg-primary/60 -translate-y-1/2 left-1/2 -translate-x-1/2" />
          {/* Horizontal line */}
          <div className="absolute h-px w-6 bg-primary/60 -translate-x-1/2 top-1/2 -translate-y-1/2" />
          {/* Center dot */}
          <div className="absolute w-2 h-2 rounded-full bg-primary border border-background -translate-x-1/2 -translate-y-1/2" />
        </div>
      )}
    </div>
  );
}
