/**
 * IndexedDB storage for local session recordings
 * Stores session metadata and video blobs for offline access and persistence
 */

const DB_NAME = "vantage_sessions";
const DB_VERSION = 2; // Bumped for thumbnail store
const SESSIONS_STORE = "sessions";
const BLOBS_STORE = "blobs";
const THUMBNAILS_STORE = "thumbnails";

/** Debug indicator of what stream was actually recorded */
export type RecordedSourceType = "composed" | "screenOnly" | "unknown";

export interface LocalSession {
  id: string;
  title: string;
  gameName: string | null;
  createdAt: string;
  duration: number; // seconds
  hasCam: boolean;
  hasMic: boolean;
  hasSystemAudio: boolean;
  visibility: "private" | "unlisted" | "public";
  thumbnailDataUrl: string | null;
  blobSize: number; // bytes
  /** MIME type of the recording (e.g., "video/webm;codecs=vp9,opus") */
  mimeType: string;
  /** File extension ("mp4" or "webm") */
  fileExt?: "mp4" | "webm";
  /** Human-readable codecs label (e.g., "VP9 + Opus") */
  codecsLabel?: string;
  /** Simplified browser label (e.g., "Chrome 120") */
  browserLabel?: string;
  /** Duration in milliseconds for more precision */
  durationMs?: number;
  /** Debug: What stream source was used for the recording */
  recordedSource?: RecordedSourceType;
}

// Initialize the IndexedDB database
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("[LocalStorage] Failed to open database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create sessions store for metadata
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const sessionsStore = db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
        sessionsStore.createIndex("createdAt", "createdAt", { unique: false });
        console.log("[LocalStorage] Created sessions store");
      }

      // Create blobs store for video data
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: "id" });
        console.log("[LocalStorage] Created blobs store");
      }

      // Create thumbnails store for thumbnail blobs (v2)
      if (!db.objectStoreNames.contains(THUMBNAILS_STORE)) {
        db.createObjectStore(THUMBNAILS_STORE, { keyPath: "id" });
        console.log("[LocalStorage] Created thumbnails store");
      }
    };
  });
}

/**
 * Save a recording session to IndexedDB
 * @param session Session metadata
 * @param blob Video blob
 * @param thumbnailBlob Optional thumbnail blob (JPEG)
 */
export async function saveLocalSession(
  session: LocalSession,
  blob: Blob,
  thumbnailBlob?: Blob | null
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const storeNames = [SESSIONS_STORE, BLOBS_STORE];
    if (thumbnailBlob) {
      storeNames.push(THUMBNAILS_STORE);
    }
    
    const transaction = db.transaction(storeNames, "readwrite");

    transaction.onerror = () => {
      console.error("[LocalStorage] Transaction error:", transaction.error);
      reject(transaction.error);
    };

    transaction.oncomplete = () => {
      console.log(`[LocalStorage] Session ${session.id} saved successfully`);
      resolve();
    };

    // Save metadata
    const sessionsStore = transaction.objectStore(SESSIONS_STORE);
    sessionsStore.put({ ...session, blobSize: blob.size });

    // Save video blob
    const blobsStore = transaction.objectStore(BLOBS_STORE);
    blobsStore.put({ id: session.id, blob });

    // Save thumbnail blob if provided
    if (thumbnailBlob) {
      const thumbnailsStore = transaction.objectStore(THUMBNAILS_STORE);
      thumbnailsStore.put({ id: session.id, blob: thumbnailBlob });
      console.log(`[LocalStorage] Thumbnail saved: ${thumbnailBlob.size} bytes`);
    }
  });
}

/**
 * Get all local sessions (metadata only, sorted by createdAt desc)
 */
export async function getAllLocalSessions(): Promise<LocalSession[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, "readonly");
    const store = transaction.objectStore(SESSIONS_STORE);
    const index = store.index("createdAt");
    const request = index.getAll();

    request.onerror = () => {
      console.error("[LocalStorage] Failed to get sessions:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      // Sort by createdAt descending (newest first)
      const sessions = (request.result as LocalSession[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      resolve(sessions);
    };
  });
}

/**
 * Get a single session by ID
 */
export async function getLocalSession(sessionId: string): Promise<LocalSession | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, "readonly");
    const store = transaction.objectStore(SESSIONS_STORE);
    const request = store.get(sessionId);

    request.onerror = () => {
      console.error("[LocalStorage] Failed to get session:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
}

/**
 * Get the video blob for a session
 */
export async function getLocalSessionBlob(sessionId: string): Promise<Blob | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BLOBS_STORE, "readonly");
    const store = transaction.objectStore(BLOBS_STORE);
    const request = store.get(sessionId);

    request.onerror = () => {
      console.error("[LocalStorage] Failed to get blob:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result?.blob || null);
    };
  });
}

/**
 * Get the thumbnail blob for a session
 */
export async function getLocalSessionThumbnail(sessionId: string): Promise<Blob | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(THUMBNAILS_STORE, "readonly");
    const store = transaction.objectStore(THUMBNAILS_STORE);
    const request = store.get(sessionId);

    request.onerror = () => {
      console.error("[LocalStorage] Failed to get thumbnail:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result?.blob || null);
    };
  });
}

/**
 * Delete a session, its blob, and thumbnail from IndexedDB
 */
export async function deleteLocalSession(sessionId: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SESSIONS_STORE, BLOBS_STORE, THUMBNAILS_STORE], "readwrite");

    transaction.onerror = () => {
      console.error("[LocalStorage] Delete transaction error:", transaction.error);
      reject(transaction.error);
    };

    transaction.oncomplete = () => {
      console.log(`[LocalStorage] Session ${sessionId} deleted`);
      resolve();
    };

    // Delete from all stores
    transaction.objectStore(SESSIONS_STORE).delete(sessionId);
    transaction.objectStore(BLOBS_STORE).delete(sessionId);
    transaction.objectStore(THUMBNAILS_STORE).delete(sessionId);
  });
}

/**
 * Update session metadata (not the blob)
 */
export async function updateLocalSession(
  sessionId: string,
  updates: Partial<Omit<LocalSession, "id">>
): Promise<void> {
  const db = await openDatabase();
  const existing = await getLocalSession(sessionId);

  if (!existing) {
    throw new Error(`Session ${sessionId} not found`);
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, "readwrite");
    const store = transaction.objectStore(SESSIONS_STORE);

    const updated = { ...existing, ...updates };
    const request = store.put(updated);

    request.onerror = () => {
      console.error("[LocalStorage] Failed to update session:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log(`[LocalStorage] Session ${sessionId} updated`);
      resolve();
    };
  });
}

/**
 * Get total storage used by all sessions (approximate)
 */
export async function getStorageUsage(): Promise<{ count: number; totalBytes: number }> {
  const sessions = await getAllLocalSessions();
  const totalBytes = sessions.reduce((sum, s) => sum + (s.blobSize || 0), 0);
  return { count: sessions.length, totalBytes };
}

/**
 * Generate a thumbnail from a canvas element
 */
export function generateThumbnailFromCanvas(
  canvas: HTMLCanvasElement,
  maxWidth = 320,
  quality = 0.8
): string {
  // Create a smaller canvas for the thumbnail
  const thumbCanvas = document.createElement("canvas");
  const aspectRatio = canvas.height / canvas.width;
  thumbCanvas.width = maxWidth;
  thumbCanvas.height = Math.round(maxWidth * aspectRatio);

  const ctx = thumbCanvas.getContext("2d");
  if (!ctx) {
    console.warn("[LocalStorage] Failed to get thumbnail canvas context");
    return "";
  }

  // Draw scaled version
  ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

  // Return as data URL
  return thumbCanvas.toDataURL("image/jpeg", quality);
}

/**
 * Generate a thumbnail from a video blob
 */
export async function generateThumbnailFromBlob(
  blob: Blob,
  seekTime = 1, // seconds
  maxWidth = 320,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(blob);

    video.muted = true;
    video.src = url;

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video for thumbnail"));
    };

    video.onloadedmetadata = () => {
      // Seek to the specified time (or 10% into the video if short)
      const targetTime = Math.min(seekTime, video.duration * 0.1);
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const aspectRatio = video.videoHeight / video.videoWidth;
        canvas.width = maxWidth;
        canvas.height = Math.round(maxWidth * aspectRatio);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Failed to get canvas context");
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);

        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
  });
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
