import { useRef, useCallback, useEffect } from "react";
import { recordMetric, createFPSCounter } from "@/lib/performanceMetrics";
import { generateThumbnailFromCanvas } from "@/lib/thumbnailWorker";
import { createAudioMixer, serializeMixSettings, AudioMixerResult, AudioMixSettings } from "@/lib/audioMixer";

export interface CompositeRecorderConfig {
  screenStream: MediaStream;
  microphoneStream?: MediaStream | null;
  facecamStream?: MediaStream | null;
  facecamPosition?: { x: number; y: number; scale: number };
  canvasWidth?: number;
  canvasHeight?: number;
  frameRate?: number;
  /** Custom audio mix settings (optional) */
  audioMixSettings?: Partial<AudioMixSettings>;
}

export interface CompositeRecorderReturn {
  getCanvas: () => HTMLCanvasElement | null;
  compositeStream: MediaStream | null;
  isCompositing: boolean;
  startCompositing: (config: CompositeRecorderConfig) => MediaStream | null;
  /** Capture thumbnail as dataURL (for quick previews) */
  captureThumbnail: (maxWidth?: number, quality?: number) => string | null;
  /** Capture thumbnail as Blob (for IndexedDB storage) */
  captureThumbnailBlob: (maxWidth?: number, quality?: number) => Promise<Blob | null>;
  stopCompositing: () => void;
  /** Whether system/game audio is included in the mix */
  hasGameAudio: boolean;
  /** Applied audio mix settings (for session metadata) */
  getAppliedMixSettings: () => Record<string, number> | null;
}

// Get best supported mime type for composited video
function getSupportedMimeType(): string {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "video/webm";
}

export function useCompositeRecorder(): CompositeRecorderReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const compositeStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioMixerRef = useRef<AudioMixerResult | null>(null);
  const isCompositingRef = useRef(false);
  const hasGameAudioRef = useRef(false);
  
  // Video elements for drawing
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const facecamVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // Config storage
  const configRef = useRef<CompositeRecorderConfig | null>(null);
  
  // FPS counter for composite rendering
  const fpsCounterRef = useRef(createFPSCounter("CompositeRecorder"));

  // Create hidden video element for a stream
  // Video starts loading immediately; drawFrame will skip if not ready
  const createVideoElement = useCallback((stream: MediaStream): HTMLVideoElement => {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    
    // Log when video becomes ready
    video.addEventListener("canplay", () => {
      console.log(`[Composite] Video canplay: ${video.videoWidth}x${video.videoHeight}, readyState=${video.readyState}`);
    }, { once: true });
    
    video.addEventListener("loadedmetadata", () => {
      console.log(`[Composite] Video loadedmetadata: ${video.videoWidth}x${video.videoHeight}`);
    }, { once: true });
    
    // Start playing - this triggers the stream to flow
    video.play().catch(err => {
      console.warn("[Composite] Video.play() rejected:", err);
      // Some browsers reject play() but still work - don't fail
    });
    
    return video;
  }, []);

  // Cache computed layout values to avoid recalculating every frame
  const layoutCacheRef = useRef<{
    screenDrawParams: { x: number; y: number; w: number; h: number } | null;
    pipDrawParams: { x: number; y: number; w: number; h: number; borderRadius: number } | null;
    lastScreenWidth: number;
    lastScreenHeight: number;
    lastFacecamWidth: number;
    lastFacecamHeight: number;
  }>({
    screenDrawParams: null,
    pipDrawParams: null,
    lastScreenWidth: 0,
    lastScreenHeight: 0,
    lastFacecamWidth: 0,
    lastFacecamHeight: 0,
  });

  // Frame counter for debugging
  const frameCountRef = useRef(0);
  const lastFrameLogRef = useRef(0);

  // Draw a single frame to canvas - optimized for minimal per-frame computation
  const drawFrame = useCallback(() => {
    if (!isCompositingRef.current || !ctxRef.current || !canvasRef.current) {
      return;
    }
    
    frameCountRef.current++;

    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    const config = configRef.current;
    const cache = layoutCacheRef.current;
    const screenVideo = screenVideoRef.current;
    
    // Log video readyState periodically in dev mode
    if (import.meta.env.DEV && frameCountRef.current - lastFrameLogRef.current >= 60) {
      lastFrameLogRef.current = frameCountRef.current;
      console.log(`[Composite] Frame #${frameCountRef.current}, screen video readyState=${screenVideo?.readyState}, videoSize=${screenVideo?.videoWidth}x${screenVideo?.videoHeight}`);
    }

    // Clear canvas - always do this even if video not ready
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw screen video as base layer (full canvas)
    if (screenVideo && screenVideo.readyState >= 2) {
      const vw = screenVideo.videoWidth;
      const vh = screenVideo.videoHeight;
      
      // Only recalculate layout if dimensions changed
      if (!cache.screenDrawParams || cache.lastScreenWidth !== vw || cache.lastScreenHeight !== vh) {
        const videoAspect = vw / vh;
        const canvasAspect = canvas.width / canvas.height;
        
        let drawWidth: number, drawHeight: number, drawX: number, drawY: number;
        
        if (videoAspect > canvasAspect) {
          drawWidth = canvas.width;
          drawHeight = canvas.width / videoAspect;
          drawX = 0;
          drawY = (canvas.height - drawHeight) / 2;
        } else {
          drawHeight = canvas.height;
          drawWidth = canvas.height * videoAspect;
          drawX = (canvas.width - drawWidth) / 2;
          drawY = 0;
        }
        
        cache.screenDrawParams = { x: drawX, y: drawY, w: drawWidth, h: drawHeight };
        cache.lastScreenWidth = vw;
        cache.lastScreenHeight = vh;
      }
      
      const { x, y, w, h } = cache.screenDrawParams;
      ctx.drawImage(screenVideo, x, y, w, h);
    }

    // Draw facecam as PiP overlay (bottom-right with rounded corners)
    const facecamVideo = facecamVideoRef.current;
    if (facecamVideo && facecamVideo.readyState >= 2 && config?.facecamStream) {
      const vw = facecamVideo.videoWidth || 1;
      const vh = facecamVideo.videoHeight || 1;
      const position = config.facecamPosition || { x: 0.85, y: 0.75, scale: 0.2 };
      
      // Only recalculate PiP layout if dimensions changed
      if (!cache.pipDrawParams || cache.lastFacecamWidth !== vw || cache.lastFacecamHeight !== vh) {
        const pipWidth = canvas.width * position.scale;
        const pipHeight = pipWidth * (vh / vw);
        const pipX = canvas.width * position.x - pipWidth / 2;
        const pipY = canvas.height * position.y - pipHeight / 2;
        
        const clampedX = Math.max(8, Math.min(canvas.width - pipWidth - 8, pipX));
        const clampedY = Math.max(8, Math.min(canvas.height - pipHeight - 8, pipY));
        
        cache.pipDrawParams = { x: clampedX, y: clampedY, w: pipWidth, h: pipHeight, borderRadius: 12 };
        cache.lastFacecamWidth = vw;
        cache.lastFacecamHeight = vh;
      }
      
      const { x: px, y: py, w: pw, h: ph, borderRadius } = cache.pipDrawParams;
      const borderWidth = 3;
      
      // Draw border
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(px - borderWidth, py - borderWidth, pw + borderWidth * 2, ph + borderWidth * 2, borderRadius + borderWidth);
      ctx.fillStyle = "rgba(200, 255, 0, 0.6)";
      ctx.fill();
      ctx.restore();
      
      // Draw facecam with rounded corners (clipping)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, borderRadius);
      ctx.clip();
      
      // Mirror the facecam horizontally for natural feel
      ctx.translate(px + pw, py);
      ctx.scale(-1, 1);
      ctx.drawImage(facecamVideo, 0, 0, pw, ph);
      
      ctx.restore();
    }

    // Update FPS counter
    fpsCounterRef.current.tick();

    // Continue animation loop
    if (isCompositingRef.current) {
      animationFrameRef.current = requestAnimationFrame(drawFrame);
    }
  }, []);

  // Start compositing
  const startCompositing = useCallback((config: CompositeRecorderConfig): MediaStream | null => {
    console.log("[Composite] Starting compositing...");
    
    try {
      // Store config
      configRef.current = config;
      
      // Get screen video dimensions - do NOT upscale beyond captured resolution
      const screenTrack = config.screenStream.getVideoTracks()[0];
      const settings = screenTrack?.getSettings();
      const capturedWidth = settings?.width || 1920;
      const capturedHeight = settings?.height || 1080;
      
      // Cap maximum resolution to prevent performance issues
      // Very large canvases (>4K) can cause encoder to stall and produce no data
      const MAX_WIDTH = 1920;
      const MAX_HEIGHT = 1080;
      
      // Calculate scaling to fit within max dimensions while preserving aspect ratio
      const aspectRatio = capturedWidth / capturedHeight;
      let targetWidth = capturedWidth;
      let targetHeight = capturedHeight;
      
      if (capturedWidth > MAX_WIDTH || capturedHeight > MAX_HEIGHT) {
        if (aspectRatio > MAX_WIDTH / MAX_HEIGHT) {
          // Width-constrained
          targetWidth = MAX_WIDTH;
          targetHeight = Math.round(MAX_WIDTH / aspectRatio);
        } else {
          // Height-constrained
          targetHeight = MAX_HEIGHT;
          targetWidth = Math.round(MAX_HEIGHT * aspectRatio);
        }
        console.log(`[Composite] Scaling down from ${capturedWidth}x${capturedHeight} to ${targetWidth}x${targetHeight} for encoder stability`);
      }
      
      // Use config override if provided, but don't exceed our calculated target
      const width = config.canvasWidth 
        ? Math.min(config.canvasWidth, targetWidth) 
        : targetWidth;
      const height = config.canvasHeight 
        ? Math.min(config.canvasHeight, targetHeight) 
        : targetHeight;
      
      // Default to 30fps for reliability (was 60fps)
      const frameRate = config.frameRate || 30;
      
      console.log(`[Composite] Screen captured at: ${capturedWidth}x${capturedHeight}`);
      console.log(`[Composite] Canvas size: ${width}x${height}, frameRate: ${frameRate}fps`);
      
      // Create canvas at target resolution
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvasRef.current = canvas;
      
      const ctx = canvas.getContext("2d", { 
        alpha: false,
        desynchronized: true // Better performance
      });
      
      if (!ctx) {
        throw new Error("Failed to get canvas 2D context");
      }
      ctxRef.current = ctx;
      
      // Create video elements
      screenVideoRef.current = createVideoElement(config.screenStream);
      
      if (config.facecamStream) {
        facecamVideoRef.current = createVideoElement(config.facecamStream);
      }
      
      // Set up Web Audio API mixing pipeline
      audioContextRef.current = new AudioContext();
      
      // Extract game/system audio from screen capture (may not be available)
      const screenAudioTracks = config.screenStream.getAudioTracks();
      const gameAudioStream = screenAudioTracks.length > 0 
        ? new MediaStream(screenAudioTracks) 
        : null;
      
      // Create the audio mixing pipeline
      const mixer = createAudioMixer({
        audioContext: audioContextRef.current,
        microphoneStream: config.microphoneStream || null,
        gameAudioStream,
        settings: config.audioMixSettings,
      });
      
      audioMixerRef.current = mixer;
      hasGameAudioRef.current = mixer.hasGameAudio;
      
      console.log(`[Composite] Audio mixer created - hasGameAudio: ${mixer.hasGameAudio}`);
      if (!mixer.hasGameAudio) {
        console.log("[Composite] Game audio: Not available (mic-only recording)");
      }
      
      // Start compositing loop
      isCompositingRef.current = true;
      animationFrameRef.current = requestAnimationFrame(drawFrame);
      
      // Capture canvas stream at specified frame rate
      const canvasStream = canvas.captureStream(frameRate);
      console.log(`[Composite] Canvas stream created with ${canvasStream.getVideoTracks().length} video tracks`);
      
      // Create combined stream with canvas video + mixed audio
      const combinedStream = new MediaStream();
      
      // Add canvas video track
      canvasStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
        console.log(`[Composite] Added video track: ${track.label}`);
      });
      
      // Add mixed audio track from the mixer (always exactly 1 track)
      mixer.destinationStream.getAudioTracks().forEach(track => {
        combinedStream.addTrack(track);
        console.log(`[Composite] Added mixed audio track: ${track.label}`);
      });
      
      // Verify we have exactly 1 audio track
      const audioTrackCount = combinedStream.getAudioTracks().length;
      console.log(`[Composite] Combined stream has ${audioTrackCount} audio track(s)`);
      
      compositeStreamRef.current = combinedStream;
      
      console.log(`[Composite] Combined stream ready with ${combinedStream.getTracks().length} tracks`);
      return combinedStream;
      
    } catch (err) {
      console.error("[Composite] Failed to start compositing:", err);
      stopCompositing();
      return null;
    }
  }, [createVideoElement, drawFrame]);

  // Stop compositing and cleanup
  const stopCompositing = useCallback(() => {
    console.log("[Composite] Stopping compositing...");
    
    isCompositingRef.current = false;
    
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Cleanup video elements
    if (screenVideoRef.current) {
      screenVideoRef.current.pause();
      screenVideoRef.current.srcObject = null;
      screenVideoRef.current = null;
    }
    
    if (facecamVideoRef.current) {
      facecamVideoRef.current.pause();
      facecamVideoRef.current.srcObject = null;
      facecamVideoRef.current = null;
    }
    
    // Cleanup audio mixer
    if (audioMixerRef.current) {
      audioMixerRef.current.dispose();
      audioMixerRef.current = null;
    }
    
    // Cleanup audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.warn);
      audioContextRef.current = null;
    }
    
    // Reset game audio flag
    hasGameAudioRef.current = false;
    
    // Stop composite stream tracks
    if (compositeStreamRef.current) {
      compositeStreamRef.current.getTracks().forEach(track => track.stop());
      compositeStreamRef.current = null;
    }
    
    // Cleanup canvas
    ctxRef.current = null;
    canvasRef.current = null;
    configRef.current = null;
    
    console.log("[Composite] Cleanup complete");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCompositing();
    };
  }, [stopCompositing]);

  // Capture thumbnail from current canvas state as dataURL
  const captureThumbnail = useCallback((maxWidth = 320, quality = 0.85): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn("[Composite] No canvas available for thumbnail");
      return null;
    }

    try {
      // Create a smaller canvas for the thumbnail
      const thumbCanvas = document.createElement("canvas");
      const aspectRatio = canvas.height / canvas.width;
      thumbCanvas.width = maxWidth;
      thumbCanvas.height = Math.round(maxWidth * aspectRatio);

      const ctx = thumbCanvas.getContext("2d");
      if (!ctx) {
        console.warn("[Composite] Failed to get thumbnail canvas context");
        return null;
      }

      // Draw scaled version
      ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

      // Return as data URL
      return thumbCanvas.toDataURL("image/jpeg", quality);
    } catch (err) {
      console.error("[Composite] Failed to capture thumbnail:", err);
      return null;
    }
  }, []);

  // Capture thumbnail from current canvas state as Blob (for IndexedDB storage)
  // Uses worker for off-thread processing when available
  const captureThumbnailBlob = useCallback(async (maxWidth = 320, quality = 0.85): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn("[Composite] No canvas available for thumbnail blob");
      return null;
    }

    try {
      // Use worker-based thumbnail generation (off main thread)
      const blob = await generateThumbnailFromCanvas(canvas, maxWidth, quality);
      console.log(`[Composite] Thumbnail blob captured: ${blob.size} bytes (worker)`);
      return blob;
    } catch (err) {
      console.error("[Composite] Failed to capture thumbnail blob:", err);
      
      // Fallback to main thread
      return new Promise((resolve) => {
        const thumbCanvas = document.createElement("canvas");
        const aspectRatio = canvas.height / canvas.width;
        thumbCanvas.width = maxWidth;
        thumbCanvas.height = Math.round(maxWidth * aspectRatio);

        const ctx = thumbCanvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

        thumbCanvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`[Composite] Thumbnail blob captured: ${blob.size} bytes (fallback)`);
            }
            resolve(blob);
          },
          "image/jpeg",
          quality
        );
      });
    }
  }, []);

  // Get applied mix settings for session metadata
  const getAppliedMixSettings = useCallback((): Record<string, number> | null => {
    if (!audioMixerRef.current) return null;
    return serializeMixSettings(audioMixerRef.current.appliedSettings);
  }, []);

  return {
    getCanvas: () => canvasRef.current,
    compositeStream: compositeStreamRef.current,
    isCompositing: isCompositingRef.current,
    startCompositing,
    stopCompositing,
    captureThumbnail,
    captureThumbnailBlob,
    hasGameAudio: hasGameAudioRef.current,
    getAppliedMixSettings,
  };
}
