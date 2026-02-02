/**
 * Background Processing Job System
 * 
 * Manages video processing jobs (muxing, encoding, thumbnails, uploads)
 * that run in the background after capture ends.
 * 
 * Features:
 * - Persists across navigation and page refresh
 * - Stage-based progress tracking
 * - Robust error handling with retry support
 */

export type ProcessingStatus = 
  | "queued"           // Waiting to start
  | "processing"       // Currently processing
  | "uploading"        // Uploading to storage
  | "waiting"          // Waiting for external dependency (e.g., source video)
  | "completed"        // Successfully finished
  | "failed"           // Error occurred
  | "needs_attention"  // Stalled or requires user action (e.g., timeout)
  | "cancelled";       // User cancelled

export interface ProcessingStage {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "failed";
  progress?: number; // 0-100 for stages with granular progress
}

export interface ProcessingJob {
  id: string;                    // jobId (uuid)
  sessionId: string;             // recordingId
  sessionTitle: string;
  status: ProcessingStatus;
  progress: number;              // 0-100
  step: string | null;           // "Preparing", "Encoding", "Uploading", "Finalizing"
  
  // Stage tracking (internal)
  stages: ProcessingStage[];
  currentStageIndex: number;
  
  // Data references (stored separately to avoid localStorage bloat)
  blobKey?: string;              // IndexedDB key for the blob
  thumbnailKey?: string;         // IndexedDB key for thumbnail
  mimeType: string;
  fileExt: string;
  duration: number;              // seconds
  blobSize: number;              // bytes
  
  // Capture config (for metadata)
  hasCam: boolean;
  hasMic: boolean;
  hasSystemAudio: boolean;
  hasGameAudio?: boolean;                      // Whether game/system audio was actually captured
  audioMixSettings?: Record<string, number>;   // Applied audio mixing settings
  
  // User info
  userId?: string;
  
  // Results
  localSaveSuccess?: boolean;
  cloudUploadSuccess?: boolean;
  videoAssetId?: string;
  errorMessage: string | null;   // nullable error message
  outputReady: boolean;          // true when video is playable in detail view
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  
  // Retry
  retryCount: number;
  maxRetries: number;
}

const STORAGE_KEY = "vantage_processing_jobs";
const BLOB_STORE_NAME = "processing_blobs";
const DB_NAME = "vantage_processing";
const DB_VERSION = 1;
const MAX_COMPLETED_JOBS = 10;
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

// Default processing stages
const PROCESSING_STAGES: Omit<ProcessingStage, "status">[] = [
  { id: "validate", label: "Validating" },
  { id: "save_local", label: "Saving locally" },
  { id: "generate_thumbnail", label: "Generating thumbnail" },
  { id: "upload", label: "Uploading to cloud" },
  { id: "finalize", label: "Finalizing" },
];

// ============= IndexedDB for Blob Storage =============

let dbPromise: Promise<IDBDatabase> | null = null;

function openBlobDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error("[ProcessingJobs] Failed to open blob DB:", request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(BLOB_STORE_NAME)) {
        db.createObjectStore(BLOB_STORE_NAME, { keyPath: "id" });
        if (import.meta.env.DEV) {
          console.log("[ProcessingJobs] Created blob store");
        }
      }
    };
  });
  
  return dbPromise;
}

/**
 * Store a blob for processing (avoids localStorage size limits)
 */
export async function storeProcessingBlob(
  jobId: string,
  blob: Blob,
  thumbnailBlob?: Blob | null
): Promise<{ blobKey: string; thumbnailKey?: string }> {
  const db = await openBlobDB();
  
  const blobKey = `blob_${jobId}`;
  const thumbnailKey = thumbnailBlob ? `thumb_${jobId}` : undefined;
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE_NAME, "readwrite");
    const store = tx.objectStore(BLOB_STORE_NAME);
    
    store.put({ id: blobKey, blob });
    if (thumbnailBlob && thumbnailKey) {
      store.put({ id: thumbnailKey, blob: thumbnailBlob });
    }
    
    tx.oncomplete = () => resolve({ blobKey, thumbnailKey });
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve a stored blob
 */
export async function getProcessingBlob(key: string): Promise<Blob | null> {
  const db = await openBlobDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE_NAME, "readonly");
    const store = tx.objectStore(BLOB_STORE_NAME);
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result?.blob || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete stored blobs for a job
 */
export async function deleteProcessingBlobs(jobId: string): Promise<void> {
  const db = await openBlobDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE_NAME, "readwrite");
    const store = tx.objectStore(BLOB_STORE_NAME);
    
    store.delete(`blob_${jobId}`);
    store.delete(`thumb_${jobId}`);
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============= Job Management =============

/**
 * Load jobs from localStorage
 */
export function loadProcessingJobs(): ProcessingJob[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const jobs = JSON.parse(stored) as ProcessingJob[];
    const now = Date.now();
    
    // Prune completed jobs older than 24 hours
    const pruned = jobs.filter(job => {
      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
        const completedTime = job.completedAt ? new Date(job.completedAt).getTime() : 0;
        if (now - completedTime > PRUNE_AFTER_MS) {
          // Also clean up blobs
          deleteProcessingBlobs(job.id).catch(() => {});
          return false;
        }
      }
      return true;
    });
    
    // Save pruned list if we removed any
    if (pruned.length < jobs.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    }
    
    return pruned;
  } catch (error) {
    console.error("[ProcessingJobs] Failed to load:", error);
    return [];
  }
}

/**
 * Save jobs to localStorage
 */
export function saveProcessingJobs(jobs: ProcessingJob[]): void {
  try {
    // Keep active + recent completed (not yet pruned)
    const active = jobs.filter(j => 
      j.status === "queued" || j.status === "processing" || j.status === "uploading"
    );
    const completed = jobs
      .filter(j => j.status === "completed" || j.status === "failed" || j.status === "cancelled")
      .slice(0, MAX_COMPLETED_JOBS);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...active, ...completed]));
  } catch (error) {
    console.error("[ProcessingJobs] Failed to save:", error);
  }
}

/**
 * Generate unique job ID
 */
function generateJobId(): string {
  return `proc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new processing job
 */
export function createProcessingJob(params: {
  sessionId: string;
  sessionTitle: string;
  mimeType: string;
  fileExt: string;
  duration: number;
  blobSize: number;
  hasCam: boolean;
  hasMic: boolean;
  hasSystemAudio: boolean;
  hasGameAudio?: boolean;
  audioMixSettings?: Record<string, number>;
  userId?: string;
}): ProcessingJob {
  const now = new Date().toISOString();
  const job: ProcessingJob = {
    id: generateJobId(),
    sessionId: params.sessionId,
    sessionTitle: params.sessionTitle,
    status: "queued",
    progress: 0,
    step: "Preparing",
    stages: PROCESSING_STAGES.map(s => ({ ...s, status: "pending" as const })),
    currentStageIndex: -1,
    mimeType: params.mimeType,
    fileExt: params.fileExt,
    duration: params.duration,
    blobSize: params.blobSize,
    hasCam: params.hasCam,
    hasMic: params.hasMic,
    hasSystemAudio: params.hasSystemAudio,
    hasGameAudio: params.hasGameAudio,
    audioMixSettings: params.audioMixSettings,
    userId: params.userId,
    errorMessage: null,
    outputReady: false,
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    maxRetries: 3,
  };
  
  const jobs = loadProcessingJobs();
  jobs.unshift(job);
  saveProcessingJobs(jobs);
  
  return job;
}

/**
 * Update a job
 */
export function updateProcessingJob(
  jobId: string,
  updates: Partial<ProcessingJob>
): ProcessingJob | null {
  const jobs = loadProcessingJobs();
  const index = jobs.findIndex(j => j.id === jobId);
  
  if (index === -1) return null;
  
  const job = { ...jobs[index], ...updates, updatedAt: new Date().toISOString() };
  
  // Update stage statuses based on currentStageIndex
  if (updates.currentStageIndex !== undefined) {
    job.stages = job.stages.map((stage, i) => {
      if (i < updates.currentStageIndex!) {
        return { ...stage, status: "completed" as const };
      } else if (i === updates.currentStageIndex!) {
        return { ...stage, status: "active" as const };
      } else {
        return { ...stage, status: "pending" as const };
      }
    });
    
    // Update step label based on current stage
    const currentStage = job.stages[updates.currentStageIndex];
    if (currentStage) {
      job.step = currentStage.label;
    }
    
    // Update progress (0-100 based on stages)
    job.progress = Math.round(((updates.currentStageIndex + 1) / job.stages.length) * 100);
  }
  
  // Mark all stages complete on success
  if (updates.status === "completed") {
    job.stages = job.stages.map(s => ({ ...s, status: "completed" as const }));
    job.progress = 100;
    job.step = "Complete";
    job.outputReady = true;
  }
  
  // Mark current stage failed on error
  if (updates.status === "failed" && job.currentStageIndex >= 0) {
    job.stages[job.currentStageIndex] = {
      ...job.stages[job.currentStageIndex],
      status: "failed",
    };
    job.step = "Failed";
  }
  
  jobs[index] = job;
  saveProcessingJobs(jobs);
  
  return job;
}

/**
 * Get a single job
 */
export function getProcessingJob(jobId: string): ProcessingJob | null {
  const jobs = loadProcessingJobs();
  return jobs.find(j => j.id === jobId) || null;
}

/**
 * Cancel a job
 */
export function cancelProcessingJob(jobId: string): boolean {
  const job = getProcessingJob(jobId);
  if (!job) return false;
  
  updateProcessingJob(jobId, {
    status: "cancelled",
    completedAt: new Date().toISOString(),
  });
  
  // Clean up blobs
  deleteProcessingBlobs(jobId).catch(console.error);
  
  return true;
}

/**
 * Retry a failed job
 */
export function retryProcessingJob(jobId: string): ProcessingJob | null {
  const job = getProcessingJob(jobId);
  if (!job || job.status !== "failed") return null;
  if (job.retryCount >= job.maxRetries) return null;
  
  return updateProcessingJob(jobId, {
    status: "queued",
    progress: 0,
    step: "Preparing",
    retryCount: job.retryCount + 1,
    errorMessage: null,
    outputReady: false,
    completedAt: undefined,
    currentStageIndex: -1,
    stages: PROCESSING_STAGES.map(s => ({ ...s, status: "pending" as const })),
  });
}

/**
 * Delete a job and its blobs
 */
export async function deleteProcessingJob(jobId: string): Promise<boolean> {
  const jobs = loadProcessingJobs();
  const filtered = jobs.filter(j => j.id !== jobId);
  
  if (filtered.length === jobs.length) return false;
  
  saveProcessingJobs(filtered);
  await deleteProcessingBlobs(jobId);
  
  return true;
}

/**
 * Get active jobs count
 */
export function getActiveProcessingCount(): number {
  const jobs = loadProcessingJobs();
  return jobs.filter(j => 
    j.status === "queued" || j.status === "processing" || j.status === "uploading"
  ).length;
}

/**
 * Dismiss a completed/failed job from the list
 */
export function dismissProcessingJob(jobId: string): void {
  const jobs = loadProcessingJobs();
  const filtered = jobs.filter(j => j.id !== jobId);
  saveProcessingJobs(filtered);
}
