/**
 * Processing Jobs Context
 * 
 * Manages background video processing jobs with persistence.
 * Jobs survive navigation and page refresh.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  ProcessingJob,
  ProcessingStatus,
  loadProcessingJobs,
  createProcessingJob,
  updateProcessingJob,
  getProcessingJob,
  cancelProcessingJob as cancelJobFn,
  retryProcessingJob as retryJobFn,
  deleteProcessingJob as deleteJobFn,
  dismissProcessingJob,
  storeProcessingBlob,
  getProcessingBlob,
  deleteProcessingBlobs,
} from "@/lib/processingJobs";
import { saveLocalSession, LocalSession } from "@/lib/localSessionStorage";
import { supabase } from "@/integrations/supabase/client";

interface ProcessingContextValue {
  jobs: ProcessingJob[];
  activeJobs: ProcessingJob[];
  completedJobs: ProcessingJob[];
  activeCount: number;
  
  // Queue a new processing job
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
  }) => Promise<ProcessingJob>;
  
  // Actions
  cancelJob: (jobId: string) => void;
  retryJob: (jobId: string) => void;
  dismissJob: (jobId: string) => void;
  
  // UI state
  isFooterExpanded: boolean;
  setFooterExpanded: (expanded: boolean) => void;
  isFooterVisible: boolean;
}

const ProcessingContext = createContext<ProcessingContextValue | null>(null);

// Processing function - runs the actual work
async function processJob(
  job: ProcessingJob,
  onUpdate: (job: ProcessingJob) => void
): Promise<void> {
  let currentJob = job;
  
  const updateStage = (stageIndex: number, updates?: Partial<ProcessingJob>) => {
    currentJob = updateProcessingJob(job.id, {
      currentStageIndex: stageIndex,
      status: stageIndex < job.stages.length - 1 ? "processing" : "uploading",
      ...updates,
    })!;
    onUpdate(currentJob);
  };
  
  try {
    // Stage 0: Validate
    updateStage(0, { status: "processing", startedAt: new Date().toISOString() });
    
    const blob = await getProcessingBlob(`blob_${job.id}`);
    const thumbnailBlob = await getProcessingBlob(`thumb_${job.id}`);
    
    if (!blob) {
      throw new Error("Recording data not found");
    }
    
    // Stage 1: Save locally
    updateStage(1);
    
    const localSession: LocalSession = {
      id: job.sessionId,
      title: job.sessionTitle,
      gameName: null,
      createdAt: job.createdAt,
      duration: job.duration,
      hasCam: job.hasCam,
      hasMic: job.hasMic,
      hasSystemAudio: job.hasSystemAudio,
      visibility: "private",
      thumbnailDataUrl: null,
      blobSize: blob.size,
      mimeType: job.mimeType,
      fileExt: job.fileExt as "mp4" | "webm",
      durationMs: job.duration * 1000,
      status: "stored_local",
      totalBytes: blob.size,
    };
    
    const saveResult = await saveLocalSession(localSession, blob, thumbnailBlob);
    
    currentJob = updateProcessingJob(job.id, {
      localSaveSuccess: saveResult.success,
    })!;
    onUpdate(currentJob);
    
    // Stage 2: Generate/verify thumbnail
    updateStage(2);
    await new Promise(r => setTimeout(r, 200)); // Brief pause for UI
    
    // Stage 3: Upload to cloud (if user is logged in)
    updateStage(3, { status: "uploading" });
    
    if (job.userId) {
      try {
        const compositePath = `${job.userId}/${job.sessionId}/gameplay.webm`;
        
        const { error: uploadError } = await supabase.storage
          .from("video-assets")
          .upload(compositePath, blob, { 
            contentType: job.mimeType,
            upsert: true,
          });
        
        if (!uploadError) {
          // Create signed URL
          const { data: urlData } = await supabase.storage
            .from("video-assets")
            .createSignedUrl(compositePath, 86400);
          
          if (urlData) {
            // Create video asset record
            const { data: assetData } = await supabase
              .from("video_assets")
              .insert({
                session_id: job.sessionId,
                user_id: job.userId,
                asset_type: "gameplay",
                storage_url: urlData.signedUrl,
                storage_path: compositePath,
                duration_ms: job.duration * 1000,
                status: "ready",
                processing_progress: 100,
                mime_type: job.mimeType,
                file_size_bytes: blob.size,
              })
              .select()
              .single();
            
            if (assetData) {
              currentJob = updateProcessingJob(job.id, {
                cloudUploadSuccess: true,
                videoAssetId: assetData.id,
              })!;
              onUpdate(currentJob);
            }
            
            // Update session status
            await supabase
              .from("capture_sessions")
              .update({
                status: "ready",
                duration_seconds: job.duration,
              })
              .eq("id", job.sessionId);
          }
        }
      } catch (uploadError) {
        // Log but don't fail - local save succeeded
        if (import.meta.env.DEV) {
          console.warn("[Processing] Cloud upload failed:", uploadError);
        }
      }
    }
    
    // Stage 4: Finalize
    updateStage(4);
    
    // Clean up stored blobs
    await deleteProcessingBlobs(job.id);
    
    // Complete
    currentJob = updateProcessingJob(job.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
    })!;
    onUpdate(currentJob);
    
  } catch (error: any) {
    console.error("[Processing] Job failed:", error);
    
    currentJob = updateProcessingJob(job.id, {
      status: "failed",
      errorMessage: error.message || "Processing failed",
      completedAt: new Date().toISOString(),
    })!;
    onUpdate(currentJob);
  }
}

export function ProcessingProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [isFooterExpanded, setFooterExpanded] = useState(false);
  
  // Track which jobs are being processed
  const processingRef = useRef<Set<string>>(new Set());
  
  // Load jobs on mount
  useEffect(() => {
    const stored = loadProcessingJobs();
    setJobs(stored);
    
    // Resume any queued/processing jobs
    stored
      .filter(j => j.status === "queued" || j.status === "processing" || j.status === "uploading")
      .forEach(job => {
        if (!processingRef.current.has(job.id)) {
          startProcessing(job);
        }
      });
  }, []);
  
  // Sync from storage periodically (multi-tab support)
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(loadProcessingJobs());
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  const startProcessing = useCallback((job: ProcessingJob) => {
    if (processingRef.current.has(job.id)) return;
    processingRef.current.add(job.id);
    
    processJob(job, (updated) => {
      setJobs(prev => {
        const index = prev.findIndex(j => j.id === updated.id);
        if (index === -1) return [...prev, updated];
        const next = [...prev];
        next[index] = updated;
        return next;
      });
    }).finally(() => {
      processingRef.current.delete(job.id);
    });
  }, []);
  
  const queueProcessing = useCallback(async (params: {
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
  }): Promise<ProcessingJob> => {
    // Create job
    const job = createProcessingJob({
      sessionId: params.sessionId,
      sessionTitle: params.sessionTitle,
      mimeType: params.mimeType,
      fileExt: params.fileExt,
      duration: params.duration,
      blobSize: params.blob.size,
      hasCam: params.hasCam,
      hasMic: params.hasMic,
      hasSystemAudio: params.hasSystemAudio,
      userId: params.userId,
    });
    
    // Store blobs in IndexedDB
    const { blobKey, thumbnailKey } = await storeProcessingBlob(
      job.id,
      params.blob,
      params.thumbnailBlob
    );
    
    // Update job with blob keys
    const updatedJob = updateProcessingJob(job.id, { blobKey, thumbnailKey })!;
    
    setJobs(prev => [updatedJob, ...prev.filter(j => j.id !== job.id)]);
    
    // Start processing
    startProcessing(updatedJob);
    
    return updatedJob;
  }, [startProcessing]);
  
  const handleCancel = useCallback((jobId: string) => {
    cancelJobFn(jobId);
    setJobs(loadProcessingJobs());
  }, []);
  
  const handleRetry = useCallback((jobId: string) => {
    const job = retryJobFn(jobId);
    if (job) {
      setJobs(loadProcessingJobs());
      startProcessing(job);
    }
  }, [startProcessing]);
  
  const handleDismiss = useCallback((jobId: string) => {
    dismissProcessingJob(jobId);
    setJobs(loadProcessingJobs());
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
