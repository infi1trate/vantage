import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  ExportJob,
  JobType,
  loadJobs,
  createJob,
  updateJob,
  cancelJob as cancelJobFn,
  retryJob as retryJobFn,
  deleteJob as deleteJobFn,
  simulateJobProcessing,
} from "@/lib/exportJobs";

interface JobsContextValue {
  jobs: ExportJob[];
  activeCount: number;
  
  // Actions
  startJob: (
    type: JobType,
    sessionId: string,
    sessionTitle: string,
    config: ExportJob["config"]
  ) => ExportJob;
  cancelJob: (jobId: string) => void;
  retryJob: (jobId: string) => void;
  deleteJob: (jobId: string) => void;
  
  // Current job being viewed in progress panel
  currentJobId: string | null;
  setCurrentJobId: (id: string | null) => void;
  
  // Panel visibility
  showJobsPanel: boolean;
  setShowJobsPanel: (show: boolean) => void;
}

const JobsContext = createContext<JobsContextValue | null>(null);

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [showJobsPanel, setShowJobsPanel] = useState(false);
  
  // Track active job processors to avoid duplicates
  const processingJobs = useRef<Set<string>>(new Set());
  
  // Load jobs from storage on mount
  useEffect(() => {
    const stored = loadJobs();
    setJobs(stored);
    
    // Resume any pending jobs that weren't completed
    stored
      .filter(j => j.status === "pending" || j.status === "processing")
      .forEach(job => {
        if (!processingJobs.current.has(job.id)) {
          processJob(job.id);
        }
      });
  }, []);
  
  // Sync jobs state from storage periodically (for multi-tab support)
  useEffect(() => {
    const interval = setInterval(() => {
      const stored = loadJobs();
      setJobs(stored);
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  const processJob = useCallback(async (jobId: string) => {
    if (processingJobs.current.has(jobId)) return;
    processingJobs.current.add(jobId);
    
    try {
      await simulateJobProcessing(jobId, (updatedJob) => {
        setJobs(prev => {
          const index = prev.findIndex(j => j.id === updatedJob.id);
          if (index === -1) return [...prev, updatedJob];
          const next = [...prev];
          next[index] = updatedJob;
          return next;
        });
      });
    } finally {
      processingJobs.current.delete(jobId);
    }
  }, []);
  
  const startJob = useCallback((
    type: JobType,
    sessionId: string,
    sessionTitle: string,
    config: ExportJob["config"]
  ) => {
    const job = createJob(type, sessionId, sessionTitle, config);
    setJobs(prev => [job, ...prev]);
    setCurrentJobId(job.id);
    
    // Start processing
    processJob(job.id);
    
    return job;
  }, [processJob]);
  
  const handleCancelJob = useCallback((jobId: string) => {
    cancelJobFn(jobId);
    setJobs(loadJobs());
    if (currentJobId === jobId) {
      setCurrentJobId(null);
    }
  }, [currentJobId]);
  
  const handleRetryJob = useCallback((jobId: string) => {
    const job = retryJobFn(jobId);
    if (job) {
      setJobs(loadJobs());
      setCurrentJobId(job.id);
      processJob(job.id);
    }
  }, [processJob]);
  
  const handleDeleteJob = useCallback((jobId: string) => {
    deleteJobFn(jobId);
    setJobs(loadJobs());
    if (currentJobId === jobId) {
      setCurrentJobId(null);
    }
  }, [currentJobId]);
  
  const activeCount = jobs.filter(j => j.status === "pending" || j.status === "processing").length;
  
  return (
    <JobsContext.Provider
      value={{
        jobs,
        activeCount,
        startJob,
        cancelJob: handleCancelJob,
        retryJob: handleRetryJob,
        deleteJob: handleDeleteJob,
        currentJobId,
        setCurrentJobId,
        showJobsPanel,
        setShowJobsPanel,
      }}
    >
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() {
  const context = useContext(JobsContext);
  if (!context) {
    throw new Error("useJobs must be used within a JobsProvider");
  }
  return context;
}

export function useCurrentJob() {
  const { jobs, currentJobId } = useJobs();
  return currentJobId ? jobs.find(j => j.id === currentJobId) : null;
}
