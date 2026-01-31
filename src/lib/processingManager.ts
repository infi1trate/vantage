/**
 * Background Processing Manager
 * 
 * Singleton service that manages video processing jobs with:
 * - Sequential processing (maxConcurrent = 1 by default)
 * - Capture-aware pausing (pauses heavy work during active recording)
 * - Camera preview + CPU-aware pausing
 * - Progress milestones with throttled UI updates (max 4/sec)
 * - Retry with exponential backoff
 * - Survives navigation, handles reload gracefully
 * - Telemetry for key milestones
 */

import {
  ProcessingJob,
  ProcessingStatus,
  loadProcessingJobs,
  createProcessingJob,
  updateProcessingJob,
  getProcessingJob,
  cancelProcessingJob,
  retryProcessingJob,
  deleteProcessingBlobs,
  storeProcessingBlob,
  getProcessingBlob,
} from "./processingJobs";
import { saveLocalSession, LocalSession } from "./localSessionStorage";
import { supabase } from "@/integrations/supabase/client";
import {
  trackJobCreated,
  trackLocalSaveComplete,
  trackThumbnailReady,
  trackCloudUploadStart,
  trackCloudUploadEnd,
  trackJobCompleted,
  createThrottledUpdater,
  cleanupThrottle,
  shouldPauseHeavyProcessing,
  isCameraPreview,
} from "./processingTelemetry";

// Progress milestones by step
const PROGRESS_MILESTONES = {
  preparing: 10,
  encoding: 40,
  uploading: 80,
  finalizing: 100,
} as const;

// Step labels for UI
const STEP_LABELS = {
  preparing: "Preparing",
  validating: "Validating",
  saving: "Saving locally",
  encoding: "Encoding",
  uploading: "Uploading to cloud",
  finalizing: "Finalizing",
} as const;

type JobUpdateCallback = (job: ProcessingJob) => void;

interface QueuedJob {
  job: ProcessingJob;
  blob: Blob;
  thumbnailBlob?: Blob | null;
  thumbnailDataUrl?: string | null;
}

class ProcessingManager {
  private static instance: ProcessingManager | null = null;
  
  // Queue and state
  private queue: QueuedJob[] = [];
  private activeJobs: Map<string, AbortController> = new Map();
  private isRunning = false;
  private processingLoopPromise: Promise<void> | null = null;
  
  // Configuration
  private maxConcurrent = 1;
  private retryDelayMs = 2000;
  private maxRetryDelay = 30000;
  
  // Callbacks
  private updateCallbacks: Set<JobUpdateCallback> = new Set();
  
  // Capture detection
  private isCapturing = false;
  
  private constructor() {
    // Private constructor for singleton
  }
  
  static getInstance(): ProcessingManager {
    if (!ProcessingManager.instance) {
      ProcessingManager.instance = new ProcessingManager();
    }
    return ProcessingManager.instance;
  }
  
  /**
   * Start the processing loop on app load
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    if (import.meta.env.DEV) {
      console.log("[ProcessingManager] Started");
    }
    
    // Restore interrupted jobs from previous session
    this.restoreInterruptedJobs();
    
    // Start the processing loop
    this.processingLoopPromise = this.runProcessingLoop();
  }
  
  /**
   * Stop the processing loop
   */
  stop(): void {
    this.isRunning = false;
    
    // Cancel all active jobs
    this.activeJobs.forEach((controller, jobId) => {
      controller.abort();
      updateProcessingJob(jobId, {
        status: "cancelled",
        step: "Cancelled",
        completedAt: new Date().toISOString(),
      });
    });
    this.activeJobs.clear();
    
    if (import.meta.env.DEV) {
      console.log("[ProcessingManager] Stopped");
    }
  }
  
  /**
   * Enqueue a new job for processing
   */
  enqueue(params: {
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
    hasGameAudio?: boolean;
    audioMixSettings?: Record<string, number> | null;
    userId?: string;
    gameName?: string | null;
  }): ProcessingJob {
    // Create job record immediately (sync)
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
      hasGameAudio: params.hasGameAudio,
      audioMixSettings: params.audioMixSettings || undefined,
      userId: params.userId,
    });
    
    // Add to in-memory queue with blob reference
    this.queue.push({
      job,
      blob: params.blob,
      thumbnailBlob: params.thumbnailBlob,
      thumbnailDataUrl: params.thumbnailDataUrl,
    });
    
    this.notifyUpdate(job);
    
    if (import.meta.env.DEV) {
      console.log("[ProcessingManager] Enqueued job:", job.id);
    }
    
    // Wake up the processing loop
    this.wakeProcessingLoop();
    
    return job;
  }
  
  /**
   * Cancel a job if possible
   */
  cancel(jobId: string): boolean {
    // Check if it's in the queue (not yet started)
    const queueIndex = this.queue.findIndex(q => q.job.id === jobId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
      const updated = updateProcessingJob(jobId, {
        status: "cancelled",
        step: "Cancelled",
        completedAt: new Date().toISOString(),
      });
      if (updated) this.notifyUpdate(updated);
      deleteProcessingBlobs(jobId).catch(() => {});
      return true;
    }
    
    // Check if it's actively processing
    const controller = this.activeJobs.get(jobId);
    if (controller) {
      controller.abort();
      this.activeJobs.delete(jobId);
      const updated = updateProcessingJob(jobId, {
        status: "cancelled",
        step: "Cancelled",
        completedAt: new Date().toISOString(),
      });
      if (updated) this.notifyUpdate(updated);
      deleteProcessingBlobs(jobId).catch(() => {});
      return true;
    }
    
    // Already completed or not found
    return cancelProcessingJob(jobId);
  }
  
  /**
   * Retry a failed job
   */
  retry(jobId: string): ProcessingJob | null {
    const retriedJob = retryProcessingJob(jobId);
    if (!retriedJob) return null;
    
    // Check if we have the blob in IndexedDB
    this.checkAndRestoreJob(retriedJob);
    
    this.notifyUpdate(retriedJob);
    this.wakeProcessingLoop();
    
    return retriedJob;
  }
  
  /**
   * Set capture state - pauses heavy processing during recording
   */
  setCapturing(isCapturing: boolean): void {
    this.isCapturing = isCapturing;
    
    if (import.meta.env.DEV) {
      console.log("[ProcessingManager] Capture state:", isCapturing ? "ACTIVE" : "INACTIVE");
    }
  }
  
  /**
   * Subscribe to job updates
   */
  subscribe(callback: JobUpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }
  
  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue.length + this.activeJobs.size;
  }
  
  /**
   * Get all jobs (from storage)
   */
  getJobs(): ProcessingJob[] {
    return loadProcessingJobs();
  }
  
  // ============= Private Methods =============
  
  private notifyUpdate(job: ProcessingJob): void {
    this.updateCallbacks.forEach(cb => {
      try {
        cb(job);
      } catch (e) {
        console.error("[ProcessingManager] Callback error:", e);
      }
    });
  }
  
  private wakeProcessingLoop(): void {
    // The loop will naturally pick up new jobs
  }
  
  private async runProcessingLoop(): Promise<void> {
    while (this.isRunning) {
      // Wait if capturing (don't do heavy processing during recording)
      if (this.isCapturing) {
        await this.sleep(1000);
        continue;
      }
      
      // Wait if camera preview active AND CPU is high
      if (shouldPauseHeavyProcessing()) {
        if (import.meta.env.DEV) {
          console.log("[ProcessingManager] Pausing for camera preview + high CPU");
        }
        await this.sleep(500);
        continue;
      }
      
      // Check if we can process more jobs
      if (this.activeJobs.size >= this.maxConcurrent) {
        await this.sleep(500);
        continue;
      }
      
      // Get next job from queue
      const queuedJob = this.queue.shift();
      if (!queuedJob) {
        // No jobs in queue, check for persisted jobs to restore
        const persistedJob = this.findNextPersistedJob();
        if (persistedJob) {
          await this.processPersistedJob(persistedJob);
        } else {
          await this.sleep(1000);
        }
        continue;
      }
      
      // Process the job
      this.processQueuedJob(queuedJob);
    }
  }
  
  private findNextPersistedJob(): ProcessingJob | null {
    const jobs = loadProcessingJobs();
    return jobs.find(j => 
      (j.status === "queued" || j.status === "processing" || j.status === "uploading") &&
      !this.activeJobs.has(j.id) &&
      !this.queue.some(q => q.job.id === j.id)
    ) || null;
  }
  
  private async processPersistedJob(job: ProcessingJob): Promise<void> {
    // Try to restore blob from IndexedDB
    const blobKey = job.blobKey || `blob_${job.id}`;
    const blob = await getProcessingBlob(blobKey).catch(() => null);
    
    if (!blob) {
      // Blob was lost (page reload before IndexedDB write completed)
      const updated = updateProcessingJob(job.id, {
        status: "failed",
        errorMessage: "Processing was interrupted. The recording data was lost. Please record again.",
        step: "Failed",
        completedAt: new Date().toISOString(),
      });
      if (updated) this.notifyUpdate(updated);
      return;
    }
    
    const thumbnailBlob = job.thumbnailKey 
      ? await getProcessingBlob(job.thumbnailKey).catch(() => null)
      : null;
    
    // Add to queue and process
    this.queue.push({ job, blob, thumbnailBlob });
  }
  
  private async checkAndRestoreJob(job: ProcessingJob): Promise<void> {
    const blobKey = job.blobKey || `blob_${job.id}`;
    const blob = await getProcessingBlob(blobKey).catch(() => null);
    
    if (blob) {
      const thumbnailBlob = job.thumbnailKey 
        ? await getProcessingBlob(job.thumbnailKey).catch(() => null)
        : null;
      this.queue.push({ job, blob, thumbnailBlob });
    } else {
      // Cannot retry - blob is gone
      updateProcessingJob(job.id, {
        status: "failed",
        errorMessage: "Cannot retry: recording data is no longer available. Please record again.",
        step: "Failed",
        completedAt: new Date().toISOString(),
      });
    }
  }
  
  private async processQueuedJob(queued: QueuedJob): Promise<void> {
    const { job, blob, thumbnailBlob, thumbnailDataUrl } = queued;
    const controller = new AbortController();
    this.activeJobs.set(job.id, controller);
    
    // Track job creation for telemetry
    trackJobCreated(job.id, job.sessionId);
    
    try {
      await this.executeProcessing(job, blob, thumbnailBlob, thumbnailDataUrl, controller.signal);
      trackJobCompleted(job.id, true);
    } catch (error: any) {
      if (error.name === "AbortError") {
        // Cancelled - already handled
        return;
      }
      
      console.error("[ProcessingManager] Job failed:", job.id, error);
      
      const updated = updateProcessingJob(job.id, {
        status: "failed",
        errorMessage: error.message || "Processing failed",
        step: "Failed",
        completedAt: new Date().toISOString(),
      });
      if (updated) this.notifyUpdate(updated);
      
      trackJobCompleted(job.id, false);
    } finally {
      this.activeJobs.delete(job.id);
      cleanupThrottle(job.id);
    }
  }
  
  private async executeProcessing(
    job: ProcessingJob,
    blob: Blob,
    thumbnailBlob: Blob | null | undefined,
    thumbnailDataUrl: string | null | undefined,
    signal: AbortSignal
  ): Promise<void> {
    // Create throttled progress updater (max 4 updates/sec)
    const throttledUpdate = createThrottledUpdater(job.id, (progress, step) => {
      const updated = updateProcessingJob(job.id, {
        status: progress >= 80 ? "uploading" : "processing",
        step,
        progress,
      });
      if (updated) this.notifyUpdate(updated);
    });
    
    // Non-throttled update for important state changes
    const updateProgress = (step: keyof typeof STEP_LABELS, progress: number, updates?: Partial<ProcessingJob>, force = false) => {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      
      if (force || updates) {
        // Direct update for state changes
        const updated = updateProcessingJob(job.id, {
          status: progress >= 80 ? "uploading" : "processing",
          step: STEP_LABELS[step],
          progress,
          ...updates,
        });
        if (updated) this.notifyUpdate(updated);
      } else {
        // Throttled update for progress only
        throttledUpdate(progress, STEP_LABELS[step], force);
      }
    };
    
    // Stage 1: Preparing - Store blob to IndexedDB for persistence
    updateProgress("preparing", PROGRESS_MILESTONES.preparing, { 
      startedAt: new Date().toISOString(),
      currentStageIndex: 0,
    }, true);
    
    const { blobKey, thumbnailKey } = await storeProcessingBlob(job.id, blob, thumbnailBlob);
    updateProcessingJob(job.id, { blobKey, thumbnailKey });
    
    // Track thumbnail ready
    if (thumbnailBlob || thumbnailDataUrl) {
      trackThumbnailReady(job.id);
    }
    
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    
    // Stage 2: Validating
    updateProgress("validating", 15, { currentStageIndex: 0 }, true);
    
    if (!blob || blob.size === 0) {
      throw new Error("Recording data is empty or invalid");
    }
    
    // Stage 3: Saving locally
    updateProgress("saving", 25, { currentStageIndex: 1 }, true);
    
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
      thumbnailDataUrl: thumbnailDataUrl || null,
      blobSize: blob.size,
      mimeType: job.mimeType,
      fileExt: job.fileExt as "mp4" | "webm",
      durationMs: job.duration * 1000,
      status: "stored_local",
      totalBytes: blob.size,
    };
    
    const saveResult = await saveLocalSession(localSession, blob, thumbnailBlob || null);
    
    // Track local save completion
    trackLocalSaveComplete(job.id);
    
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    
    updateProgress("encoding", PROGRESS_MILESTONES.encoding, {
      currentStageIndex: 2,
      localSaveSuccess: saveResult.success,
    }, true);
    
    // Stage 4: "Encoding" - Generate/process thumbnail
    // (We already have the thumbnail, so this is quick)
    await this.sleep(200); // Brief pause for UI smoothness
    
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    
    // Stage 5: Uploading to cloud (if user is logged in)
    updateProgress("uploading", PROGRESS_MILESTONES.uploading, { currentStageIndex: 3 }, true);
    
    let cloudUploadSuccess = false;
    let videoAssetId: string | undefined;
    
    if (job.userId) {
      trackCloudUploadStart(job.id);
      
      try {
        // Pause during active capture
        while (this.isCapturing && !signal.aborted) {
          await this.sleep(500);
        }
        
        // Also pause if camera preview active and CPU is high
        while (shouldPauseHeavyProcessing() && !signal.aborted) {
          await this.sleep(500);
        }
        
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        
        const compositePath = `${job.userId}/${job.sessionId}/gameplay.webm`;
        
        const { error: uploadError } = await supabase.storage
          .from("video-assets")
          .upload(compositePath, blob, {
            contentType: job.mimeType,
            upsert: true,
          });
        
        if (!uploadError) {
          const { data: urlData } = await supabase.storage
            .from("video-assets")
            .createSignedUrl(compositePath, 86400);
          
          if (urlData) {
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
              cloudUploadSuccess = true;
              videoAssetId = assetData.id;
            }
            
            // Update session status with audio mix metadata
            const metadata: Record<string, any> = {};
            if (job.audioMixSettings) {
              metadata.audio_mix = job.audioMixSettings;
            }
            if (job.hasGameAudio !== undefined) {
              metadata.has_game_audio = job.hasGameAudio;
            }
            
            await supabase
              .from("capture_sessions")
              .update({
                status: "ready",
                duration_seconds: job.duration,
                thumbnail_url: thumbnailDataUrl || null,
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
              })
              .eq("id", job.sessionId);
          }
        }
      } catch (uploadError) {
        // Log but don't fail - local save succeeded
        if (import.meta.env.DEV) {
          console.warn("[ProcessingManager] Cloud upload failed:", uploadError);
        }
      } finally {
        trackCloudUploadEnd(job.id);
      }
    }
    
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    
    // Stage 6: Finalizing
    updateProgress("finalizing", PROGRESS_MILESTONES.finalizing, { currentStageIndex: 4 });
    
    // Clean up stored blobs from IndexedDB (data is now in local session storage)
    await deleteProcessingBlobs(job.id);
    
    // Complete
    const completed = updateProcessingJob(job.id, {
      status: "completed",
      progress: 100,
      step: "Complete",
      outputReady: true,
      cloudUploadSuccess,
      videoAssetId,
      completedAt: new Date().toISOString(),
    });
    
    if (completed) this.notifyUpdate(completed);
    
    if (import.meta.env.DEV) {
      console.log("[ProcessingManager] Job completed:", job.id);
    }
  }
  
  private restoreInterruptedJobs(): void {
    const jobs = loadProcessingJobs();
    const interrupted = jobs.filter(j => 
      j.status === "processing" || j.status === "uploading"
    );
    
    for (const job of interrupted) {
      // Check if blob is still available
      getProcessingBlob(job.blobKey || `blob_${job.id}`)
        .then(blob => {
          if (blob) {
            // Re-queue for processing
            if (import.meta.env.DEV) {
              console.log("[ProcessingManager] Restoring interrupted job:", job.id);
            }
            // Reset to queued so it gets picked up
            updateProcessingJob(job.id, {
              status: "queued",
              step: "Preparing",
              progress: 0,
            });
          } else {
            // Blob is gone - mark as failed
            updateProcessingJob(job.id, {
              status: "failed",
              errorMessage: "Processing was interrupted. Please retry or record again.",
              step: "Failed",
              completedAt: new Date().toISOString(),
            });
          }
        })
        .catch(() => {
          updateProcessingJob(job.id, {
            status: "failed",
            errorMessage: "Processing was interrupted. Please retry or record again.",
            step: "Failed",
            completedAt: new Date().toISOString(),
          });
        });
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const processingManager = ProcessingManager.getInstance();
