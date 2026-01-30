/**
 * Thumbnail Worker Manager
 * 
 * Manages the thumbnail worker and provides a Promise-based API
 * for generating thumbnails off the main thread.
 */

import { recordMetric, adjustThumbnailQueue } from "@/lib/performanceMetrics";

// Worker message types
interface ThumbnailRequest {
  id: string;
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
  startTime: number;
}

// Check if workers are available
const hasWorkerSupport = typeof Worker !== "undefined";
const hasOffscreenCanvas = typeof OffscreenCanvas !== "undefined";

// Pending requests map
const pendingRequests = new Map<string, ThumbnailRequest>();

// Worker instance (lazy loaded)
let worker: Worker | null = null;
let workerLoadFailed = false;

// Request ID counter
let requestIdCounter = 0;

/**
 * Get or create the worker instance
 */
function getWorker(): Worker | null {
  if (workerLoadFailed || !hasWorkerSupport) {
    return null;
  }
  
  if (!worker) {
    try {
      // Create worker from module
      worker = new Worker(
        new URL("../workers/thumbnail.worker.ts", import.meta.url),
        { type: "module" }
      );
      
      worker.onmessage = handleWorkerMessage;
      worker.onerror = handleWorkerError;
      
      console.log("[ThumbnailWorker] Worker initialized");
    } catch (err) {
      console.warn("[ThumbnailWorker] Failed to create worker:", err);
      workerLoadFailed = true;
      return null;
    }
  }
  
  return worker;
}

/**
 * Handle messages from worker
 */
function handleWorkerMessage(event: MessageEvent) {
  const { id, success, blob, error, durationMs } = event.data;
  
  const request = pendingRequests.get(id);
  if (!request) {
    console.warn("[ThumbnailWorker] Received result for unknown request:", id);
    return;
  }
  
  pendingRequests.delete(id);
  adjustThumbnailQueue(-1);
  
  // Record metrics
  const totalDuration = performance.now() - request.startTime;
  recordMetric("thumbnail:generate", totalDuration, {
    source: "worker",
    workerTime: durationMs,
    success,
  });
  
  if (success && blob) {
    request.resolve(blob);
  } else {
    request.reject(new Error(error || "Thumbnail generation failed"));
  }
}

/**
 * Handle worker errors
 */
function handleWorkerError(event: ErrorEvent) {
  console.error("[ThumbnailWorker] Worker error:", event.error);
  
  // Reject all pending requests
  for (const [id, request] of pendingRequests) {
    request.reject(new Error("Worker crashed"));
    pendingRequests.delete(id);
  }
  
  // Try to recreate worker
  worker?.terminate();
  worker = null;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `thumb-${Date.now()}-${++requestIdCounter}`;
}

/**
 * Generate thumbnail from ImageBitmap using worker
 * Falls back to main thread if worker unavailable
 */
export async function generateThumbnailFromBitmap(
  bitmap: ImageBitmap,
  maxWidth = 320,
  quality = 0.8
): Promise<Blob> {
  const w = getWorker();
  
  if (!w || !hasOffscreenCanvas) {
    // Fallback to main thread
    return generateThumbnailFromBitmapMainThread(bitmap, maxWidth, quality);
  }
  
  const id = generateRequestId();
  adjustThumbnailQueue(1);
  
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, {
      id,
      resolve,
      reject,
      startTime: performance.now(),
    });
    
    // Transfer the bitmap to the worker
    w.postMessage(
      {
        type: "generate-from-bitmap",
        id,
        bitmap,
        maxWidth,
        quality,
      },
      [bitmap] // Transfer ownership
    );
  });
}

/**
 * Main thread fallback for bitmap thumbnail generation
 */
async function generateThumbnailFromBitmapMainThread(
  bitmap: ImageBitmap,
  maxWidth: number,
  quality: number
): Promise<Blob> {
  const startTime = performance.now();
  
  const aspectRatio = bitmap.height / bitmap.width;
  const width = Math.min(maxWidth, bitmap.width);
  const height = Math.round(width * aspectRatio);
  
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Failed to get canvas context");
  }
  
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        const duration = performance.now() - startTime;
        recordMetric("thumbnail:generate", duration, {
          source: "main-thread",
          reason: "no-worker",
        });
        
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob"));
        }
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * Generate thumbnail from canvas element
 * Creates an ImageBitmap and processes off-thread if possible
 */
export async function generateThumbnailFromCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  maxWidth = 320,
  quality = 0.8
): Promise<Blob> {
  // Create ImageBitmap from canvas (fast, non-blocking)
  const bitmap = await createImageBitmap(canvas);
  
  return generateThumbnailFromBitmap(bitmap, maxWidth, quality);
}

/**
 * Schedule thumbnail generation during idle time
 * Returns immediately, thumbnail is generated when CPU is free
 */
export function scheduleThumbnailGeneration(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  maxWidth = 320,
  quality = 0.8,
  callback: (result: { blob?: Blob; error?: Error }) => void
): void {
  const scheduler = window.requestIdleCallback || 
    ((cb: () => void) => setTimeout(cb, 16));
  
  scheduler(async () => {
    try {
      const blob = await generateThumbnailFromCanvas(canvas, maxWidth, quality);
      callback({ blob });
    } catch (err) {
      callback({ error: err as Error });
    }
  });
}

/**
 * Terminate the worker (cleanup)
 */
export function terminateThumbnailWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    
    // Reject pending requests
    for (const [id, request] of pendingRequests) {
      request.reject(new Error("Worker terminated"));
    }
    pendingRequests.clear();
  }
}

// requestIdleCallback types are in global scope
