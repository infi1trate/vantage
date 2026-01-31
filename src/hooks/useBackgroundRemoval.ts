import { useEffect, useRef, useState, useCallback } from "react";
import { recordMetric, createFPSCounter } from "@/lib/performanceMetrics";

interface UseBackgroundRemovalOptions {
  enabled: boolean;
  videoElement: HTMLVideoElement | null;
  backgroundColor: string;
  backgroundImage: string | null;
}

interface UseBackgroundRemovalResult {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isProcessing: boolean;
  isModelLoaded: boolean;
  error: string | null;
}

// Dynamically load MediaPipe Tasks Vision
let ImageSegmenter: any = null;
let FilesetResolver: any = null;

async function loadMediaPipe() {
  if (ImageSegmenter && FilesetResolver) return { ImageSegmenter, FilesetResolver };
  
  const vision = await import("@mediapipe/tasks-vision");
  ImageSegmenter = vision.ImageSegmenter;
  FilesetResolver = vision.FilesetResolver;
  
  return { ImageSegmenter, FilesetResolver };
}

export function useBackgroundRemoval({
  enabled,
  videoElement,
  backgroundColor,
  backgroundImage,
}: UseBackgroundRemovalOptions): UseBackgroundRemovalResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const segmenterRef = useRef<any>(null);
  const animationRef = useRef<number>(0);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  
  // Reusable offscreen canvas to avoid GC pressure
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  
  // Pre-allocated ImageData to avoid repeated allocations
  const videoImageDataRef = useRef<ImageData | null>(null);
  const bgImageDataRef = useRef<ImageData | null>(null);
  
  // FPS counter for monitoring
  const fpsCounterRef = useRef(createFPSCounter("BackgroundRemoval"));
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load background image when it changes
  useEffect(() => {
    if (backgroundImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        bgImageRef.current = img;
      };
      img.onerror = () => {
        bgImageRef.current = null;
      };
      img.src = backgroundImage;
    } else {
      bgImageRef.current = null;
    }
  }, [backgroundImage]);

  // Initialize the segmenter
  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const initSegmenter = async () => {
      try {
        const { ImageSegmenter, FilesetResolver } = await loadMediaPipe();
        
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const segmenter = await ImageSegmenter.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          outputCategoryMask: false,
          outputConfidenceMasks: true, // Use confidence for smooth edges
        });

        if (isMounted) {
          segmenterRef.current = segmenter;
          setIsModelLoaded(true);
          setError(null);
        }
      } catch (err) {
        console.error("Failed to initialize segmenter:", err);
        if (isMounted) {
          setError("Background removal unavailable");
          setIsModelLoaded(false);
        }
      }
    };

    initSegmenter();

    return () => {
      isMounted = false;
      if (segmenterRef.current) {
        segmenterRef.current.close();
        segmenterRef.current = null;
      }
    };
  }, [enabled]);

  // Ref to track processing state without causing re-renders
  const isProcessingRef = useRef(false);
  
  // Throttled state update for processing indicator (avoid per-frame setState)
  const lastProcessingUpdateRef = useRef(0);
  const PROCESSING_UPDATE_INTERVAL = 500; // Only update UI every 500ms
  
  // Process video frames - optimized with reusable buffers
  // CRITICAL: No setState calls in this hot path to avoid React re-renders
  const processFrame = useCallback(() => {
    const video = videoElement;
    const canvas = canvasRef.current;
    const segmenter = segmenterRef.current;

    if (!video || !canvas || !segmenter || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Get or create context once (cache it)
    let ctx = canvas.getContext("2d", { 
      willReadFrequently: true,
      alpha: false, // Opaque canvas is faster
    });
    if (!ctx) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Resize canvas if needed
    const targetWidth = video.videoWidth || 320;
    const targetHeight = video.videoHeight || 240;
    
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      // Invalidate cached buffers on resize
      videoImageDataRef.current = null;
      bgImageDataRef.current = null;
      offscreenCanvasRef.current = null;
      offscreenCtxRef.current = null;
    }

    // Ensure offscreen canvas is ready
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement("canvas");
      offscreenCanvasRef.current.width = canvas.width;
      offscreenCanvasRef.current.height = canvas.height;
      offscreenCtxRef.current = offscreenCanvasRef.current.getContext("2d", {
        willReadFrequently: true,
      });
    }

    const startTimeMs = performance.now();

    try {
      isProcessingRef.current = true;
      
      // Run segmentation
      const result = segmenter.segmentForVideo(video, startTimeMs);
      
      // Use confidence mask for smooth edges (index 0 is person confidence for selfie segmenter)
      if (result.confidenceMasks && result.confidenceMasks.length > 0) {
        const personMask = result.confidenceMasks[0]; // Person confidence mask
        const maskData = personMask.getAsFloat32Array();
        const maskWidth = personMask.width;
        const maskHeight = personMask.height;

        // Guardrail: Detect inverted mask by sampling center region
        // Subject is typically centered in webcam feeds
        const centerX = Math.floor(maskWidth / 2);
        const centerY = Math.floor(maskHeight / 2);
        const sampleRadius = Math.floor(Math.min(maskWidth, maskHeight) * 0.15);
        
        let centerSum = 0;
        let centerCount = 0;
        for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
          for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
            const sx = centerX + dx;
            const sy = centerY + dy;
            if (sx >= 0 && sx < maskWidth && sy >= 0 && sy < maskHeight) {
              centerSum += maskData[sy * maskWidth + sx];
              centerCount++;
            }
          }
        }
        const centerAvg = centerCount > 0 ? centerSum / centerCount : 0.5;
        
        // If center region has low confidence, mask is likely inverted
        // (center should be the person with high confidence)
        const isInverted = centerAvg < 0.3;
        
        if (isInverted && process.env.NODE_ENV === 'development') {
          console.debug('[BackgroundRemoval] Detected inverted mask, auto-correcting');
        }

        // Draw background first
        if (bgImageRef.current) {
          ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.fillStyle = backgroundColor || "#000000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw video to reusable offscreen canvas
        const offCtx = offscreenCtxRef.current;
        if (offCtx) {
          offCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Reuse ImageData if dimensions match
          if (!videoImageDataRef.current || 
              videoImageDataRef.current.width !== canvas.width || 
              videoImageDataRef.current.height !== canvas.height) {
            videoImageDataRef.current = offCtx.createImageData(canvas.width, canvas.height);
          }
          
          // Get pixel data into pre-allocated buffer
          const tempVideoData = offCtx.getImageData(0, 0, canvas.width, canvas.height);
          videoImageDataRef.current.data.set(tempVideoData.data);
          const videoPixels = videoImageDataRef.current.data;

          // Get background pixel data
          const bgImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const bgPixels = bgImageData.data;

          // Composite: FINAL = (subject * alpha) + (background * (1 - alpha))
          // Where alpha = person confidence (1 = person, 0 = background)
          const scaleX = maskWidth / canvas.width;
          const scaleY = maskHeight / canvas.height;

          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          
          for (let y = 0; y < canvasHeight; y++) {
            const maskY = Math.floor(y * scaleY) * maskWidth;
            const rowOffset = y * canvasWidth * 4;
            
            for (let x = 0; x < canvasWidth; x++) {
              const maskX = Math.floor(x * scaleX);
              // Confidence value: 0.0 = background, 1.0 = person
              // Apply inversion correction if detected
              let personConfidence = maskData[maskY + maskX];
              if (isInverted) {
                personConfidence = 1 - personConfidence;
              }
              
              // Apply slight threshold for cleaner edges
              const alpha = Math.max(0, Math.min(1, personConfidence * 1.2));
              
              if (alpha > 0.01) {
                const canvasIdx = rowOffset + x * 4;
                const invAlpha = 1 - alpha;
                
                // Blend: person (video) over background
                bgPixels[canvasIdx] = (videoPixels[canvasIdx] * alpha + bgPixels[canvasIdx] * invAlpha) | 0;
                bgPixels[canvasIdx + 1] = (videoPixels[canvasIdx + 1] * alpha + bgPixels[canvasIdx + 1] * invAlpha) | 0;
                bgPixels[canvasIdx + 2] = (videoPixels[canvasIdx + 2] * alpha + bgPixels[canvasIdx + 2] * invAlpha) | 0;
                bgPixels[canvasIdx + 3] = 255;
              }
              // Where alpha ≈ 0, bgPixels remains as background color/image
            }
          }

          ctx.putImageData(bgImageData, 0, 0);
        }

        personMask.close();
        
        // Record frame processing time (non-blocking)
        const frameDuration = performance.now() - startTimeMs;
        recordMetric("capture:background-removal", frameDuration, {
          width: canvas.width,
          height: canvas.height,
        });
        
        // Update FPS counter
        fpsCounterRef.current.tick();
      }
    } catch (err) {
      // Silently continue - occasional frame drops are acceptable
    } finally {
      isProcessingRef.current = false;
      
      // Throttled UI update - only update React state periodically
      const now = performance.now();
      if (now - lastProcessingUpdateRef.current > PROCESSING_UPDATE_INTERVAL) {
        lastProcessingUpdateRef.current = now;
        // Batch this update with other state if needed
        setIsProcessing(true);
      }
    }

    animationRef.current = requestAnimationFrame(processFrame);
  }, [videoElement, backgroundColor]);

  // Start/stop processing loop
  useEffect(() => {
    if (!enabled || !isModelLoaded || !videoElement) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
      // Reset FPS counter when stopping
      fpsCounterRef.current.reset();
      return;
    }

    // Start processing
    animationRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
    };
  }, [enabled, isModelLoaded, videoElement, processFrame]);

  return {
    canvasRef,
    isProcessing,
    isModelLoaded,
    error,
  };
}
