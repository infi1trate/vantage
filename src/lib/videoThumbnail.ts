/**
 * Video Thumbnail Generator
 *
 * Extracts the first frame from a video URL, converts it to a JPEG blob,
 * and uploads it to the community-thumbnails storage bucket.
 */

import { supabase } from "@/integrations/supabase/client";

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_QUALITY = 0.85;

/**
 * Load a video and capture a frame at the given time (default: 0.1s).
 * Returns a Blob of the captured frame as JPEG.
 */
function captureVideoFrame(
  videoUrl: string,
  timeSeconds = 0.1
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;

    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      video.removeEventListener("loadeddata", onLoaded);
      video.src = "";
      video.load();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Failed to load video for thumbnail extraction"));
    };

    const onSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const aspectRatio = video.videoHeight / video.videoWidth;
        canvas.width = THUMBNAIL_WIDTH;
        canvas.height = Math.round(THUMBNAIL_WIDTH * aspectRatio);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("Canvas 2D context not available"));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas toBlob returned null"));
            }
          },
          "image/jpeg",
          THUMBNAIL_QUALITY
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    const onLoaded = () => {
      video.currentTime = timeSeconds;
    };

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);

    video.src = videoUrl;
  });
}

/**
 * Generate a thumbnail from a video URL and upload it to storage.
 * Returns the public URL of the uploaded thumbnail.
 *
 * @param videoUrl - The source video URL (can be a signed URL)
 * @param userId - The authenticated user's ID (used for storage path scoping)
 * @param postId - A unique identifier to name the thumbnail file
 */
export async function generateAndUploadThumbnail(
  videoUrl: string,
  userId: string,
  postId: string
): Promise<string | null> {
  try {
    const blob = await captureVideoFrame(videoUrl);

    const path = `${userId}/${postId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("community-thumbnails")
      .upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Thumbnail] Upload failed:", uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("community-thumbnails")
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch (err) {
    console.error("[Thumbnail] Generation failed:", err);
    return null;
  }
}
