import { useEffect, useRef, useState, useCallback } from "react";

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
          outputCategoryMask: true,
          outputConfidenceMasks: false,
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

  // Process video frames
  const processFrame = useCallback(() => {
    const video = videoElement;
    const canvas = canvasRef.current;
    const segmenter = segmenterRef.current;

    if (!video || !canvas || !segmenter || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Set canvas size to match video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
    }

    try {
      setIsProcessing(true);
      
      // Run segmentation
      const startTimeMs = performance.now();
      const result = segmenter.segmentForVideo(video, startTimeMs);
      
      if (result.categoryMask) {
        const mask = result.categoryMask;
        const maskData = mask.getAsUint8Array();
        const width = mask.width;
        const height = mask.height;

        // Draw background first
        if (bgImageRef.current) {
          // Draw background image
          ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
        } else {
          // Fill with background color
          ctx.fillStyle = backgroundColor || "#000000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw the video frame to an offscreen canvas to get pixel data
        const offscreen = document.createElement("canvas");
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
        const offCtx = offscreen.getContext("2d");
        if (offCtx) {
          offCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const videoImageData = offCtx.getImageData(0, 0, canvas.width, canvas.height);
          const videoPixels = videoImageData.data;

          // Get the current canvas (with background) pixel data
          const bgImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const bgPixels = bgImageData.data;

          // Composite: where mask is person (value > 0), use video pixels
          // Scale mask coordinates to canvas coordinates
          const scaleX = width / canvas.width;
          const scaleY = height / canvas.height;

          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              const canvasIdx = (y * canvas.width + x) * 4;
              
              // Get corresponding mask pixel
              const maskX = Math.floor(x * scaleX);
              const maskY = Math.floor(y * scaleY);
              const maskIdx = maskY * width + maskX;
              const maskValue = maskData[maskIdx];

              // If person detected (mask value > 0), blend video over background
              if (maskValue > 0) {
                // Smooth edge blending based on mask value
                const alpha = Math.min(maskValue / 255 * 1.5, 1);
                bgPixels[canvasIdx] = Math.round(videoPixels[canvasIdx] * alpha + bgPixels[canvasIdx] * (1 - alpha));
                bgPixels[canvasIdx + 1] = Math.round(videoPixels[canvasIdx + 1] * alpha + bgPixels[canvasIdx + 1] * (1 - alpha));
                bgPixels[canvasIdx + 2] = Math.round(videoPixels[canvasIdx + 2] * alpha + bgPixels[canvasIdx + 2] * (1 - alpha));
                bgPixels[canvasIdx + 3] = 255;
              }
            }
          }

          ctx.putImageData(bgImageData, 0, 0);
        }

        mask.close();
      }
    } catch (err) {
      // Silently continue - occasional frame drops are acceptable
    } finally {
      setIsProcessing(false);
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
