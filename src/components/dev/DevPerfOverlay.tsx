/**
 * Dev-only Performance Overlay
 * 
 * Shows live performance stats during development:
 * - Capture FPS estimate
 * - Dropped frame warnings
 * - Thumbnail queue depth
 * 
 * Only renders in development builds (import.meta.env.DEV)
 */

import { useState, useEffect, useCallback } from "react";
import { subscribeToStats, LiveStats, logPerformanceSummary, resetMetrics } from "@/lib/performanceMetrics";
import { checkBudgets, getLongTaskCount, logBudgetReport } from "@/lib/performanceBudget";
import { Activity, AlertTriangle, Image, ChevronDown, ChevronUp, RotateCcw, FileText, Target } from "lucide-react";
import { cn } from "@/lib/utils";

// Only render in development
const IS_DEV = import.meta.env.DEV;

interface DevPerfOverlayProps {
  className?: string;
}

export function DevPerfOverlay({ className }: DevPerfOverlayProps) {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  // Subscribe to live stats
  useEffect(() => {
    if (!IS_DEV) return;
    
    const unsubscribe = subscribeToStats((newStats) => {
      setStats(newStats);
    });
    
    return unsubscribe;
  }, []);
  
  // Keyboard shortcut to toggle (Ctrl+Shift+P)
  useEffect(() => {
    if (!IS_DEV) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  
  const handleLogSummary = useCallback(() => {
    logPerformanceSummary();
  }, []);
  
  const handleReset = useCallback(() => {
    resetMetrics();
  }, []);
  
  // Don't render in production
  if (!IS_DEV) return null;
  
  // Don't render if not visible
  if (!isVisible) return null;
  
  const captureFPS = stats?.captureFPS ?? 0;
  const droppedWarnings = stats?.droppedFrameWarnings ?? [];
  const thumbnailQueue = stats?.thumbnailQueueDepth ?? 0;
  const recentMetrics = stats?.recentMetrics ?? [];
  
  // Determine FPS status color
  const fpsColor = captureFPS >= 28 ? "text-green-400" : 
                   captureFPS >= 20 ? "text-yellow-400" : 
                   captureFPS > 0 ? "text-red-400" : "text-muted-foreground";
  
  return (
    <div 
      className={cn(
        "fixed bottom-4 right-4 z-[9999] font-mono text-xs",
        "bg-black/90 border border-white/20 rounded-lg shadow-xl",
        "backdrop-blur-sm max-w-sm",
        className
      )}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b border-white/10 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="text-white/80 font-semibold">Perf</span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Quick stats */}
          <div className="flex items-center gap-1.5">
            <span className={cn("font-bold", fpsColor)}>
              {captureFPS > 0 ? `${captureFPS} FPS` : "—"}
            </span>
            
            {droppedWarnings.length > 0 && (
              <AlertTriangle className="h-3 w-3 text-yellow-400" />
            )}
            
            {thumbnailQueue > 0 && (
              <span className="flex items-center gap-0.5 text-muted-foreground">
                <Image className="h-3 w-3" />
                {thumbnailQueue}
              </span>
            )}
          </div>
          
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-white/50" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-white/50" />
          )}
        </div>
      </div>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 py-2 space-y-3">
          {/* Capture Stats */}
          <div className="space-y-1">
            <div className="text-white/50 text-[10px] uppercase tracking-wider">Capture</div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">FPS</span>
              <span className={cn("font-bold", fpsColor)}>{captureFPS || "—"}</span>
            </div>
          </div>
          
          {/* Dropped Frames */}
          {droppedWarnings.length > 0 && (
            <div className="space-y-1">
              <div className="text-yellow-400/80 text-[10px] uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Dropped Frames ({droppedWarnings.length})
              </div>
              <div className="max-h-20 overflow-y-auto space-y-0.5">
                {droppedWarnings.slice(-5).map((warning, i) => (
                  <div key={i} className="text-white/50 text-[10px] truncate">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Thumbnail Queue */}
          <div className="space-y-1">
            <div className="text-white/50 text-[10px] uppercase tracking-wider">Thumbnails</div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Queue Depth</span>
              <span className={cn(
                "font-bold",
                thumbnailQueue > 5 ? "text-yellow-400" : "text-white/80"
              )}>
                {thumbnailQueue}
              </span>
            </div>
          </div>
          
          {/* Recent Metrics */}
          {recentMetrics.length > 0 && (
            <div className="space-y-1">
              <div className="text-white/50 text-[10px] uppercase tracking-wider">Recent</div>
              <div className="max-h-24 overflow-y-auto space-y-0.5">
                {recentMetrics.slice(-5).map((metric, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span className="text-white/50 truncate max-w-[180px]">
                      {metric.category}
                    </span>
                    <span className={cn(
                      "font-mono",
                      metric.duration > 50 ? "text-yellow-400" : "text-white/70"
                    )}>
                      {metric.duration.toFixed(1)}ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Budget Violations */}
          {(() => {
            const violations = checkBudgets();
            const longTasks = getLongTaskCount();
            if (violations.length === 0 && longTasks === 0) return null;
            
            return (
              <div className="space-y-1">
                <div className="text-red-400/80 text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Budget Violations ({violations.length})
                </div>
                <div className="max-h-16 overflow-y-auto space-y-0.5">
                  {violations.slice(0, 3).map((v, i) => (
                    <div key={i} className="text-red-300/70 text-[10px] truncate">
                      {v.budget.name}: {v.actual.toFixed(0)}ms &gt; {v.threshold}ms
                    </div>
                  ))}
                  {longTasks > 0 && (
                    <div className="text-yellow-300/70 text-[10px]">
                      Long tasks: {longTasks}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          
          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/10">
            <button
              onClick={handleLogSummary}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
            >
              <FileText className="h-3 w-3" />
              Log Summary
            </button>
            <button
              onClick={() => logBudgetReport()}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
            >
              <Target className="h-3 w-3" />
              Budgets
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
          
          {/* Hint */}
          <div className="text-[9px] text-white/30 text-center">
            Ctrl+Shift+P to toggle
          </div>
        </div>
      )}
    </div>
  );
}

// Export a hook for programmatic control
export function useDevPerfOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  
  const show = useCallback(() => setIsVisible(true), []);
  const hide = useCallback(() => setIsVisible(false), []);
  const toggle = useCallback(() => setIsVisible(prev => !prev), []);
  
  return { isVisible, show, hide, toggle };
}
