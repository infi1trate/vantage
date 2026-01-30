/**
 * Thumbnail Worker
 * 
 * Generates thumbnails off the main thread using OffscreenCanvas.
 * Handles both ImageBitmap input (from canvas capture) and video blob extraction.
 */

// Message types for worker communication
interface ThumbnailFromBitmapMessage {
  type: "generate-from-bitmap";
  id: string;
  bitmap: ImageBitmap;
  maxWidth: number;
  quality: number;
}

interface ThumbnailFromBlobMessage {
  type: "generate-from-blob";
  id: string;
  blob: Blob;
  seekTime: number;
  maxWidth: number;
  quality: number;
}

interface ThumbnailResultMessage {
  type: "result";
  id: string;
  success: boolean;
  blob?: Blob;
  error?: string;
  durationMs: number;
}

type WorkerMessage = ThumbnailFromBitmapMessage | ThumbnailFromBlobMessage;

// Check if OffscreenCanvas is available
const hasOffscreenCanvas = typeof OffscreenCanvas !== "undefined";

/**
 * Generate thumbnail from ImageBitmap using OffscreenCanvas
 */
async function generateFromBitmap(
  bitmap: ImageBitmap,
  maxWidth: number,
  quality: number
): Promise<Blob> {
  if (!hasOffscreenCanvas) {
    throw new Error("OffscreenCanvas not supported");
  }

  const aspectRatio = bitmap.height / bitmap.width;
  const width = Math.min(maxWidth, bitmap.width);
  const height = Math.round(width * aspectRatio);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  
  if (!ctx) {
    throw new Error("Failed to get 2D context");
  }

  // Draw scaled image
  ctx.drawImage(bitmap, 0, 0, width, height);
  
  // Close the bitmap to release memory
  bitmap.close();

  // Convert to blob
  return await canvas.convertToBlob({
    type: "image/jpeg",
    quality,
  });
}

/**
 * Generate thumbnail from video blob
 * Note: This requires DOM access, so it's limited in workers
 * We use a workaround with createImageBitmap for the first frame
 */
async function generateFromBlob(
  blob: Blob,
  seekTime: number,
  maxWidth: number,
  quality: number
): Promise<Blob> {
  // In a worker, we can't use HTMLVideoElement
  // We can try to use VideoFrame API if available (Chrome only)
  if (typeof VideoFrame !== "undefined" && typeof VideoDecoder !== "undefined") {
    return await generateFromBlobWithVideoFrame(blob, seekTime, maxWidth, quality);
  }
  
  // Fallback: Can't generate from blob in worker without VideoFrame API
  throw new Error("Video thumbnail generation not supported in worker - use main thread");
}

/**
 * Generate thumbnail using VideoFrame API (Chrome 94+)
 */
async function generateFromBlobWithVideoFrame(
  blob: Blob,
  seekTime: number,
  maxWidth: number,
  quality: number
): Promise<Blob> {
  // This is a simplified implementation
  // Full implementation would need to decode the video and extract a frame
  // For now, we just indicate it's not supported
  throw new Error("VideoFrame extraction not implemented - use main thread for blob thumbnails");
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const startTime = performance.now();
  const message = event.data;
  
  try {
    let resultBlob: Blob;
    
    switch (message.type) {
      case "generate-from-bitmap":
        resultBlob = await generateFromBitmap(
          message.bitmap,
          message.maxWidth,
          message.quality
        );
        break;
        
      case "generate-from-blob":
        resultBlob = await generateFromBlob(
          message.blob,
          message.seekTime,
          message.maxWidth,
          message.quality
        );
        break;
        
      default:
        throw new Error(`Unknown message type: ${(message as any).type}`);
    }
    
    const result: ThumbnailResultMessage = {
      type: "result",
      id: message.id,
      success: true,
      blob: resultBlob,
      durationMs: performance.now() - startTime,
    };
    
    self.postMessage(result);
    
  } catch (err) {
    const result: ThumbnailResultMessage = {
      type: "result",
      id: message.id,
      success: false,
      error: (err as Error).message,
      durationMs: performance.now() - startTime,
    };
    
    self.postMessage(result);
  }
};

// Export for TypeScript module resolution
export {};
