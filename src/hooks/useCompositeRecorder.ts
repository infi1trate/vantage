import { useRef, useCallback, useEffect } from "react";
import { recordMetric, createFPSCounter, measureSync } from "@/lib/performanceMetrics";
export interface CompositeRecorderConfig {
  screenStream: MediaStream;
  microphoneStream?: MediaStream | null;
  facecamStream?: MediaStream | null;
  facecamPosition?: { x: number; y: number; scale: number };
  canvasWidth?: number;
  canvasHeight?: number;
  frameRate?: number;
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
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const isCompositingRef = useRef(false);
  
  // Video elements for drawing
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const facecamVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // Config storage
  const configRef = useRef<CompositeRecorderConfig | null>(null);
  
  // FPS counter for composite rendering
  const fpsCounterRef = useRef(createFPSCounter("CompositeRecorder"));

  // Create hidden video element for a stream
  const createVideoElement = useCallback((stream: MediaStream): HTMLVideoElement => {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    
    // Need to play to get video frames
    video.play().catch(console.error);
    
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

  // Draw a single frame to canvas - optimized for minimal per-frame computation
  const drawFrame = useCallback(() => {
    if (!isCompositingRef.current || !ctxRef.current || !canvasRef.current) {
      return;
    }

    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    const config = configRef.current;
    const cache = layoutCacheRef.current;

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw screen video as base layer (full canvas)
    const screenVideo = screenVideoRef.current;
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
      
      // Use captured resolution or config, but never upscale
      const width = config.canvasWidth 
        ? Math.min(config.canvasWidth, capturedWidth) 
        : capturedWidth;
      const height = config.canvasHeight 
        ? Math.min(config.canvasHeight, capturedHeight) 
        : capturedHeight;
      
      // Default to 30fps for reliability (was 60fps)
      const frameRate = config.frameRate || 30;
      
      console.log(`[Composite] Screen captured at: ${capturedWidth}x${capturedHeight}`);
      console.log(`[Composite] Canvas size: ${width}x${height}, frameRate: ${frameRate}fps`);
      
      // Create canvas at captured resolution (no upscaling)
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
      
      // Set up Web Audio API for mixing
      audioContextRef.current = new AudioContext();
      audioDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
      
      // Connect microphone to audio destination
      if (config.microphoneStream) {
        const micSource = audioContextRef.current.createMediaStreamSource(config.microphoneStream);
        // Add a gain node for potential level control
        const micGain = audioContextRef.current.createGain();
        micGain.gain.value = 1.0;
        micSource.connect(micGain);
        micGain.connect(audioDestinationRef.current);
        console.log("[Composite] Microphone connected to audio mixer");
      }
      
      // Connect system/tab audio if available from screen capture
      const screenAudioTracks = config.screenStream.getAudioTracks();
      if (screenAudioTracks.length > 0) {
        const screenAudioStream = new MediaStream(screenAudioTracks);
        const screenAudioSource = audioContextRef.current.createMediaStreamSource(screenAudioStream);
        const screenGain = audioContextRef.current.createGain();
        screenGain.gain.value = 1.0;
        screenAudioSource.connect(screenGain);
        screenGain.connect(audioDestinationRef.current);
        console.log("[Composite] System audio connected to audio mixer");
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
      
      // Add mixed audio track
      audioDestinationRef.current.stream.getAudioTracks().forEach(track => {
        combinedStream.addTrack(track);
        console.log(`[Composite] Added mixed audio track: ${track.label}`);
      });
      
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
    
    // Cleanup audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.warn);
      audioContextRef.current = null;
    }
    audioDestinationRef.current = null;
    
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
  const captureThumbnailBlob = useCallback((maxWidth = 320, quality = 0.85): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.warn("[Composite] No canvas available for thumbnail blob");
        resolve(null);
        return;
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
          resolve(null);
          return;
        }

        // Draw scaled version
        ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

        // Convert to blob
        thumbCanvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`[Composite] Thumbnail blob captured: ${blob.size} bytes`);
              resolve(blob);
            } else {
              console.warn("[Composite] Failed to create thumbnail blob");
              resolve(null);
            }
          },
          "image/jpeg",
          quality
        );
      } catch (err) {
        console.error("[Composite] Failed to capture thumbnail blob:", err);
        resolve(null);
      }
    });
  }, []);

  return {
    getCanvas: () => canvasRef.current,
    compositeStream: compositeStreamRef.current,
    isCompositing: isCompositingRef.current,
    startCompositing,
    stopCompositing,
    captureThumbnail,
    captureThumbnailBlob,
  };
}
