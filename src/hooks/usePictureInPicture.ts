/**
 * usePictureInPicture - Hook for managing Picture-in-Picture mode for video streams
 * 
 * Accepts an external stream (from useFacecamCapture) and manages:
 * - Hidden video element for PiP
 * - PiP state (active/inactive)
 * - PiP enter/exit actions
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "@/hooks/use-toast";

export interface UsePictureInPictureReturn {
  /** Whether PiP is currently active */
  isPiPActive: boolean;
  /** Whether PiP is supported in this browser */
  isPiPSupported: boolean;
  /** Request PiP mode (must be called from user gesture) */
  requestPiP: () => Promise<boolean>;
  /** Exit PiP and return camera to page */
  exitPiP: () => Promise<void>;
  /** Attach a stream to the PiP video element */
  attachStream: (stream: MediaStream | null) => void;
}

// Check if PiP is supported in this browser
function checkPiPSupported(): boolean {
  return (
    typeof document !== "undefined" &&
    "pictureInPictureEnabled" in document &&
    document.pictureInPictureEnabled
  );
}

export function usePictureInPicture(): UsePictureInPictureReturn {
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isPiPSupported, setIsPiPSupported] = useState(true);
  
  // Hidden video element ref for PiP
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);
  
  // Check PiP support on mount
  useEffect(() => {
    setIsPiPSupported(checkPiPSupported());
  }, []);
  
  // Create hidden video element for PiP (rendered once, shared instance)
  useEffect(() => {
    // Check if video already exists (might be from another instance)
    let video = document.getElementById("pip-camera-video") as HTMLVideoElement | null;
    
    if (!video) {
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.style.display = "none";
      video.id = "pip-camera-video";
      document.body.appendChild(video);
      console.log("[PiP] Created hidden video element");
    }
    
    pipVideoRef.current = video;
    
    // Listen for PiP events
    const handleEnterPiP = () => {
      console.log("[PiP] Entered Picture-in-Picture");
      setIsPiPActive(true);
    };
    
    const handleLeavePiP = () => {
      console.log("[PiP] Left Picture-in-Picture");
      setIsPiPActive(false);
    };
    
    video.addEventListener("enterpictureinpicture", handleEnterPiP);
    video.addEventListener("leavepictureinpicture", handleLeavePiP);
    
    return () => {
      video?.removeEventListener("enterpictureinpicture", handleEnterPiP);
      video?.removeEventListener("leavepictureinpicture", handleLeavePiP);
      // Don't remove the video element - other components might use it
    };
  }, []);
  
  // Attach a stream to the hidden video element
  const attachStream = useCallback((stream: MediaStream | null) => {
    currentStreamRef.current = stream;
    
    if (pipVideoRef.current) {
      pipVideoRef.current.srcObject = stream;
      
      if (stream) {
        // Play video so PiP works
        pipVideoRef.current.play().catch(err => {
          console.warn("[PiP] Video play failed:", err);
        });
      }
    }
    
    // If stream becomes null, exit PiP
    if (!stream && document.pictureInPictureElement === pipVideoRef.current) {
      document.exitPictureInPicture().catch(() => {});
      setIsPiPActive(false);
    }
  }, []);
  
  // Request PiP mode
  const requestPiP = useCallback(async (): Promise<boolean> => {
    const video = pipVideoRef.current;
    
    if (!video) {
      console.error("[PiP] No video element available");
      return false;
    }
    
    if (!currentStreamRef.current || !currentStreamRef.current.active) {
      console.error("[PiP] No active stream for PiP");
      toast({
        title: "Camera not active",
        description: "Start the camera first before popping out.",
        variant: "destructive",
      });
      return false;
    }
    
    if (!checkPiPSupported()) {
      console.warn("[PiP] Not supported in this browser");
      toast({
        title: "Pop-out not supported",
        description: "Your browser doesn't support Picture-in-Picture.",
        variant: "destructive",
      });
      setIsPiPSupported(false);
      return false;
    }
    
    try {
      // Ensure video is playing (required for PiP)
      if (video.paused) {
        await video.play();
      }
      
      // Request PiP
      await video.requestPictureInPicture();
      console.log("[PiP] Requested successfully");
      return true;
    } catch (err: any) {
      console.error("[PiP] Failed to request:", err);
      
      if (err.name === "NotAllowedError") {
        toast({
          title: "Pop-out blocked",
          description: "Please click the button again to pop out camera.",
        });
      } else {
        toast({
          title: "Pop-out failed",
          description: "Camera will stay in the page.",
          variant: "destructive",
        });
        setIsPiPSupported(false);
      }
      return false;
    }
  }, []);
  
  // Exit PiP mode
  const exitPiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        console.log("[PiP] Exited successfully");
      }
    } catch (err) {
      console.warn("[PiP] Failed to exit:", err);
    }
    setIsPiPActive(false);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Exit PiP if active when component unmounts
      if (document.pictureInPictureElement === pipVideoRef.current) {
        document.exitPictureInPicture().catch(() => {});
      }
    };
  }, []);
  
  return {
    isPiPActive,
    isPiPSupported,
    requestPiP,
    exitPiP,
    attachStream,
  };
}
