/**
 * Processing Jobs Context
 * 
 * Provides React bindings for the ProcessingManager singleton.
 * Manages background video processing jobs with persistence.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ProcessingJob, loadProcessingJobs, dismissProcessingJob } from "@/lib/processingJobs";
import { processingManager } from "@/lib/processingManager";

interface ProcessingContextValue {
  jobs: ProcessingJob[];
  activeJobs: ProcessingJob[];
  completedJobs: ProcessingJob[];
  activeCount: number;
  
  // Queue a new processing job (returns immediately, processing is async)
  queueProcessing: (params: {
    sessionId: string;
    sessionTitle: string;
    blob: Blob;
    thumbnailBlob?: Blob | null;
    thumbnailDataUrl?: string | null;
    mimeType: string;
    fileExt: string;
    duration: number;
    hasCam: boolean;
    hasMic: boolean;
    hasSystemAudio: boolean;
    userId?: string;
    gameName?: string | null;
  }) => ProcessingJob;
  
  // Actions
  cancelJob: (jobId: string) => void;
  retryJob: (jobId: string) => void;
  dismissJob: (jobId: string) => void;
  
  // Capture state - pauses heavy processing during recording
  setCapturing: (isCapturing: boolean) => void;
  
  // UI state
  isFooterExpanded: boolean;
  setFooterExpanded: (expanded: boolean) => void;
  isFooterVisible: boolean;
}

const ProcessingContext = createContext<ProcessingContextValue | null>(null);

export function ProcessingProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [isFooterExpanded, setFooterExpanded] = useState(false);
  
  // Start the processing manager on mount
  useEffect(() => {
    processingManager.start();
    
    // Load initial jobs
    setJobs(loadProcessingJobs());
    
    // Subscribe to job updates from the manager
    const unsubscribe = processingManager.subscribe((updatedJob) => {
      setJobs(prev => {
        const index = prev.findIndex(j => j.id === updatedJob.id);
        if (index === -1) return [updatedJob, ...prev];
        const next = [...prev];
        next[index] = updatedJob;
        return next;
      });
    });
    
    // Sync from storage periodically (multi-tab support)
    const interval = setInterval(() => {
      setJobs(loadProcessingJobs());
    }, 2000);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);
  
  const queueProcessing = useCallback((params: {
    sessionId: string;
    sessionTitle: string;
    blob: Blob;
    thumbnailBlob?: Blob | null;
    thumbnailDataUrl?: string | null;
    mimeType: string;
    fileExt: string;
    duration: number;
    hasCam: boolean;
    hasMic: boolean;
    hasSystemAudio: boolean;
    userId?: string;
    gameName?: string | null;
  }): ProcessingJob => {
    const job = processingManager.enqueue(params);
    setJobs(prev => [job, ...prev.filter(j => j.id !== job.id)]);
    return job;
  }, []);
  
  const handleCancel = useCallback((jobId: string) => {
    processingManager.cancel(jobId);
    setJobs(loadProcessingJobs());
  }, []);
  
  const handleRetry = useCallback((jobId: string) => {
    const job = processingManager.retry(jobId);
    if (job) {
      setJobs(loadProcessingJobs());
    }
  }, []);
  
  const handleDismiss = useCallback((jobId: string) => {
    dismissProcessingJob(jobId);
    setJobs(loadProcessingJobs());
  }, []);
  
  const setCapturing = useCallback((isCapturing: boolean) => {
    processingManager.setCapturing(isCapturing);
  }, []);
  
  const activeJobs = jobs.filter(j => 
    j.status === "queued" || j.status === "processing" || j.status === "uploading"
  );
  const completedJobs = jobs.filter(j => 
    j.status === "completed" || j.status === "failed" || j.status === "cancelled"
  );
  
  const isFooterVisible = jobs.length > 0;
  
  return (
    <ProcessingContext.Provider
      value={{
        jobs,
        activeJobs,
        completedJobs,
        activeCount: activeJobs.length,
        queueProcessing,
        cancelJob: handleCancel,
        retryJob: handleRetry,
        dismissJob: handleDismiss,
        setCapturing,
        isFooterExpanded,
        setFooterExpanded,
        isFooterVisible,
      }}
    >
      {children}
    </ProcessingContext.Provider>
  );
}

export function useProcessing() {
  const context = useContext(ProcessingContext);
  if (!context) {
    throw new Error("useProcessing must be used within a ProcessingProvider");
  }
  return context;
}
