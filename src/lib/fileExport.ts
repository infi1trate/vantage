/**
 * File Export Utilities
 * Handles downloading video/audio files with proper naming
 */

import { format } from "date-fns";

/**
 * Generate a safe filename for export
 * Format: Vantage_<title>_<YYYY-MM-DD>_<HHmm>.<ext>
 */
export function generateExportFilename(
  title: string,
  extension: string,
  date: Date = new Date()
): string {
  // Sanitize title - remove/replace unsafe characters
  const safeTitle = title
    .replace(/[<>:"/\\|?*]/g, "") // Remove Windows-unsafe chars
    .replace(/[\s]+/g, "_") // Replace spaces with underscores
    .replace(/[^\w\-_.]/g, "") // Keep only word chars, hyphens, underscores, dots
    .substring(0, 50) // Limit length
    .replace(/_+$/, ""); // Remove trailing underscores
  
  const dateStr = format(date, "yyyy-MM-dd");
  const timeStr = format(date, "HHmm");
  
  return `Vantage_${safeTitle || "recording"}_${dateStr}_${timeStr}.${extension}`;
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Delay URL revocation to ensure download starts
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Download a file from a URL
 * For cross-origin URLs, fetches the file first
 */
export async function downloadFromUrl(
  url: string,
  filename: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  // Check if it's a blob URL (local) - can download directly
  if (url.startsWith("blob:")) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }
  
  // For remote URLs, fetch the file first
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  
  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  
  if (!response.body) {
    // Fallback for browsers without streaming support
    const blob = await response.blob();
    downloadBlob(blob, filename);
    return;
  }
  
  // Stream the response with progress tracking
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    chunks.push(value);
    received += value.length;
    
    if (onProgress && total > 0) {
      onProgress(received / total);
    }
  }
  
  // Combine chunks and download
  const blob = new Blob(chunks, { 
    type: response.headers.get("content-type") || "video/mp4" 
  });
  downloadBlob(blob, filename);
}

/**
 * Export session to desktop (fast export - no transcoding)
 * Uses the existing video file directly
 */
export async function exportToDesktop(options: {
  videoUrl?: string;
  videoBlob?: Blob;
  title: string;
  format: "mp4" | "mov" | "mp3" | "wav";
  onProgress?: (stage: string, progress: number) => void;
}): Promise<{ filename: string; size: number }> {
  const { videoUrl, videoBlob, title, format, onProgress } = options;
  
  if (!videoUrl && !videoBlob) {
    throw new Error("No video source available for export");
  }
  
  onProgress?.("Preparing", 0);
  
  const filename = generateExportFilename(title, format);
  
  if (videoBlob) {
    // Use existing blob directly
    onProgress?.("Downloading", 0.5);
    downloadBlob(videoBlob, filename);
    onProgress?.("Complete", 1);
    return { filename, size: videoBlob.size };
  }
  
  if (videoUrl) {
    // Download from URL
    let lastProgress = 0;
    await downloadFromUrl(videoUrl, filename, (progress) => {
      lastProgress = progress;
      onProgress?.("Downloading", progress);
    });
    onProgress?.("Complete", 1);
    // Size unknown for URL downloads
    return { filename, size: 0 };
  }
  
  throw new Error("Export failed - no source available");
}
