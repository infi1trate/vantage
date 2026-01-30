import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface SelectionState {
  type: "point" | "range" | null;
  point?: number;
  rangeStart?: number;
  rangeEnd?: number;
}

interface TimelineSelectionProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  markers?: Array<{ id: string; time: number; color?: string }>;
  onMarkerClick?: (id: string, time: number) => void;
  className?: string;
}

export function TimelineSelection({
  duration,
  currentTime,
  onSeek,
  selection,
  onSelectionChange,
  markers = [],
  onMarkerClick,
  className,
}: TimelineSelectionProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<"seek" | "range" | "handle-start" | "handle-end" | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [selectionHistory, setSelectionHistory] = useState<SelectionState[]>([]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${mins}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

  const formatTimeShort = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimeFromPosition = useCallback((clientX: number) => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return percentage * duration;
  }, [duration]);

  const pushHistory = useCallback((newSelection: SelectionState) => {
    setSelectionHistory(prev => [...prev.slice(-20), selection]);
    onSelectionChange(newSelection);
  }, [selection, onSelectionChange]);

  const undo = useCallback(() => {
    if (selectionHistory.length > 0) {
      const prev = selectionHistory[selectionHistory.length - 1];
      setSelectionHistory(h => h.slice(0, -1));
      onSelectionChange(prev);
    }
  }, [selectionHistory, onSelectionChange]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const time = getTimeFromPosition(e.clientX);
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Check if clicking on a handle
    if (selection.type === "range" && selection.rangeStart !== undefined && selection.rangeEnd !== undefined) {
      const startX = (selection.rangeStart / duration) * rect.width;
      const endX = (selection.rangeEnd / duration) * rect.width;
      const clickX = e.clientX - rect.left;
      
      if (Math.abs(clickX - startX) < 10) {
        setDragType("handle-start");
        setIsDragging(true);
        return;
      }
      if (Math.abs(clickX - endX) < 10) {
        setDragType("handle-end");
        setIsDragging(true);
        return;
      }
    }

    // Start range selection on shift+click or regular drag
    if (e.shiftKey && selection.type === "point" && selection.point !== undefined) {
      // Shift+click extends from current point to clicked position
      const start = Math.min(selection.point, time);
      const end = Math.max(selection.point, time);
      pushHistory({ type: "range", rangeStart: start, rangeEnd: end });
      return;
    }

    setDragStart(time);
    setDragType("seek");
    setIsDragging(true);
    onSeek(time);
  }, [getTimeFromPosition, selection, duration, pushHistory, onSeek]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const time = getTimeFromPosition(e.clientX);
    setHoverTime(time);

    if (!isDragging) return;

    if (dragType === "handle-start" && selection.rangeEnd !== undefined) {
      const newStart = Math.min(time, selection.rangeEnd - 0.1);
      onSelectionChange({ type: "range", rangeStart: newStart, rangeEnd: selection.rangeEnd });
      onSeek(newStart);
    } else if (dragType === "handle-end" && selection.rangeStart !== undefined) {
      const newEnd = Math.max(time, selection.rangeStart + 0.1);
      onSelectionChange({ type: "range", rangeStart: selection.rangeStart, rangeEnd: newEnd });
      onSeek(newEnd);
    } else if (dragType === "seek" && dragStart !== null) {
      const diff = Math.abs(time - dragStart);
      
      // If dragged more than 0.5 seconds, switch to range selection
      if (diff > 0.5) {
        setDragType("range");
        const start = Math.min(dragStart, time);
        const end = Math.max(dragStart, time);
        onSelectionChange({ type: "range", rangeStart: start, rangeEnd: end });
      } else {
        onSeek(time);
      }
    } else if (dragType === "range" && dragStart !== null) {
      const start = Math.min(dragStart, time);
      const end = Math.max(dragStart, time);
      onSelectionChange({ type: "range", rangeStart: start, rangeEnd: end });
      onSeek(time);
    }
  }, [getTimeFromPosition, isDragging, dragType, dragStart, selection, onSelectionChange, onSeek]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      if (dragType === "seek" && dragStart !== null) {
        // Was a simple click, set point selection
        pushHistory({ type: "point", point: dragStart });
      } else if (dragType === "range" || dragType === "handle-start" || dragType === "handle-end") {
        // Range was created/modified, save to history
        if (selection.type === "range") {
          setSelectionHistory(prev => [...prev.slice(-20), { type: null }]);
        }
      }
    }
    setIsDragging(false);
    setDragType(null);
    setDragStart(null);
  }, [isDragging, dragType, dragStart, selection, pushHistory]);

  // Global mouse up
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) handleMouseUp();
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDragging, handleMouseUp]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const frameTime = 1 / 30; // 30fps

      switch (e.code) {
        case "KeyI":
          e.preventDefault();
          // Set range start (In point)
          if (selection.type === "range" && selection.rangeEnd !== undefined) {
            pushHistory({ type: "range", rangeStart: currentTime, rangeEnd: selection.rangeEnd });
          } else {
            pushHistory({ type: "range", rangeStart: currentTime, rangeEnd: Math.min(currentTime + 5, duration) });
          }
          break;
        case "KeyO":
          e.preventDefault();
          // Set range end (Out point)
          if (selection.type === "range" && selection.rangeStart !== undefined) {
            pushHistory({ type: "range", rangeStart: selection.rangeStart, rangeEnd: currentTime });
          } else {
            pushHistory({ type: "range", rangeStart: Math.max(currentTime - 5, 0), rangeEnd: currentTime });
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) {
            // Jump 1 second
            onSeek(Math.max(0, currentTime - 1));
          } else {
            // Frame step backward
            onSeek(Math.max(0, currentTime - frameTime));
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) {
            // Jump 1 second
            onSeek(Math.min(duration, currentTime + 1));
          } else {
            // Frame step forward
            onSeek(Math.min(duration, currentTime + frameTime));
          }
          break;
        case "KeyZ":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            undo();
          }
          break;
        case "Escape":
          e.preventDefault();
          pushHistory({ type: null });
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, duration, selection, pushHistory, onSeek, undo]);

  const progressPercentage = (currentTime / duration) * 100;
  const rangeStartPct = selection.rangeStart !== undefined ? (selection.rangeStart / duration) * 100 : 0;
  const rangeEndPct = selection.rangeEnd !== undefined ? (selection.rangeEnd / duration) * 100 : 0;

  return (
    <div
      ref={timelineRef}
      className={cn(
        "relative h-16 cursor-crosshair select-none rounded-lg overflow-hidden",
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => !isDragging && setHoverTime(null)}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-muted/50" />

      {/* Progress fill (played area) */}
      <div
        className="absolute inset-y-0 left-0 bg-primary/10 pointer-events-none"
        style={{ width: `${progressPercentage}%` }}
      />

      {/* Range selection highlight */}
      {selection.type === "range" && selection.rangeStart !== undefined && selection.rangeEnd !== undefined && (
        <>
          {/* Range highlight */}
          <div
            className="absolute inset-y-0 bg-primary/25 border-y-2 border-primary/50 pointer-events-none"
            style={{
              left: `${rangeStartPct}%`,
              width: `${rangeEndPct - rangeStartPct}%`,
            }}
          />
          
          {/* Start handle */}
          <div
            className={cn(
              "absolute top-0 bottom-0 w-1.5 bg-primary cursor-ew-resize z-20",
              "hover:w-2 hover:bg-primary/90 transition-all"
            )}
            style={{ left: `${rangeStartPct}%`, transform: "translateX(-50%)" }}
          >
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-mono whitespace-nowrap">
              {formatTimeShort(selection.rangeStart)}
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-6 rounded-sm bg-primary shadow-md" />
          </div>

          {/* End handle */}
          <div
            className={cn(
              "absolute top-0 bottom-0 w-1.5 bg-primary cursor-ew-resize z-20",
              "hover:w-2 hover:bg-primary/90 transition-all"
            )}
            style={{ left: `${rangeEndPct}%`, transform: "translateX(-50%)" }}
          >
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-mono whitespace-nowrap">
              {formatTimeShort(selection.rangeEnd)}
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-6 rounded-sm bg-primary shadow-md" />
          </div>

          {/* Duration label */}
          <div
            className="absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-mono pointer-events-none"
            style={{
              left: `${rangeStartPct + (rangeEndPct - rangeStartPct) / 2}%`,
            }}
          >
            {(selection.rangeEnd - selection.rangeStart).toFixed(1)}s
          </div>
        </>
      )}

      {/* Time markers along bottom */}
      <div className="absolute bottom-1 left-0 right-0 flex justify-between px-2 text-[10px] font-mono text-muted-foreground/50 pointer-events-none">
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <span key={pct}>{formatTimeShort(pct * duration)}</span>
        ))}
      </div>

      {/* Markers */}
      {markers.map((marker) => (
        <button
          key={marker.id}
          className={cn(
            "absolute top-2 bottom-6 w-1 rounded-full transition-transform hover:scale-x-150 z-10",
            marker.color || "bg-primary"
          )}
          style={{ left: `${(marker.time / duration) * 100}%` }}
          onClick={(e) => {
            e.stopPropagation();
            onSeek(marker.time);
            onMarkerClick?.(marker.id, marker.time);
          }}
        />
      ))}

      {/* Playhead */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-foreground pointer-events-none z-30"
        style={{ left: `${progressPercentage}%` }}
      >
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-foreground shadow-lg" />
        {/* Current time tooltip */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-foreground text-background text-[10px] font-mono whitespace-nowrap">
          {formatTime(currentTime)}
        </div>
      </div>

      {/* Hover time indicator */}
      {hoverTime !== null && !isDragging && (
        <div
          className="absolute top-0 bottom-0 w-px bg-muted-foreground/30 pointer-events-none z-10"
          style={{ left: `${(hoverTime / duration) * 100}%` }}
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono whitespace-nowrap">
            {formatTimeShort(hoverTime)}
          </div>
        </div>
      )}

      {/* Keyboard hints (shown briefly or on focus) */}
      <div className="absolute top-1 right-2 flex gap-1.5 text-[9px] text-muted-foreground/40 pointer-events-none">
        <span>I/O: range</span>
        <span>←→: frame</span>
      </div>
    </div>
  );
}
