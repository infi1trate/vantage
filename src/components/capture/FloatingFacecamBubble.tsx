import { useState, useEffect, useRef, useCallback } from "react";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingFacecamBubbleProps {
  stream: MediaStream | null;
  isVisible: boolean;
  className?: string;
}

const STORAGE_KEY = "vantage-facecam-position";
const BUBBLE_PADDING_MOBILE = 16;
const BUBBLE_PADDING_DESKTOP = 24;
const BUBBLE_MAX_WIDTH_MOBILE = 140;
const BUBBLE_MAX_WIDTH_DESKTOP = 220;

interface Position {
  right: number;
  bottom: number;
}

const getDefaultPosition = (): Position => ({
  right: BUBBLE_PADDING_DESKTOP,
  bottom: BUBBLE_PADDING_DESKTOP,
});

const loadSavedPosition = (): Position => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.right === "number" && typeof parsed.bottom === "number") {
        return parsed;
      }
    }
  } catch {
    // Ignore errors
  }
  return getDefaultPosition();
};

const savePosition = (position: Position) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Ignore errors
  }
};

export function FloatingFacecamBubble({
  stream,
  isVisible,
  className,
}: FloatingFacecamBubbleProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>(loadSavedPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPos, setInitialPos] = useState<Position>({ right: 0, bottom: 0 });

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Clamp position within viewport bounds
  const clampPosition = useCallback((pos: Position): Position => {
    if (!bubbleRef.current) return pos;
    
    const rect = bubbleRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = window.innerWidth >= 768 ? BUBBLE_PADDING_DESKTOP : BUBBLE_PADDING_MOBILE;
    
    // Calculate max right/bottom values (keeping bubble on screen)
    const maxRight = viewportWidth - rect.width - padding;
    const maxBottom = viewportHeight - rect.height - padding;
    
    return {
      right: Math.max(padding, Math.min(pos.right, maxRight)),
      bottom: Math.max(padding, Math.min(pos.bottom, maxBottom)),
    };
  }, []);

  // Handle window resize - re-clamp position
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPosition(prev));
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition]);

  // Mouse/touch drag handlers
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
    setInitialPos(position);
  }, [position]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    const deltaX = dragStart.x - clientX;
    const deltaY = dragStart.y - clientY;
    
    const newPosition = clampPosition({
      right: initialPos.right + deltaX,
      bottom: initialPos.bottom + deltaY,
    });
    
    setPosition(newPosition);
  }, [isDragging, dragStart, initialPos, clampPosition]);

  const handleDragEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      savePosition(position);
    }
  }, [isDragging, position]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  }, [handleDragStart]);

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [handleDragStart]);

  // Global mouse/touch move and up handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleTouchEnd = () => {
      handleDragEnd();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  if (!isVisible || !stream) {
    return null;
  }

  return (
    <div
      ref={bubbleRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={cn(
        "fixed z-[60] cursor-grab active:cursor-grabbing select-none touch-none",
        "w-[140px] md:w-[220px] aspect-video",
        "rounded-xl overflow-hidden",
        "border-2 border-primary/50 shadow-lg shadow-black/50",
        "bg-black",
        "transition-shadow duration-150",
        isDragging && "shadow-xl shadow-primary/20",
        className
      )}
      style={{
        right: position.right,
        bottom: position.bottom,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover scale-x-[-1]"
      />
      
      {/* Camera active indicator */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-1.5 py-0.5 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-vantage-success animate-pulse" />
        <Camera className="h-2.5 w-2.5 text-foreground" />
      </div>
      
      {/* Drag hint on hover */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-150 pointer-events-none",
        isDragging && "opacity-100"
      )}>
        <span className="text-[10px] text-white/80 uppercase tracking-wider font-medium">
          Drag to move
        </span>
      </div>
    </div>
  );
}
