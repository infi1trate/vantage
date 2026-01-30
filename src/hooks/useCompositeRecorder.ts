import { useRef, useCallback, useEffect } from "react";

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
  canvas: HTMLCanvasElement | null;
  compositeStream: MediaStream | null;
  isCompositing: boolean;
  startCompositing: (config: CompositeRecorderConfig) => MediaStream | null;
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

  // Draw a single frame to canvas
  const drawFrame = useCallback(() => {
    if (!isCompositingRef.current || !ctxRef.current || !canvasRef.current) {
      return;
    }

    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    const config = configRef.current;

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw screen video as base layer (full canvas)
    if (screenVideoRef.current && screenVideoRef.current.readyState >= 2) {
      const video = screenVideoRef.current;
      
      // Calculate aspect-fit dimensions
      const videoAspect = video.videoWidth / video.videoHeight;
      const canvasAspect = canvas.width / canvas.height;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (videoAspect > canvasAspect) {
        // Video is wider - fit to width
        drawWidth = canvas.width;
        drawHeight = canvas.width / videoAspect;
        drawX = 0;
        drawY = (canvas.height - drawHeight) / 2;
      } else {
        // Video is taller - fit to height
        drawHeight = canvas.height;
        drawWidth = canvas.height * videoAspect;
        drawX = (canvas.width - drawWidth) / 2;
        drawY = 0;
      }
      
      ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
    }

    // Draw facecam as PiP overlay (bottom-right with rounded corners)
    if (facecamVideoRef.current && facecamVideoRef.current.readyState >= 2 && config?.facecamStream) {
      const video = facecamVideoRef.current;
      const position = config.facecamPosition || { x: 0.85, y: 0.75, scale: 0.2 };
      
      // Calculate PiP dimensions
      const pipWidth = canvas.width * position.scale;
      const pipHeight = pipWidth * (video.videoHeight / video.videoWidth) || pipWidth * 0.75;
      const pipX = canvas.width * position.x - pipWidth / 2;
      const pipY = canvas.height * position.y - pipHeight / 2;
      
      // Ensure PiP stays within bounds
      const clampedX = Math.max(8, Math.min(canvas.width - pipWidth - 8, pipX));
      const clampedY = Math.max(8, Math.min(canvas.height - pipHeight - 8, pipY));
      
      const borderRadius = 12;
      const borderWidth = 3;
      
      // Draw border
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(
        clampedX - borderWidth,
        clampedY - borderWidth,
        pipWidth + borderWidth * 2,
        pipHeight + borderWidth * 2,
        borderRadius + borderWidth
      );
      ctx.fillStyle = "rgba(200, 255, 0, 0.6)"; // Lime border matching brand
      ctx.fill();
      ctx.restore();
      
      // Draw facecam with rounded corners (clipping)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(clampedX, clampedY, pipWidth, pipHeight, borderRadius);
      ctx.clip();
      
      // Mirror the facecam horizontally for natural feel
      ctx.translate(clampedX + pipWidth, clampedY);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, pipWidth, pipHeight);
      
      ctx.restore();
    }

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
      
      // Get screen video dimensions
      const screenTrack = config.screenStream.getVideoTracks()[0];
      const settings = screenTrack?.getSettings();
      const width = config.canvasWidth || settings?.width || 1920;
      const height = config.canvasHeight || settings?.height || 1080;
      const frameRate = config.frameRate || 60;
      
      console.log(`[Composite] Canvas size: ${width}x${height}, frameRate: ${frameRate}`);
      
      // Create canvas
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

  return {
    canvas: canvasRef.current,
    compositeStream: compositeStreamRef.current,
    isCompositing: isCompositingRef.current,
    startCompositing,
    stopCompositing,
  };
}
