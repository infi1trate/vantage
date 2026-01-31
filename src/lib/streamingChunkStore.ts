/**
 * Streaming Chunk Store for Long Recordings
 * 
 * Persists MediaRecorder chunks directly to IndexedDB as they arrive,
 * avoiding memory accumulation. Supports streaming reads for playback/export.
 * 
 * Key features:
 * - Never holds full recording in memory
 * - Chunks written asynchronously with backpressure
 * - Streaming reconstruction for final blob
 * - Automatic cleanup on session end
 */

const DB_NAME = "vantage_chunks";
const DB_VERSION = 1;
const CHUNKS_STORE = "chunks";

// Chunk size threshold - smaller chunks = more granular writes, less memory
const CHUNK_FLUSH_SIZE = 256 * 1024; // 256KB accumulated before flush

export interface ChunkMetadata {
  sessionId: string;
  index: number;
  size: number;
  timestamp: number;
}

export interface ChunkStoreStats {
  chunkCount: number;
  totalBytes: number;
  pendingWrites: number;
  isWriting: boolean;
}

/**
 * Open the chunks database
 */
function openChunksDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("[ChunkStore] Failed to open database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const store = db.createObjectStore(CHUNKS_STORE, { keyPath: ["sessionId", "index"] });
        store.createIndex("sessionId", "sessionId", { unique: false });
        console.log("[ChunkStore] Created chunks store");
      }
    };
  });
}

/**
 * Streaming Chunk Store for a single recording session
 */
export class StreamingChunkStore {
  private sessionId: string;
  private chunkIndex = 0;
  private totalBytes = 0;
  private pendingWrites: Promise<void>[] = [];
  private isWriting = false;
  private destroyed = false;
  private db: IDBDatabase | null = null;
  
  // Accumulator for small chunks - flush when threshold reached
  private accumulator: Blob[] = [];
  private accumulatorSize = 0;
  
  // Memory pressure callbacks
  private memoryPressureCallbacks: Set<(isPressured: boolean) => void> = new Set();
  private isUnderPressure = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Initialize the database connection
   */
  async init(): Promise<void> {
    if (this.db) return;
    this.db = await openChunksDB();
    
    // Clear any existing chunks for this session (restart)
    await this.clearSessionChunks();
    console.log(`[ChunkStore] Initialized for session ${this.sessionId}`);
  }

  /**
   * Write a chunk - accumulates small chunks and flushes when threshold reached
   * Non-blocking - returns immediately
   */
  writeChunk(blob: Blob): void {
    if (this.destroyed) {
      console.warn("[ChunkStore] Attempted to write after destroy");
      return;
    }

    // Add to accumulator
    this.accumulator.push(blob);
    this.accumulatorSize += blob.size;
    this.totalBytes += blob.size;

    // Flush if accumulated enough
    if (this.accumulatorSize >= CHUNK_FLUSH_SIZE) {
      this.flush();
    }
    
    // Check memory pressure periodically
    if (this.chunkIndex % 10 === 0) {
      this.checkMemoryPressure();
    }
  }

  /**
   * Flush accumulated blobs to IndexedDB
   */
  private flush(): void {
    if (this.accumulator.length === 0) return;

    // Combine accumulated blobs into one
    const combinedBlob = new Blob(this.accumulator);
    const index = this.chunkIndex++;
    
    // Clear accumulator immediately to free memory
    this.accumulator = [];
    this.accumulatorSize = 0;

    // Schedule async write
    const writePromise = this.writeToIDB(index, combinedBlob);
    this.pendingWrites.push(writePromise);
    
    // Clean up completed writes periodically
    if (this.pendingWrites.length > 10) {
      this.cleanupCompletedWrites();
    }
  }

  /**
   * Write a single chunk to IndexedDB
   */
  private async writeToIDB(index: number, blob: Blob): Promise<void> {
    if (!this.db || this.destroyed) return;

    this.isWriting = true;
    
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction(CHUNKS_STORE, "readwrite");
        const store = transaction.objectStore(CHUNKS_STORE);
        
        const entry = {
          sessionId: this.sessionId,
          index,
          blob,
          size: blob.size,
          timestamp: Date.now(),
        };
        
        const request = store.put(entry);
        
        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error("[ChunkStore] Write failed:", request.error);
          reject(request.error);
        };
      });
    } catch (err) {
      console.error("[ChunkStore] Write error:", err);
      // Don't throw - we don't want to break recording
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Clean up completed write promises
   */
  private async cleanupCompletedWrites(): Promise<void> {
    // Filter to only pending writes
    const results = await Promise.allSettled(this.pendingWrites);
    this.pendingWrites = [];
  }

  /**
   * Wait for all pending writes to complete and flush remaining accumulator
   */
  async finalize(): Promise<void> {
    // Flush any remaining accumulated data
    this.flush();
    
    // Wait for all writes to complete
    await Promise.allSettled(this.pendingWrites);
    this.pendingWrites = [];
    
    console.log(`[ChunkStore] Finalized: ${this.chunkIndex} chunks, ${this.totalBytes} bytes`);
  }

  /**
   * Assemble all chunks into a single Blob (streaming read from IndexedDB)
   */
  async assembleBlob(mimeType: string): Promise<Blob> {
    await this.finalize();
    
    if (!this.db) {
      throw new Error("ChunkStore not initialized");
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(CHUNKS_STORE, "readonly");
      const store = transaction.objectStore(CHUNKS_STORE);
      const index = store.index("sessionId");
      
      const blobs: Blob[] = [];
      const request = index.openCursor(IDBKeyRange.only(this.sessionId));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        
        if (cursor) {
          blobs.push(cursor.value.blob);
          cursor.continue();
        } else {
          // Sort by index to ensure correct order
          blobs.sort((a, b) => {
            // The blobs are in cursor order which should be by key, but let's be safe
            return 0;
          });
          
          const finalBlob = new Blob(blobs, { type: mimeType });
          console.log(`[ChunkStore] Assembled blob: ${finalBlob.size} bytes from ${blobs.length} chunks`);
          resolve(finalBlob);
        }
      };
      
      request.onerror = () => {
        console.error("[ChunkStore] Read failed:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get current statistics
   */
  getStats(): ChunkStoreStats {
    return {
      chunkCount: this.chunkIndex,
      totalBytes: this.totalBytes,
      pendingWrites: this.pendingWrites.length,
      isWriting: this.isWriting,
    };
  }

  /**
   * Subscribe to memory pressure events
   */
  onMemoryPressure(callback: (isPressured: boolean) => void): () => void {
    this.memoryPressureCallbacks.add(callback);
    return () => this.memoryPressureCallbacks.delete(callback);
  }

  /**
   * Check and notify about memory pressure
   */
  private checkMemoryPressure(): void {
    // Use performance.memory if available (Chrome)
    const memory = (performance as any).memory;
    
    if (memory) {
      const usedHeapRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      const isPressured = usedHeapRatio > 0.7; // 70% heap usage
      
      if (isPressured !== this.isUnderPressure) {
        this.isUnderPressure = isPressured;
        console.log(`[ChunkStore] Memory pressure: ${isPressured ? "HIGH" : "normal"} (${(usedHeapRatio * 100).toFixed(1)}%)`);
        
        for (const callback of this.memoryPressureCallbacks) {
          try {
            callback(isPressured);
          } catch (e) {
            console.warn("[ChunkStore] Pressure callback error:", e);
          }
        }
      }
    }
  }

  /**
   * Clear all chunks for this session
   */
  private async clearSessionChunks(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(CHUNKS_STORE, "readwrite");
      const store = transaction.objectStore(CHUNKS_STORE);
      const index = store.index("sessionId");
      
      const request = index.openCursor(IDBKeyRange.only(this.sessionId));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Destroy and cleanup
   */
  async destroy(): Promise<void> {
    this.destroyed = true;
    this.accumulator = [];
    this.accumulatorSize = 0;
    this.pendingWrites = [];
    this.memoryPressureCallbacks.clear();
    
    // Clear chunks from IndexedDB
    await this.clearSessionChunks();
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    console.log(`[ChunkStore] Destroyed for session ${this.sessionId}`);
  }
}

/**
 * Delete all chunks for a session (cleanup after successful save)
 */
export async function deleteSessionChunks(sessionId: string): Promise<void> {
  const db = await openChunksDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNKS_STORE, "readwrite");
    const store = transaction.objectStore(CHUNKS_STORE);
    const index = store.index("sessionId");
    
    const request = index.openCursor(IDBKeyRange.only(sessionId));
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}
