/**
 * Render Queue Hook
 * 
 * React hook for managing render queue state and actions.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RenderJob,
  RenderJobType,
  loadRenderJobs,
  createRenderJob,
  updateRenderJob,
  updateStageProgress,
  cancelRenderJob,
  retryRenderJob,
  dismissRenderJob,
  getActiveRenderJobs,
  getSessionRenderJobs,
  ExportState,
  getExportState,
} from "@/lib/renderQueue";

interface UseRenderQueueResult {
  // All jobs
  jobs: RenderJob[];
  
  // Filtered views
  activeJobs: RenderJob[];
  completedJobs: RenderJob[];
  failedJobs: RenderJob[];
  
  // Counts
  activeCount: number;
  hasActiveJobs: boolean;
  
  // Actions
  startJob: (params: {
    type: RenderJobType;
    sessionId: string;
    sessionTitle: string;
    reelId?: string;
    reelTitle?: string;
    aspectRatio?: string;
    clipCount?: number;
    frameOverlayId?: string;
    effectEventIds?: string[];
    reelPackageConfigId?: string;
    outputQuality?: "preview" | "standard" | "high";
    outputResolution?: "720p" | "1080p" | "1440p" | "4k";
  }) => RenderJob;
  cancelJob: (jobId: string) => void;
  retryJob: (jobId: string) => void;
  dismissJob: (jobId: string) => void;
  
  // Progress simulation (for demo)
  simulateProgress: (jobId: string) => void;
  
  // Refresh
  refresh: () => void;
}

export function useRenderQueue(): UseRenderQueueResult {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const simulationRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Load jobs on mount
  useEffect(() => {
    setJobs(loadRenderJobs());
  }, []);
  
  // Sync jobs periodically (for multi-tab support)
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(loadRenderJobs());
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Cleanup simulations on unmount
  useEffect(() => {
    return () => {
      simulationRefs.current.forEach(timer => clearTimeout(timer));
    };
  }, []);
  
  const refresh = useCallback(() => {
    setJobs(loadRenderJobs());
  }, []);
  
  const activeJobs = jobs.filter(j => 
    j.status === "queued" || j.status === "processing" || j.status === "uploading"
  );
  
  const completedJobs = jobs.filter(j => j.status === "completed");
  const failedJobs = jobs.filter(j => j.status === "failed");
  
  const startJob = useCallback((params: Parameters<typeof createRenderJob>[0]) => {
    const job = createRenderJob(params);
    setJobs(loadRenderJobs());
    return job;
  }, []);
  
  const handleCancelJob = useCallback((jobId: string) => {
    // Stop any simulation
    const timer = simulationRefs.current.get(jobId);
    if (timer) {
      clearTimeout(timer);
      simulationRefs.current.delete(jobId);
    }
    
    cancelRenderJob(jobId);
    setJobs(loadRenderJobs());
  }, []);
  
  const handleRetryJob = useCallback((jobId: string) => {
    retryRenderJob(jobId);
    setJobs(loadRenderJobs());
  }, []);
  
  const handleDismissJob = useCallback((jobId: string) => {
    dismissRenderJob(jobId);
    setJobs(loadRenderJobs());
  }, []);
  
  // Simulate progress for demo purposes
  const simulateProgress = useCallback((jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.status !== "queued") return;
    
    // Start processing
    updateRenderJob(jobId, {
      status: "processing",
      startedAt: new Date().toISOString(),
      currentStageIndex: 0,
    });
    setJobs(loadRenderJobs());
    
    let stageIndex = 0;
    let stageProgress = 0;
    
    const tick = () => {
      const currentJob = loadRenderJobs().find(j => j.id === jobId);
      if (!currentJob || currentJob.status === "cancelled") {
        simulationRefs.current.delete(jobId);
        return;
      }
      
      stageProgress += 5 + Math.random() * 10;
      
      if (stageProgress >= 100) {
        stageProgress = 0;
        stageIndex++;
        
        if (stageIndex >= currentJob.stages.length) {
          // Complete
          updateRenderJob(jobId, {
            status: "completed",
            finalUrl: `/api/exports/${jobId}.mp4`,
          });
          setJobs(loadRenderJobs());
          simulationRefs.current.delete(jobId);
          return;
        }
        
        updateRenderJob(jobId, { currentStageIndex: stageIndex });
      } else {
        updateStageProgress(jobId, stageIndex, stageProgress);
      }
      
      setJobs(loadRenderJobs());
      
      // Schedule next tick
      const delay = 200 + Math.random() * 300;
      simulationRefs.current.set(jobId, setTimeout(tick, delay));
    };
    
    // Start simulation
    tick();
  }, [jobs]);
  
  return {
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    activeCount: activeJobs.length,
    hasActiveJobs: activeJobs.length > 0,
    startJob,
    cancelJob: handleCancelJob,
    retryJob: handleRetryJob,
    dismissJob: handleDismissJob,
    simulateProgress,
    refresh,
  };
}

/**
 * Hook for session-specific render jobs
 */
export function useSessionRenderJobs(sessionId: string | undefined) {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  
  useEffect(() => {
    if (!sessionId) {
      setJobs([]);
      return;
    }
    
    setJobs(getSessionRenderJobs(sessionId));
    
    const interval = setInterval(() => {
      setJobs(getSessionRenderJobs(sessionId));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sessionId]);
  
  return jobs;
}

/**
 * Hook for export state
 */
export function useExportState(sessionId: string | undefined) {
  const [state, setState] = useState<ReturnType<typeof getExportState>>({
    state: "idle",
    progress: 0,
    stage: "",
    canCancel: false,
  });
  
  useEffect(() => {
    if (!sessionId) return;
    
    setState(getExportState(sessionId));
    
    const interval = setInterval(() => {
      setState(getExportState(sessionId));
    }, 500);
    
    return () => clearInterval(interval);
  }, [sessionId]);
  
  return state;
}
