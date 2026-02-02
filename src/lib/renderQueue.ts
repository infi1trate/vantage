/**
 * Render Queue System
 * 
 * Manages post-capture rendering jobs (compositing, effects baking, export).
 * Runs asynchronously with persistent progress tracking.
 * 
 * Architecture:
 * - Capture produces raw media assets (no effects applied during capture)
 * - Post-processing reads: raw assets + overlay metadata + effect events + reel packages
 * - Compositing happens only in render jobs (never during capture)
 * - Generates low-res preview quickly, then high-res final
 */

import { ProcessingJob, ProcessingStatus } from "./processingJobs";

// ============= Render Job Types =============

export type RenderJobType = 
  | "composite_reel"       // Full reel compositing with effects
  | "apply_effects"        // Apply VFX/SFX to session
  | "generate_package"     // Generate intro/outro/transitions
  | "export_video"         // Export to file
  | "export_platform";     // Export for platform upload

export type RenderStageId = 
  | "validating"
  | "loading_assets"
  | "compositing_overlays"
  | "applying_vfx"
  | "mixing_audio"
  | "generating_preview"
  | "rendering_final"
  | "encoding"
  | "uploading"
  | "finalizing";

export interface RenderStage {
  id: RenderStageId;
  label: string;
  status: "pending" | "active" | "completed" | "failed" | "skipped";
  progress: number; // 0-100 within this stage
  startedAt?: string;
  completedAt?: string;
}

export interface RenderJob {
  id: string;
  type: RenderJobType;
  status: ProcessingStatus;
  
  // Source references
  sessionId: string;
  sessionTitle: string;
  reelId?: string;
  
  // Input metadata references
  frameOverlayId?: string;
  effectEventIds?: string[];
  reelPackageConfigId?: string;
  
  // Stages with granular progress
  stages: RenderStage[];
  currentStageIndex: number;
  overallProgress: number; // 0-100
  
  // Quality settings
  outputQuality: "preview" | "standard" | "high";
  outputResolution: "720p" | "1080p" | "1440p" | "4k";
  
  // Generated outputs
  previewUrl?: string;      // Low-res preview (available quickly)
  finalUrl?: string;        // High-res final output
  downloadPath?: string;    // Local file path if downloaded
  
  // Status details
  errorMessage?: string;
  warningMessages?: string[];
  canCancel: boolean;
  
  // Timestamps
  createdAt: string;
  startedAt?: string;
  previewReadyAt?: string;
  completedAt?: string;
  
  // Retry
  retryCount: number;
  maxRetries: number;
}

// ============= Stage Definitions =============

const REEL_COMPOSITE_STAGES: Omit<RenderStage, "status" | "progress">[] = [
  { id: "validating", label: "Validating assets" },
  { id: "loading_assets", label: "Loading media" },
  { id: "compositing_overlays", label: "Compositing overlays" },
  { id: "applying_vfx", label: "Applying effects" },
  { id: "mixing_audio", label: "Mixing audio" },
  { id: "generating_preview", label: "Generating preview" },
  { id: "rendering_final", label: "Rendering final" },
  { id: "encoding", label: "Encoding" },
  { id: "finalizing", label: "Finalizing" },
];

const EFFECT_APPLICATION_STAGES: Omit<RenderStage, "status" | "progress">[] = [
  { id: "validating", label: "Validating" },
  { id: "loading_assets", label: "Loading assets" },
  { id: "applying_vfx", label: "Applying VFX" },
  { id: "mixing_audio", label: "Mixing SFX" },
  { id: "generating_preview", label: "Preview" },
  { id: "encoding", label: "Encoding" },
  { id: "finalizing", label: "Finalizing" },
];

const PACKAGE_GENERATION_STAGES: Omit<RenderStage, "status" | "progress">[] = [
  { id: "validating", label: "Analyzing content" },
  { id: "loading_assets", label: "Loading clips" },
  { id: "generating_preview", label: "Generating assets" },
  { id: "rendering_final", label: "Rendering" },
  { id: "finalizing", label: "Finalizing" },
];

const EXPORT_STAGES: Omit<RenderStage, "status" | "progress">[] = [
  { id: "validating", label: "Preparing" },
  { id: "encoding", label: "Encoding" },
  { id: "finalizing", label: "Saving file" },
];

const PLATFORM_EXPORT_STAGES: Omit<RenderStage, "status" | "progress">[] = [
  { id: "validating", label: "Preparing" },
  { id: "encoding", label: "Encoding for platform" },
  { id: "uploading", label: "Uploading" },
  { id: "finalizing", label: "Processing" },
];

function getStagesForType(type: RenderJobType): RenderStage[] {
  const templates = {
    composite_reel: REEL_COMPOSITE_STAGES,
    apply_effects: EFFECT_APPLICATION_STAGES,
    generate_package: PACKAGE_GENERATION_STAGES,
    export_video: EXPORT_STAGES,
    export_platform: PLATFORM_EXPORT_STAGES,
  };
  
  return (templates[type] || EXPORT_STAGES).map(s => ({
    ...s,
    status: "pending" as const,
    progress: 0,
  }));
}

// ============= Storage =============

const STORAGE_KEY = "vantage_render_queue";
const MAX_COMPLETED_JOBS = 15;
const PRUNE_AFTER_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Load render jobs from storage
 */
export function loadRenderJobs(): RenderJob[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const jobs = JSON.parse(stored) as RenderJob[];
    const now = Date.now();
    
    // Prune old completed jobs
    const pruned = jobs.filter(job => {
      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
        const completedTime = job.completedAt ? new Date(job.completedAt).getTime() : 0;
        return now - completedTime <= PRUNE_AFTER_MS;
      }
      return true;
    });
    
    if (pruned.length < jobs.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    }
    
    return pruned;
  } catch {
    return [];
  }
}

/**
 * Save render jobs to storage
 */
export function saveRenderJobs(jobs: RenderJob[]): void {
  try {
    const active = jobs.filter(j => 
      j.status === "queued" || j.status === "processing" || j.status === "uploading"
    );
    const completed = jobs
      .filter(j => j.status === "completed" || j.status === "failed" || j.status === "cancelled")
      .slice(0, MAX_COMPLETED_JOBS);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...active, ...completed]));
  } catch (e) {
    console.error("[RenderQueue] Failed to save:", e);
  }
}

/**
 * Generate unique job ID
 */
function generateJobId(): string {
  return `render_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============= Job Management =============

/**
 * Create a new render job
 */
export function createRenderJob(params: {
  type: RenderJobType;
  sessionId: string;
  sessionTitle: string;
  reelId?: string;
  frameOverlayId?: string;
  effectEventIds?: string[];
  reelPackageConfigId?: string;
  outputQuality?: "preview" | "standard" | "high";
  outputResolution?: "720p" | "1080p" | "1440p" | "4k";
}): RenderJob {
  const now = new Date().toISOString();
  
  const job: RenderJob = {
    id: generateJobId(),
    type: params.type,
    status: "queued",
    sessionId: params.sessionId,
    sessionTitle: params.sessionTitle,
    reelId: params.reelId,
    frameOverlayId: params.frameOverlayId,
    effectEventIds: params.effectEventIds,
    reelPackageConfigId: params.reelPackageConfigId,
    stages: getStagesForType(params.type),
    currentStageIndex: -1,
    overallProgress: 0,
    outputQuality: params.outputQuality || "standard",
    outputResolution: params.outputResolution || "1080p",
    canCancel: true,
    createdAt: now,
    retryCount: 0,
    maxRetries: 3,
  };
  
  const jobs = loadRenderJobs();
  jobs.unshift(job);
  saveRenderJobs(jobs);
  
  return job;
}

/**
 * Update a render job
 */
export function updateRenderJob(
  jobId: string,
  updates: Partial<RenderJob>
): RenderJob | null {
  const jobs = loadRenderJobs();
  const index = jobs.findIndex(j => j.id === jobId);
  
  if (index === -1) return null;
  
  const job = { ...jobs[index], ...updates };
  
  // Update stage statuses based on currentStageIndex
  if (updates.currentStageIndex !== undefined) {
    job.stages = job.stages.map((stage, i) => {
      if (i < updates.currentStageIndex!) {
        return { ...stage, status: "completed" as const, progress: 100 };
      } else if (i === updates.currentStageIndex!) {
        return { 
          ...stage, 
          status: "active" as const,
          startedAt: new Date().toISOString(),
        };
      }
      return { ...stage, status: "pending" as const, progress: 0 };
    });
    
    // Calculate overall progress
    const stageWeight = 100 / job.stages.length;
    job.overallProgress = Math.round(
      (updates.currentStageIndex + 1) * stageWeight
    );
  }
  
  // Mark preview ready at "generating_preview" stage completion
  if (job.stages.some(s => s.id === "generating_preview" && s.status === "completed") && !job.previewReadyAt) {
    job.previewReadyAt = new Date().toISOString();
  }
  
  // Mark all stages complete on success
  if (updates.status === "completed") {
    job.stages = job.stages.map(s => ({ 
      ...s, 
      status: "completed" as const, 
      progress: 100,
      completedAt: new Date().toISOString(),
    }));
    job.overallProgress = 100;
    job.completedAt = new Date().toISOString();
    job.canCancel = false;
  }
  
  // Mark current stage failed on error
  if (updates.status === "failed" && job.currentStageIndex >= 0) {
    job.stages[job.currentStageIndex] = {
      ...job.stages[job.currentStageIndex],
      status: "failed",
    };
    job.canCancel = false;
  }
  
  jobs[index] = job;
  saveRenderJobs(jobs);
  
  return job;
}

/**
 * Update stage progress within a job
 */
export function updateStageProgress(
  jobId: string,
  stageIndex: number,
  progress: number
): RenderJob | null {
  const jobs = loadRenderJobs();
  const index = jobs.findIndex(j => j.id === jobId);
  
  if (index === -1) return null;
  
  const job = jobs[index];
  if (stageIndex >= 0 && stageIndex < job.stages.length) {
    job.stages[stageIndex] = {
      ...job.stages[stageIndex],
      progress: Math.min(100, Math.max(0, progress)),
    };
    
    // Recalculate overall progress
    const stageWeight = 100 / job.stages.length;
    const completedWeight = job.stages.reduce((acc, stage, i) => {
      if (i < stageIndex) return acc + stageWeight;
      if (i === stageIndex) return acc + (stageWeight * stage.progress / 100);
      return acc;
    }, 0);
    job.overallProgress = Math.round(completedWeight);
  }
  
  jobs[index] = job;
  saveRenderJobs(jobs);
  
  return job;
}

/**
 * Get a render job by ID
 */
export function getRenderJob(jobId: string): RenderJob | null {
  const jobs = loadRenderJobs();
  return jobs.find(j => j.id === jobId) || null;
}

/**
 * Cancel a render job
 */
export function cancelRenderJob(jobId: string): boolean {
  const job = getRenderJob(jobId);
  if (!job || !job.canCancel) return false;
  
  updateRenderJob(jobId, {
    status: "cancelled",
    completedAt: new Date().toISOString(),
    canCancel: false,
  });
  
  return true;
}

/**
 * Retry a failed render job
 */
export function retryRenderJob(jobId: string): RenderJob | null {
  const job = getRenderJob(jobId);
  if (!job || job.status !== "failed") return null;
  if (job.retryCount >= job.maxRetries) return null;
  
  return updateRenderJob(jobId, {
    status: "queued",
    overallProgress: 0,
    currentStageIndex: -1,
    stages: getStagesForType(job.type),
    retryCount: job.retryCount + 1,
    errorMessage: undefined,
    previewUrl: undefined,
    finalUrl: undefined,
    completedAt: undefined,
    previewReadyAt: undefined,
    canCancel: true,
  });
}

/**
 * Dismiss a job from the queue
 */
export function dismissRenderJob(jobId: string): void {
  const jobs = loadRenderJobs();
  saveRenderJobs(jobs.filter(j => j.id !== jobId));
}

/**
 * Get active render jobs
 */
export function getActiveRenderJobs(): RenderJob[] {
  return loadRenderJobs().filter(j => 
    j.status === "queued" || j.status === "processing" || j.status === "uploading"
  );
}

/**
 * Get jobs for a specific session
 */
export function getSessionRenderJobs(sessionId: string): RenderJob[] {
  return loadRenderJobs().filter(j => j.sessionId === sessionId);
}

// ============= Export State Helpers =============

export type ExportState = "idle" | "exporting" | "success" | "failed";

export interface ExportStateInfo {
  state: ExportState;
  progress: number;
  stage: string;
  canCancel: boolean;
  errorMessage?: string;
  outputUrl?: string;
  downloadPath?: string;
}

/**
 * Get export state for a session
 */
export function getExportState(sessionId: string): ExportStateInfo {
  const jobs = loadRenderJobs().filter(
    j => j.sessionId === sessionId && 
    (j.type === "export_video" || j.type === "export_platform")
  );
  
  // Find most recent active or completed export job
  const activeJob = jobs.find(j => 
    j.status === "queued" || j.status === "processing" || j.status === "uploading"
  );
  
  if (activeJob) {
    const currentStage = activeJob.stages[activeJob.currentStageIndex];
    return {
      state: "exporting",
      progress: activeJob.overallProgress,
      stage: currentStage?.label || "Preparing",
      canCancel: activeJob.canCancel,
    };
  }
  
  const completedJob = jobs.find(j => j.status === "completed");
  if (completedJob) {
    return {
      state: "success",
      progress: 100,
      stage: "Complete",
      canCancel: false,
      outputUrl: completedJob.finalUrl,
      downloadPath: completedJob.downloadPath,
    };
  }
  
  const failedJob = jobs.find(j => j.status === "failed");
  if (failedJob) {
    return {
      state: "failed",
      progress: failedJob.overallProgress,
      stage: "Failed",
      canCancel: false,
      errorMessage: failedJob.errorMessage,
    };
  }
  
  return {
    state: "idle",
    progress: 0,
    stage: "",
    canCancel: false,
  };
}
