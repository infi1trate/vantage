import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DrawAnnotation, DrawType, createDrawAnnotation } from "@/lib/captures";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowUp,
  Circle,
  Square,
  Minus,
  Pencil,
  Type,
  MousePointer2,
  Undo2,
  Redo2,
  Trash2,
  Download,
  X,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DrawingCanvasProps {
  sessionId: string;
  currentTime: number;
  isVisible: boolean;
  onClose: () => void;
  onDrawingCreated: (drawing: DrawAnnotation) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

interface Point {
  x: number;
  y: number;
}

interface DrawingShape {
  id: string;
  type: DrawType;
  startX: number;
  startY: number;
  endX?: number;
  endY?: number;
  path?: Point[];
  color: string;
  strokeWidth: number;
  text?: string;
}

const TOOLS: { type: DrawType | "select"; icon: React.ReactNode; label: string }[] = [
  { type: "select", icon: <MousePointer2 className="h-4 w-4" />, label: "Select" },
  { type: "arrow", icon: <ArrowUp className="h-4 w-4" />, label: "Arrow" },
  { type: "circle", icon: <Circle className="h-4 w-4" />, label: "Circle" },
  { type: "rectangle", icon: <Square className="h-4 w-4" />, label: "Rectangle" },
  { type: "line", icon: <Minus className="h-4 w-4" />, label: "Line" },
  { type: "freehand", icon: <Pencil className="h-4 w-4" />, label: "Freehand" },
  { type: "text", icon: <Type className="h-4 w-4" />, label: "Text" },
];

const COLORS = [
  "#00E5FF", // Primary cyan
  "#FF5252", // Red
  "#FFEB3B", // Yellow
  "#69F0AE", // Green
  "#E040FB", // Purple
  "#FF6E40", // Orange
  "#FFFFFF", // White
];

export function DrawingCanvas({
  sessionId,
  currentTime,
  isVisible,
  onClose,
  onDrawingCreated,
  containerRef,
}: DrawingCanvasProps) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTool, setSelectedTool] = useState<DrawType | "select">("arrow");
  const [strokeColor, setStrokeColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [shapes, setShapes] = useState<DrawingShape[]>([]);
  const [currentShape, setCurrentShape] = useState<DrawingShape | null>(null);
  const [undoStack, setUndoStack] = useState<DrawingShape[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingShape[][]>([]);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState<Point | null>(null);
  const [saving, setSaving] = useState(false);

  // Get normalized coordinates (0-1)
  const getNormalizedCoords = useCallback((clientX: number, clientY: number): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }, [containerRef]);

  // Redraw canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Draw all shapes
    const allShapes = currentShape ? [...shapes, currentShape] : shapes;
    
    allShapes.forEach((shape) => {
      const startX = shape.startX * width;
      const startY = shape.startY * height;
      const endX = (shape.endX ?? shape.startX) * width;
      const endY = (shape.endY ?? shape.startY) * height;

      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = shape.strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (shape.type) {
        case "arrow": {
          // Draw line
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Draw arrowhead
          const angle = Math.atan2(endY - startY, endX - startX);
          const headLength = 15;
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - headLength * Math.cos(angle - Math.PI / 6),
            endY - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - headLength * Math.cos(angle + Math.PI / 6),
            endY - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
          break;
        }
        case "circle": {
          const radiusX = Math.abs(endX - startX) / 2;
          const radiusY = Math.abs(endY - startY) / 2;
          const centerX = (startX + endX) / 2;
          const centerY = (startY + endY) / 2;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "rectangle": {
          ctx.beginPath();
          ctx.strokeRect(startX, startY, endX - startX, endY - startY);
          break;
        }
        case "line": {
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          break;
        }
        case "freehand": {
          if (shape.path && shape.path.length > 0) {
            ctx.beginPath();
            ctx.moveTo(shape.path[0].x * width, shape.path[0].y * height);
            shape.path.forEach((point) => {
              ctx.lineTo(point.x * width, point.y * height);
            });
            ctx.stroke();
          }
          break;
        }
        case "text": {
          if (shape.text) {
            ctx.font = `${16 * (shape.strokeWidth / 3)}px Inter, sans-serif`;
            ctx.fillText(shape.text, startX, startY);
          }
          break;
        }
      }
    });
  }, [shapes, currentShape, containerRef]);

  // Redraw on changes
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      redrawCanvas();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, redrawCanvas]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (selectedTool === "select") return;
    if (selectedTool === "text") {
      setTextPosition(getNormalizedCoords(e.clientX, e.clientY));
      return;
    }

    setIsDrawing(true);
    const coords = getNormalizedCoords(e.clientX, e.clientY);

    const newShape: DrawingShape = {
      id: `shape-${Date.now()}`,
      type: selectedTool,
      startX: coords.x,
      startY: coords.y,
      color: strokeColor,
      strokeWidth: strokeWidth,
      path: selectedTool === "freehand" ? [coords] : undefined,
    };

    setCurrentShape(newShape);
  }, [selectedTool, strokeColor, strokeWidth, getNormalizedCoords]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !currentShape) return;

    const coords = getNormalizedCoords(e.clientX, e.clientY);

    if (currentShape.type === "freehand") {
      setCurrentShape({
        ...currentShape,
        path: [...(currentShape.path || []), coords],
      });
    } else {
      setCurrentShape({
        ...currentShape,
        endX: coords.x,
        endY: coords.y,
      });
    }
  }, [isDrawing, currentShape, getNormalizedCoords]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentShape) return;

    setIsDrawing(false);
    setUndoStack((prev) => [...prev, shapes]);
    setRedoStack([]);
    setShapes((prev) => [...prev, currentShape]);
    setCurrentShape(null);
  }, [isDrawing, currentShape, shapes]);

  const handleTextSubmit = useCallback(() => {
    if (!textPosition || !textInput.trim()) {
      setTextPosition(null);
      setTextInput("");
      return;
    }

    const newShape: DrawingShape = {
      id: `shape-${Date.now()}`,
      type: "text",
      startX: textPosition.x,
      startY: textPosition.y,
      color: strokeColor,
      strokeWidth: strokeWidth,
      text: textInput,
    };

    setUndoStack((prev) => [...prev, shapes]);
    setRedoStack([]);
    setShapes((prev) => [...prev, newShape]);
    setTextPosition(null);
    setTextInput("");
  }, [textPosition, textInput, strokeColor, strokeWidth, shapes]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, shapes]);
    setShapes(previousState);
    setUndoStack((prev) => prev.slice(0, -1));
  }, [shapes, undoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, shapes]);
    setShapes(nextState);
    setRedoStack((prev) => prev.slice(0, -1));
  }, [shapes, redoStack]);

  const handleClear = useCallback(() => {
    if (shapes.length === 0) return;
    setUndoStack((prev) => [...prev, shapes]);
    setRedoStack([]);
    setShapes([]);
  }, [shapes]);

  const handleSave = useCallback(async () => {
    if (!user || shapes.length === 0) return;

    setSaving(true);
    try {
      // Save each shape as a draw annotation
      for (const shape of shapes) {
        await createDrawAnnotation({
          session_id: sessionId,
          user_id: user.id,
          annotation_id: null,
          timestamp_ms: Math.floor(currentTime * 1000),
          duration_ms: 3000, // Default 3 second display
          draw_type: shape.type,
          start_x: shape.startX,
          start_y: shape.startY,
          end_x: shape.endX ?? null,
          end_y: shape.endY ?? null,
          width: null,
          height: null,
          path_data: shape.path || null,
          stroke_color: shape.color,
          stroke_width: shape.strokeWidth,
          fill_color: null,
          opacity: 1,
          text_content: shape.text ?? null,
          font_size: 16,
          font_family: "Inter",
          animation: "fade",
        });
      }

      toast.success(`${shapes.length} drawing(s) saved`);
      setShapes([]);
      setUndoStack([]);
      setRedoStack([]);
      onClose();
    } catch (error) {
      console.error("Error saving drawings:", error);
      toast.error("Failed to save drawings");
    } finally {
      setSaving(false);
    }
  }, [user, shapes, sessionId, currentTime, onClose]);

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-30">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Text input overlay */}
      {textPosition && containerRef.current && (
        <div
          className="absolute z-40"
          style={{
            left: `${textPosition.x * 100}%`,
            top: `${textPosition.y * 100}%`,
          }}
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTextSubmit();
              if (e.key === "Escape") {
                setTextPosition(null);
                setTextInput("");
              }
            }}
            onBlur={handleTextSubmit}
            autoFocus
            className="px-2 py-1 bg-background/90 backdrop-blur-sm border border-primary rounded text-sm min-w-[100px]"
            placeholder="Type text..."
            style={{ color: strokeColor }}
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-card/95 backdrop-blur-sm rounded-lg border border-border/50 shadow-lg">
        {/* Tool selection */}
        <div className="flex items-center gap-1 border-r border-border/50 pr-2">
          {TOOLS.map((tool) => (
            <Tooltip key={tool.type}>
              <TooltipTrigger asChild>
                <Button
                  variant={selectedTool === tool.type ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSelectedTool(tool.type)}
                >
                  {tool.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tool.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Color picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <div
                className="w-5 h-5 rounded-full border-2 border-muted-foreground/30"
                style={{ backgroundColor: strokeColor }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="bottom">
            <div className="flex gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-6 h-6 rounded-full transition-transform hover:scale-110",
                    strokeColor === color && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setStrokeColor(color)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Stroke width */}
        <div className="flex items-center gap-2 border-l border-border/50 pl-2">
          <span className="text-xs text-muted-foreground">Size</span>
          <Slider
            value={[strokeWidth]}
            min={1}
            max={10}
            step={1}
            onValueChange={([v]) => setStrokeWidth(v)}
            className="w-16"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 border-l border-border/50 pl-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleClear}
                disabled={shapes.length === 0}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear all</TooltipContent>
          </Tooltip>
        </div>

        {/* Save and close */}
        <div className="flex items-center gap-1 border-l border-border/50 pl-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={shapes.length === 0 || saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-card/90 backdrop-blur-sm rounded text-xs text-muted-foreground">
        Click and drag to draw • Press Escape to cancel • Save to add to timeline
      </div>
    </div>
  );
}
