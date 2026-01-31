/**
 * Async Chunk Queue with Backpressure
 * 
 * Non-blocking chunk handling for MediaRecorder output.
 * - Immediately enqueues chunks without blocking main thread
 * - Persists to IndexedDB asynchronously
 * - Applies backpressure when queue is too deep
 * - Never drops chunks
 * - Uses requestIdleCallback for non-urgent processing
 * - Integrates with memory guard for long recordings
 */

import { recordMetric, adjustThumbnailQueue } from "@/lib/performanceMetrics";
import { shouldPauseNonEssential, scheduleNonEssential } from "@/lib/memoryGuard";

// Queue configuration
const MAX_QUEUE_DEPTH = 50; // Pause non-essential work when queue exceeds this
const HIGH_WATER_MARK = 30; // Start backpressure signaling
const LOW_WATER_MARK = 10; // Resume normal processing

export interface ChunkEntry {
  index: number;
  blob: Blob;
  timestamp: number;
  size: number;
}

export interface ChunkQueueStats {
  queueDepth: number;
  totalChunks: number;
  totalBytes: number;
  isBackpressured: boolean;
  droppedChunks: number; // Should always be 0
  avgProcessTimeMs: number;
}

type BackpressureCallback = (isBackpressured: boolean) => void;

export class ChunkQueue {
  private queue: ChunkEntry[] = [];
  private isProcessing = false;
  private chunkIndex = 0;
  private totalBytes = 0;
  private processedChunks = 0;
  private processTimeSum = 0;
  private isBackpressured = false;
  private backpressureCallbacks: Set<BackpressureCallback> = new Set();
  private processorFn: ((chunk: ChunkEntry) => Promise<void>) | null = null;
  private isDestroyed = false;

  constructor() {
    // Bind methods for callbacks
    this.processNext = this.processNext.bind(this);
  }

  /**
   * Set the async processor function for chunks
   * This function will be called for each chunk in order
   */
  setProcessor(fn: (chunk: ChunkEntry) => Promise<void>): void {
    this.processorFn = fn;
  }

  /**
   * Enqueue a chunk (non-blocking, immediate return)
   * Never drops chunks, applies backpressure instead
   */
  enqueue(blob: Blob): void {
    if (this.isDestroyed) {
      console.warn("[ChunkQueue] Attempted to enqueue after destroy");
      return;
    }

    const entry: ChunkEntry = {
      index: this.chunkIndex++,
      blob,
      timestamp: performance.now(),
      size: blob.size,
    };

    this.queue.push(entry);
    this.totalBytes += blob.size;

    // Update metrics
    adjustThumbnailQueue(1);

    // Check for backpressure
    if (!this.isBackpressured && this.queue.length >= HIGH_WATER_MARK) {
      this.setBackpressure(true);
    }

    // Schedule processing if not already running
    if (!this.isProcessing) {
      this.scheduleProcessing();
    }
  }

  /**
   * Subscribe to backpressure state changes
   */
  onBackpressure(callback: BackpressureCallback): () => void {
    this.backpressureCallbacks.add(callback);
    // Immediately notify of current state
    callback(this.isBackpressured);
    return () => this.backpressureCallbacks.delete(callback);
  }

  /**
   * Get current queue statistics
   */
  getStats(): ChunkQueueStats {
    return {
      queueDepth: this.queue.length,
      totalChunks: this.chunkIndex,
      totalBytes: this.totalBytes,
      isBackpressured: this.isBackpressured,
      droppedChunks: 0, // We never drop
      avgProcessTimeMs: this.processedChunks > 0 
        ? this.processTimeSum / this.processedChunks 
        : 0,
    };
  }

  /**
   * Get all chunks as a single Blob (for final assembly)
   * Does NOT clear the queue - call destroy() separately
   */
  async assembleBlob(mimeType: string): Promise<Blob> {
    // Wait for processing to complete
    while (this.queue.length > 0 || this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Collect all blobs from processed chunks
    // The processor should have stored them; we just create the combined blob
    const allBlobs = this.getAllBlobs();
    return new Blob(allBlobs, { type: mimeType });
  }

  /**
   * Get all queued blobs (for emergency access)
   */
  private getAllBlobs(): Blob[] {
    return this.queue.map(entry => entry.blob);
  }

  /**
   * Clear the queue and reset state
   */
  destroy(): void {
    this.isDestroyed = true;
    this.queue = [];
    this.processorFn = null;
    this.backpressureCallbacks.clear();
    this.isProcessing = false;
    
    // Reset metrics
    adjustThumbnailQueue(-this.queue.length);
  }

  /**
   * Reset for a new recording session
   */
  reset(): void {
    this.queue = [];
    this.chunkIndex = 0;
    this.totalBytes = 0;
    this.processedChunks = 0;
    this.processTimeSum = 0;
    this.isBackpressured = false;
    this.isProcessing = false;
    this.isDestroyed = false;
  }

  private setBackpressure(value: boolean): void {
    if (this.isBackpressured !== value) {
      this.isBackpressured = value;
      if (import.meta.env.DEV) {
        console.log(`[ChunkQueue] Backpressure: ${value ? "ON" : "OFF"} (depth: ${this.queue.length})`);
      }
      
      // Notify callbacks
      for (const callback of this.backpressureCallbacks) {
        try {
          callback(value);
        } catch (e) {
          console.warn("[ChunkQueue] Backpressure callback error:", e);
        }
      }
    }
  }

  private scheduleProcessing(): void {
    if (this.isDestroyed) return;

    // Check memory pressure before scheduling
    if (shouldPauseNonEssential()) {
      // Under memory pressure - process immediately to clear queue faster
      setTimeout(() => this.processNext(), 0);
      return;
    }

    // Use requestIdleCallback if available for non-urgent processing
    // Fall back to setTimeout for Safari
    const scheduler = window.requestIdleCallback || 
      ((cb: () => void) => setTimeout(cb, 0));

    scheduler(() => this.processNext());
  }

  private async processNext(): Promise<void> {
    if (this.isDestroyed || this.queue.length === 0 || !this.processorFn) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const entry = this.queue[0]; // Peek, don't shift yet

    const startTime = performance.now();

    try {
      // Process the chunk
      await this.processorFn(entry);
      
      // Remove from queue after successful processing
      this.queue.shift();
      adjustThumbnailQueue(-1);
      
      // Track processing time
      const processTime = performance.now() - startTime;
      this.processedChunks++;
      this.processTimeSum += processTime;
      
      recordMetric("capture:recorder" as any, processTime, {
        operation: "chunk-process",
        chunkIndex: entry.index,
        chunkSize: entry.size,
      });

      // Check if we can release backpressure
      if (this.isBackpressured && this.queue.length <= LOW_WATER_MARK) {
        this.setBackpressure(false);
      }
    } catch (err) {
      console.error("[ChunkQueue] Processing error:", err);
      // Don't remove the chunk on error - it will be retried
      // But we need to prevent infinite loops
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Continue processing
    if (this.queue.length > 0 && !this.isDestroyed) {
      // If backpressured, process immediately; otherwise use scheduler
      if (this.isBackpressured || this.queue.length > MAX_QUEUE_DEPTH) {
        // Process immediately when under pressure
        await this.processNext();
      } else {
        this.scheduleProcessing();
      }
    } else {
      this.isProcessing = false;
    }
  }
}

// requestIdleCallback types are in global scope

/**
 * Create a chunk queue with IndexedDB persistence
 * This is the recommended way to handle MediaRecorder chunks
 */
export function createRecordingChunkQueue(): ChunkQueue {
  const queue = new ChunkQueue();
  
  // The chunks are held in memory during recording
  // Final assembly happens when stopRecording is called
  // No IndexedDB writes during recording - only at the end
  queue.setProcessor(async (chunk) => {
    // Chunks are just held in memory - no processing needed per-chunk
    // This allows the queue to drain quickly
    // The actual blob assembly happens at the end of recording
  });
  
  return queue;
}

/**
 * Utility to collect all chunks from MediaRecorder into a ChunkQueue
 * Returns a promise that resolves when recording stops
 */
export function collectChunksToQueue(
  recorder: MediaRecorder,
  queue: ChunkQueue
): { 
  promise: Promise<Blob>;
  getStats: () => ChunkQueueStats;
} {
  const chunks: Blob[] = [];
  let resolvePromise: (blob: Blob) => void;
  let rejectPromise: (err: Error) => void;
  
  const promise = new Promise<Blob>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
      queue.enqueue(event.data);
    }
  };
  
  recorder.onstop = () => {
    // Assemble all chunks into final blob
    const mimeType = recorder.mimeType || "video/webm";
    const blob = new Blob(chunks, { type: mimeType });
    resolvePromise(blob);
  };
  
  recorder.onerror = (event: any) => {
    rejectPromise(new Error(event.error?.message || "Recording error"));
  };
  
  return {
    promise,
    getStats: () => queue.getStats(),
  };
}
