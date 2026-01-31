/**
 * Thumbnail Cache System
 * 
 * Provides multi-tier caching for thumbnails:
 * 1. In-memory LRU cache (fastest, current session)
 * 2. IndexedDB cache (persistent, keyed by videoId + timestamp + version)
 * 
 * Optimized for minimal decode cost and instant loading.
 */

import { recordMetric } from "@/lib/performanceMetrics";

// Cache configuration
const LRU_MAX_SIZE = 100; // Max thumbnails in memory
const CACHE_VERSION = "v1"; // Bump to invalidate all cached thumbnails

// IndexedDB configuration
const DB_NAME = "vantage_thumbnail_cache";
const DB_VERSION = 1;
const STORE_NAME = "thumbnails";

// Types
export interface CachedThumbnail {
  key: string;
  blob: Blob;
  objectUrl: string;
  width: number;
  height: number;
  createdAt: number;
}

interface CacheEntry {
  key: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
}

/**
 * Generate a cache key for a thumbnail
 */
export function getThumbnailCacheKey(
  videoId: string,
  timestamp: number = 0,
  size: "sm" | "md" | "lg" = "md"
): string {
  return `${videoId}:${timestamp}:${size}:${CACHE_VERSION}`;
}

/**
 * Simple LRU Cache implementation
 */
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (item !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, item);
    }
    return item;
  }

  set(key: K, value: V): void {
    // Delete first if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Evict oldest if at capacity
    while (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// In-memory LRU cache
const memoryCache = new LRUCache<string, CachedThumbnail>(LRU_MAX_SIZE);

// Track object URLs for cleanup
const objectUrls = new Map<string, string>();

/**
 * Open the thumbnail cache database
 */
function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("[ThumbnailCache] Failed to open database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        if (import.meta.env.DEV) {
          console.log("[ThumbnailCache] Created thumbnail cache store");
        }
      }
    };
  });
}

/**
 * Get a thumbnail from cache (memory first, then IndexedDB)
 * Returns object URL if found, null if not cached
 */
export async function getCachedThumbnail(key: string): Promise<string | null> {
  const startTime = performance.now();
  
  // Check memory cache first
  const memCached = memoryCache.get(key);
  if (memCached) {
    recordMetric("thumbnail:cache-hit", performance.now() - startTime, { source: "memory" });
    return memCached.objectUrl;
  }

  // Check IndexedDB
  try {
    const db = await openCacheDB();
    const entry = await new Promise<CacheEntry | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    if (entry) {
      // Hydrate to memory cache
      const objectUrl = URL.createObjectURL(entry.blob);
      objectUrls.set(key, objectUrl);
      
      const cached: CachedThumbnail = {
        ...entry,
        objectUrl,
      };
      memoryCache.set(key, cached);
      
      recordMetric("thumbnail:cache-hit", performance.now() - startTime, { source: "indexeddb" });
      return objectUrl;
    }
  } catch (err) {
    console.warn("[ThumbnailCache] IndexedDB read error:", err);
  }

  recordMetric("thumbnail:cache-miss", performance.now() - startTime, {});
  return null;
}

/**
 * Store a thumbnail in cache (both memory and IndexedDB)
 */
export async function cacheThumbnail(
  key: string,
  blob: Blob,
  width: number,
  height: number
): Promise<string> {
  const startTime = performance.now();
  
  // Create object URL
  const objectUrl = URL.createObjectURL(blob);
  objectUrls.set(key, objectUrl);

  // Store in memory cache
  const cached: CachedThumbnail = {
    key,
    blob,
    objectUrl,
    width,
    height,
    createdAt: Date.now(),
  };
  memoryCache.set(key, cached);

  // Store in IndexedDB (async, don't block)
  try {
    const db = await openCacheDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const entry: CacheEntry = {
        key,
        blob,
        width,
        height,
        createdAt: Date.now(),
      };

      const request = store.put(entry);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.warn("[ThumbnailCache] IndexedDB write error:", err);
  }

  recordMetric("thumbnail:cache-store", performance.now() - startTime, { size: blob.size });
  return objectUrl;
}

/**
 * Remove a thumbnail from cache
 */
export async function removeCachedThumbnail(key: string): Promise<void> {
  // Remove from memory
  const cached = memoryCache.get(key);
  if (cached) {
    URL.revokeObjectURL(cached.objectUrl);
    memoryCache.delete(key);
  }

  // Remove tracked URL
  const url = objectUrls.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(key);
  }

  // Remove from IndexedDB
  try {
    const db = await openCacheDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.warn("[ThumbnailCache] IndexedDB delete error:", err);
  }
}

/**
 * Clear all cached thumbnails (both memory and IndexedDB)
 */
export async function clearThumbnailCache(): Promise<void> {
  // Revoke all object URLs
  for (const url of objectUrls.values()) {
    URL.revokeObjectURL(url);
  }
  objectUrls.clear();
  memoryCache.clear();

  // Clear IndexedDB
  try {
    const db = await openCacheDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.warn("[ThumbnailCache] Failed to clear IndexedDB:", err);
  }
}

/**
 * Prune old thumbnails from IndexedDB (keep last N days)
 */
export async function pruneThumbnailCache(maxAgeDays: number = 30): Promise<number> {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  try {
    const db = await openCacheDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("createdAt");

    const range = IDBKeyRange.upperBound(cutoff);
    const request = index.openCursor(range);

    await new Promise<void>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve();
        }
      };
    });

    console.log(`[ThumbnailCache] Pruned ${deletedCount} old thumbnails`);
  } catch (err) {
    console.warn("[ThumbnailCache] Prune error:", err);
  }

  return deletedCount;
}

/**
 * Get cache statistics
 */
export function getThumbnailCacheStats(): {
  memoryCount: number;
  memoryMaxSize: number;
} {
  return {
    memoryCount: memoryCache.size,
    memoryMaxSize: LRU_MAX_SIZE,
  };
}

/**
 * Cleanup on page unload
 */
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    // Revoke all object URLs to prevent memory leaks
    for (const url of objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
  });
}
