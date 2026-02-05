/**
 * FloatingFacecamBubble - Camera preview bubble during recording
 * 
 * Displays camera stream in a draggable bubble with snap-to-corner behavior.
 * Supports Picture-in-Picture pop-out mode.
 * 
 * IMPORTANT: This component should receive stream and PiP controls from parent
 * to ensure single camera stream instance across the app.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Camera, ExternalLink, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingFacecamBubbleProps {
  /** Camera stream to display */
  stream: MediaStream | null;
  /** Whether the bubble should be visible */
  isVisible: boolean;
  /** Whether PiP mode is currently active */
  isPiPActive: boolean;
  /** Whether PiP is supported in this browser */
  isPiPSupported: boolean;
  /** Callback to request PiP mode */
  onRequestPiP: () => void;
  /** Callback to exit PiP and return to page */
  onExitPiP: () => void;
  /** Optional className */
  className?: string;
}

const STORAGE_KEY = "vantage-facecam-position-corner";
const BUBBLE_PADDING_MOBILE = 16;
const BUBBLE_PADDING_DESKTOP = 24;

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const getDefaultCorner = (): Corner => "bottom-right";

const loadSavedCorner = (): Corner => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ["top-left", "top-right", "bottom-left", "bottom-right"].includes(saved)) {
      return saved as Corner;
    }
  } catch {
    // Ignore errors
  }
  return getDefaultCorner();
};

const saveCorner = (corner: Corner) => {
  try {
    localStorage.setItem(STORAGE_KEY, corner);
  } catch {
    // Ignore errors
  }
};

// Get CSS positioning based on corner
const getCornerStyles = (corner: Corner, padding: number): React.CSSProperties => {
  switch (corner) {
    case "top-left":
      return { top: padding, left: padding, right: "auto", bottom: "auto" };
    case "top-right":
      return { top: padding, right: padding, left: "auto", bottom: "auto" };
    case "bottom-left":
      return { bottom: padding, left: padding, right: "auto", top: "auto" };
    case "bottom-right":
    default:
      return { bottom: padding, right: padding, left: "auto", top: "auto" };
  }
};

// Find nearest corner based on bubble center position
const findNearestCorner = (
  centerX: number,
  centerY: number,
  viewportWidth: number,
  viewportHeight: number
): Corner => {
  const midX = viewportWidth / 2;
  const midY = viewportHeight / 2;

  if (centerX < midX) {
    return centerY < midY ? "top-left" : "bottom-left";
  } else {
    return centerY < midY ? "top-right" : "bottom-right";
  }
};

export function FloatingFacecamBubble({
  stream,
  isVisible,
  isPiPActive,
  isPiPSupported,
  onRequestPiP,
  onExitPiP,
  className,
}: FloatingFacecamBubbleProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [corner, setCorner] = useState<Corner>(loadSavedCorner);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  // Create or find portal root on mount
  useEffect(() => {
    let root = document.getElementById("facecam-portal-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "facecam-portal-root";
      document.body.appendChild(root);
    }
    setPortalRoot(root);
  }, []);

  // Attach stream to video element when stream changes
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      // Ensure video plays
      video.play().catch(err => {
        console.warn("[FacecamBubble] Video play failed:", err);
      });
    }
  }, [stream]);

  // Get current padding based on viewport
  const getPadding = useCallback(() => {
    return window.innerWidth >= 768 ? BUBBLE_PADDING_DESKTOP : BUBBLE_PADDING_MOBILE;
  }, []);

  // Mouse/touch drag handlers
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (!bubbleRef.current) return;
    
    const rect = bubbleRef.current.getBoundingClientRect();
    setIsDragging(true);
    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
    setDragPosition({
      x: rect.left,
      y: rect.top,
    });
  }, []);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !bubbleRef.current) return;

    const rect = bubbleRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = getPadding();

    // Calculate new position, clamped to viewport
    const newX = Math.max(padding, Math.min(clientX - dragOffset.x, viewportWidth - rect.width - padding));
    const newY = Math.max(padding, Math.min(clientY - dragOffset.y, viewportHeight - rect.height - padding));

    setDragPosition({ x: newX, y: newY });
  }, [isDragging, dragOffset, getPadding]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging || !bubbleRef.current || !dragPosition) {
      setIsDragging(false);
      setDragPosition(null);
      return;
    }

    const rect = bubbleRef.current.getBoundingClientRect();
    const centerX = dragPosition.x + rect.width / 2;
    const centerY = dragPosition.y + rect.height / 2;

    const newCorner = findNearestCorner(
      centerX,
      centerY,
      window.innerWidth,
      window.innerHeight
    );

    setCorner(newCorner);
    saveCorner(newCorner);
    setIsDragging(false);
    setDragPosition(null);
  }, [isDragging, dragPosition]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking on a button
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  }, [handleDragStart]);

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't start drag if touching a button
    if ((e.target as HTMLElement).closest("button")) return;
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

  // Don't render if not visible, no stream, or portal not ready
  if (!isVisible || !stream || !portalRoot) {
    return null;
  }

  const padding = getPadding();
  const cornerStyles = getCornerStyles(corner, padding);

  // When dragging, use absolute left/top positioning
  const positionStyles: React.CSSProperties = dragPosition
    ? {
        left: dragPosition.x,
        top: dragPosition.y,
        right: "auto",
        bottom: "auto",
      }
    : cornerStyles;

  // If PiP is active, render only a minimal "return to page" control
  // The in-page bubble should be completely hidden to avoid duplicates
  if (isPiPActive) {
    const returnControl = (
      <div
        className={cn(
          "fixed z-[9999] select-none",
          "flex items-center gap-2 px-3 py-2",
          "bg-background/90 backdrop-blur-sm rounded-full",
          "border border-border shadow-lg",
          "transition-opacity duration-200"
        )}
        style={{
          ...getCornerStyles("bottom-right", padding),
          transform: "none",
        }}
      >
        <Camera className="h-4 w-4 text-muted-foreground" />
        <button
          onClick={onExitPiP}
          className="flex items-center gap-1.5 text-sm text-foreground hover:text-primary transition-colors"
        >
          <CornerDownLeft className="h-3.5 w-3.5" />
          Return to page
        </button>
      </div>
    );

    return createPortal(returnControl, portalRoot);
  }

  // Render the full camera bubble with preview
  const bubbleContent = (
    <div
      ref={bubbleRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={cn(
        "fixed z-[9999] cursor-grab active:cursor-grabbing select-none touch-none",
        "w-[140px] md:w-[220px] aspect-video",
        "rounded-xl overflow-hidden",
        "border-2 border-primary/50 shadow-lg shadow-black/50",
        "bg-black",
        "transition-[top,left,right,bottom] duration-200 ease-out",
        isDragging && "shadow-xl shadow-primary/20 transition-none",
        className
      )}
      style={{
        ...positionStyles,
        transform: "none",
        willChange: isDragging ? "left, top" : "auto",
      }}
    >
      {/* Single video element for in-page preview */}
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

      {/* Pop-out to PiP button */}
      {isPiPSupported && (
        <button
          onClick={onRequestPiP}
          className={cn(
            "absolute bottom-1.5 right-1.5",
            "flex items-center gap-1 px-2 py-1",
            "bg-background/80 backdrop-blur-sm rounded-full",
            "text-[10px] text-foreground/80 hover:text-foreground",
            "hover:bg-background/95 transition-colors",
            "cursor-pointer"
          )}
          title="Pop out camera"
        >
          <ExternalLink className="h-3 w-3" />
          <span className="hidden md:inline">Pop out</span>
        </button>
      )}
      
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

  // Render via portal to ensure it's outside any transformed parents
  return createPortal(bubbleContent, portalRoot);
}
