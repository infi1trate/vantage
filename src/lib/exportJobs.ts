/**
 * Export Job System
 * Manages export/publish jobs with localStorage persistence
 * Structured for future API sync
 */

export type JobType = "desktop_export" | "platform_publish" | "community_post";
export type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled" | "needs_manual_upload";

export interface JobStage {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "failed";
}

export interface ExportJob {
  id: string;
  type: JobType;
  status: JobStatus;
  sessionId: string;
  sessionTitle: string;
  
  // Job configuration
  config: {
    preset?: string;
    format?: string;
    platform?: string;
    visibility?: string;
    [key: string]: any;
  };
  
  // Progress tracking (stage-based, not fake %)
  stages: JobStage[];
  currentStageIndex: number;
  
  // Results
  outputUrl?: string;
  outputPath?: string;
  platformUrl?: string;
  shareLink?: string;
  errorMessage?: string;
  
  // Timestamps
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  
  // Retry info
  retryCount: number;
  maxRetries: number;
}

const STORAGE_KEY = "vantage_export_jobs";
const MAX_COMPLETED_JOBS = 20;

// Default stages for each job type
const DEFAULT_STAGES: Record<JobType, Omit<JobStage, "status">[]> = {
  desktop_export: [
    { id: "prepare", label: "Preparing file" },
    { id: "download", label: "Downloading" },
  ],
  platform_publish: [
    { id: "prepare", label: "Preparing" },
    { id: "render", label: "Rendering video" },
    { id: "upload", label: "Uploading" },
    { id: "process", label: "Processing on platform" },
  ],
  community_post: [
    { id: "prepare", label: "Preparing" },
    { id: "upload", label: "Uploading" },
    { id: "publish", label: "Publishing" },
  ],
};

/**
 * Load jobs from localStorage
 */
export function loadJobs(): ExportJob[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const jobs = JSON.parse(stored) as ExportJob[];
    // Sort by creation date, newest first
    return jobs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("[ExportJobs] Failed to load jobs:", error);
    return [];
  }
}

/**
 * Save jobs to localStorage
 */
export function saveJobs(jobs: ExportJob[]): void {
  try {
    // Keep only recent completed jobs to avoid storage bloat
    const activeJobs = jobs.filter(j => j.status === "processing" || j.status === "pending");
    const completedJobs = jobs
      .filter(j => j.status === "completed" || j.status === "failed" || j.status === "cancelled")
      .slice(0, MAX_COMPLETED_JOBS);
    
    const toSave = [...activeJobs, ...completedJobs];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (error) {
    console.error("[ExportJobs] Failed to save jobs:", error);
  }
}

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new export job
 */
export function createJob(
  type: JobType,
  sessionId: string,
  sessionTitle: string,
  config: ExportJob["config"]
): ExportJob {
  const stages = DEFAULT_STAGES[type].map(s => ({
    ...s,
    status: "pending" as const,
  }));
  
  const job: ExportJob = {
    id: generateJobId(),
    type,
    status: "pending",
    sessionId,
    sessionTitle,
    config,
    stages,
    currentStageIndex: -1,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 3,
  };
  
  // Persist
  const jobs = loadJobs();
  jobs.unshift(job);
  saveJobs(jobs);
  
  return job;
}

/**
 * Update a job's status and stages
 */
export function updateJob(
  jobId: string,
  updates: Partial<Pick<ExportJob, "status" | "currentStageIndex" | "outputUrl" | "outputPath" | "platformUrl" | "shareLink" | "errorMessage" | "startedAt" | "completedAt">>
): ExportJob | null {
  const jobs = loadJobs();
  const index = jobs.findIndex(j => j.id === jobId);
  
  if (index === -1) return null;
  
  const job = jobs[index];
  
  // Update basic fields
  Object.assign(job, updates);
  
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
  }
  
  // Mark all stages as completed when job completes
  if (updates.status === "completed") {
    job.stages = job.stages.map(s => ({ ...s, status: "completed" as const }));
  }
  
  // Mark current stage as failed when job fails
  if (updates.status === "failed" && job.currentStageIndex >= 0) {
    job.stages[job.currentStageIndex] = {
      ...job.stages[job.currentStageIndex],
      status: "failed",
    };
  }
  
  jobs[index] = job;
  saveJobs(jobs);
  
  return job;
}

/**
 * Cancel a job
 */
export function cancelJob(jobId: string): boolean {
  const jobs = loadJobs();
  const index = jobs.findIndex(j => j.id === jobId);
  
  if (index === -1) return false;
  
  jobs[index].status = "cancelled";
  jobs[index].completedAt = new Date().toISOString();
  saveJobs(jobs);
  
  return true;
}

/**
 * Retry a failed job
 */
export function retryJob(jobId: string): ExportJob | null {
  const jobs = loadJobs();
  const job = jobs.find(j => j.id === jobId);
  
  if (!job || job.status !== "failed") return null;
  if (job.retryCount >= job.maxRetries) return null;
  
  // Reset job for retry
  job.status = "pending";
  job.retryCount += 1;
  job.errorMessage = undefined;
  job.completedAt = undefined;
  job.stages = job.stages.map(s => ({ ...s, status: "pending" as const }));
  job.currentStageIndex = -1;
  
  saveJobs(jobs);
  return job;
}

/**
 * Delete a job
 */
export function deleteJob(jobId: string): boolean {
  const jobs = loadJobs();
  const filtered = jobs.filter(j => j.id !== jobId);
  
  if (filtered.length === jobs.length) return false;
  
  saveJobs(filtered);
  return true;
}

/**
 * Get active jobs count (pending + processing)
 */
export function getActiveJobsCount(): number {
  const jobs = loadJobs();
  return jobs.filter(j => j.status === "pending" || j.status === "processing").length;
}

/**
 * Get a single job by ID
 */
export function getJob(jobId: string): ExportJob | null {
  const jobs = loadJobs();
  return jobs.find(j => j.id === jobId) || null;
}

/**
 * Simulate job processing (for demo/local mode)
 * For desktop_export with fast export, this completes quickly
 * In production, this would be replaced by actual backend processing
 */
export async function simulateJobProcessing(
  jobId: string,
  onProgress: (job: ExportJob) => void
): Promise<ExportJob | null> {
  let job = getJob(jobId);
  if (!job) return null;
  
  // Start processing
  job = updateJob(jobId, {
    status: "processing",
    startedAt: new Date().toISOString(),
    currentStageIndex: 0,
  });
  if (!job) return null;
  onProgress(job);
  
  // For desktop fast export, complete quickly (file download is handled separately)
  const isFastExport = job.type === "desktop_export" && job.config.isFastExport;
  
  // Process each stage
  for (let i = 0; i < job.stages.length; i++) {
    // Fast export stages are quick, others take longer
    const duration = isFastExport 
      ? 300 + Math.random() * 200  // 300-500ms for fast export
      : 1500 + Math.random() * 1500; // 1.5-3s for other jobs
    
    await new Promise(resolve => setTimeout(resolve, duration));
    
    // Check if job was cancelled
    const currentJob = getJob(jobId);
    if (!currentJob || currentJob.status === "cancelled") {
      return currentJob;
    }
    
    // Move to next stage
    if (i < job.stages.length - 1) {
      job = updateJob(jobId, { currentStageIndex: i + 1 });
      if (job) onProgress(job);
    }
  }
  
  // Complete the job
  const result: Partial<ExportJob> = {
    completedAt: new Date().toISOString(),
  };
  
  // Check if this is a manual upload job
  const requiresManualUpload = job.type === "platform_publish" && job.config.requiresManualUpload;
  
  if (requiresManualUpload) {
    // Set status to needs_manual_upload instead of completed
    result.status = "needs_manual_upload";
    result.platformUrl = PLATFORMS[job.config.platform as PlatformId]?.uploadPageUrl;
  } else {
    result.status = "completed";
  }
  
  // Add outputs based on job type
  if (job.type === "desktop_export") {
    const ext = job.config.format || "mp4";
    const safeTitle = job.sessionTitle.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
    result.outputPath = `~/Downloads/Vantage_${safeTitle}.${ext}`;
  } else if (job.type === "community_post") {
    result.shareLink = `${window.location.origin}/session/${job.sessionId}`;
  } else if (job.type === "platform_publish" && !requiresManualUpload) {
    result.platformUrl = `https://${job.config.platform}.com/watch/${Math.random().toString(36).substring(2, 11)}`;
  }
  
  job = updateJob(jobId, result);
  if (job) onProgress(job);
  
  return job;
}

// Import PLATFORMS for manual upload URL lookup
import { PLATFORMS, PlatformId } from "@/lib/platformConnections";
