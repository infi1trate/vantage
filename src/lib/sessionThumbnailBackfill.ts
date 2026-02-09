/**
 * Session Thumbnail Backfill
 *
 * When a session has a video_url but no thumbnail_url, this utility
 * extracts the first frame client-side, uploads it to the
 * session-thumbnails bucket, and patches the session record.
 *
 * Designed to be idempotent — skips sessions that already have a thumbnail
 * or are already being backfilled in this page session.
 */

import { supabase } from "@/integrations/supabase/client";

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_QUALITY = 0.85;

/** Sessions currently being processed (prevents duplicate work) */
const inflight = new Set<string>();

/**
 * Extract a JPEG frame from a video URL at the given timestamp.
 */
function captureFrame(videoUrl: string, timeSeconds = 0.5): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;

    // 10 s timeout to avoid hanging forever on broken videos
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Thumbnail extraction timed out"));
    }, 10_000);

    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      video.removeEventListener("loadeddata", onLoaded);
      video.src = "";
      video.load();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Failed to load video for thumbnail"));
    };

    const onSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const aspect = video.videoHeight / video.videoWidth;
        canvas.width = THUMBNAIL_WIDTH;
        canvas.height = Math.round(THUMBNAIL_WIDTH * aspect);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("No 2D context"));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            cleanup();
            blob ? resolve(blob) : reject(new Error("toBlob returned null"));
          },
          "image/jpeg",
          THUMBNAIL_QUALITY,
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
 * Backfill a single session's thumbnail.
 * Returns the new public thumbnail URL, or null on failure.
 */
async function backfillOne(
  sessionId: string,
  videoUrl: string,
  userId: string,
): Promise<string | null> {
  if (inflight.has(sessionId)) return null;
  inflight.add(sessionId);

  try {
    console.log(`[ThumbnailBackfill] Generating for session ${sessionId}`);
    const blob = await captureFrame(videoUrl);

    const path = `${userId}/${sessionId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("session-thumbnails")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      console.error("[ThumbnailBackfill] Upload failed:", uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("session-thumbnails")
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    // Patch the session record so future loads have the thumbnail
    const { error: updateError } = await supabase
      .from("capture_sessions")
      .update({ thumbnail_url: publicUrl })
      .eq("id", sessionId);

    if (updateError) {
      console.error("[ThumbnailBackfill] DB update failed:", updateError);
      // Still return the URL — the thumbnail exists in storage
    }

    console.log(`[ThumbnailBackfill] Done for session ${sessionId}`);
    return publicUrl;
  } catch (err) {
    console.warn(`[ThumbnailBackfill] Failed for session ${sessionId}:`, err);
    return null;
  } finally {
    inflight.delete(sessionId);
  }
}

export interface BackfillableSession {
  id: string;
  thumbnail_url: string | null;
  video_url: string | null;
  user_id: string;
  status: string;
}

/**
 * Scan a list of sessions and backfill thumbnails for any that are:
 * - status = "ready"
 * - have a video_url
 * - missing thumbnail_url (or it's a data: URI which bloats the DB)
 *
 * Returns a Map of sessionId → new thumbnail URL for sessions that were backfilled.
 * Runs up to 3 concurrently to avoid overwhelming the browser.
 */
export async function backfillSessionThumbnails(
  sessions: BackfillableSession[],
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  const candidates = sessions.filter(
    (s) =>
      s.status === "ready" &&
      s.video_url &&
      (!s.thumbnail_url || s.thumbnail_url.startsWith("data:")) &&
      !inflight.has(s.id),
  );

  if (candidates.length === 0) return results;

  console.log(`[ThumbnailBackfill] ${candidates.length} sessions need thumbnails`);

  // Process in batches of 3
  const BATCH = 3;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map((s) => backfillOne(s.id, s.video_url!, s.user_id)),
    );

    settled.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        results.set(batch[idx].id, result.value);
      }
    });
  }

  return results;
}
