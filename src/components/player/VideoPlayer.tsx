import { useState, useRef, useEffect, useCallback } from "react";
import { Annotation, VoiceNote } from "@/lib/captures";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  SkipBack, 
  SkipForward,
  Settings
} from "lucide-react";

interface VideoPlayerProps {
  videoUrl?: string | null;
  duration: number;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onSeek: (time: number) => void;
  annotations: Annotation[];
  voiceNotes: VoiceNote[];
  onAnnotationClick?: (annotation: Annotation) => void;
}

export function VideoPlayer({
  videoUrl,
  duration,
  currentTime,
  onTimeUpdate,
  onSeek,
  annotations,
  voiceNotes,
  onAnnotationClick,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playbackRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Simulated playback for demo
  useEffect(() => {
    if (isPlaying && !videoUrl) {
      playbackRef.current = setInterval(() => {
        onTimeUpdate(Math.min(currentTime + 1, duration));
      }, 1000);
    }

    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    };
  }, [isPlaying, videoUrl, currentTime, duration, onTimeUpdate]);

  // Stop at end
  useEffect(() => {
    if (currentTime >= duration) {
      setIsPlaying(false);
    }
  }, [currentTime, duration]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  }, [isPlaying]);

  const handleSeek = useCallback((value: number[]) => {
    const newTime = value[0];
    onSeek(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  }, [onSeek]);

  const handleSkip = useCallback((seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    onSeek(newTime);
  }, [currentTime, duration, onSeek]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  }, [isMuted]);

  const handleFullscreen = useCallback(() => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.code) {
        case "Space":
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSkip(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSkip(5);
          break;
        case "KeyM":
          e.preventDefault();
          toggleMute();
          break;
        case "KeyF":
          e.preventDefault();
          handleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlayPause, handleSkip, toggleMute, handleFullscreen]);

  // Get annotation color based on type
  const getAnnotationColor = (type: Annotation["annotation_type"]) => {
    switch (type) {
      case "kill": return "bg-red-500";
      case "death": return "bg-vantage-purple";
      case "highlight": return "bg-yellow-500";
      case "objective": return "bg-vantage-success";
      default: return "bg-primary";
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative aspect-video bg-muted/20 rounded-lg overflow-hidden group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video or placeholder */}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted via-background to-muted">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Play className="h-10 w-10 text-primary" />
            </div>
            <p className="text-muted-foreground">Demo playback</p>
            <p className="text-xs text-muted-foreground/70">(Video preview simulated)</p>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-background/20 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
        {/* Center play button */}
        <button 
          onClick={handlePlayPause}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 rounded-full bg-primary/90 hover:bg-primary transition-all hover:scale-110"
        >
          {isPlaying ? (
            <Pause className="h-8 w-8 text-primary-foreground" />
          ) : (
            <Play className="h-8 w-8 text-primary-foreground" fill="currentColor" />
          )}
        </button>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          {/* Timeline with annotations */}
          <div className="relative h-8 group/timeline">
            {/* Annotation markers */}
            {annotations.map((annotation) => (
              <button
                key={annotation.id}
                className={`timeline-marker ${getAnnotationColor(annotation.annotation_type)}`}
                style={{ left: `${(annotation.timestamp_seconds / duration) * 100}%`, top: "50%" }}
                onClick={() => {
                  onSeek(annotation.timestamp_seconds);
                  onAnnotationClick?.(annotation);
                }}
                title={annotation.title || annotation.annotation_type}
              />
            ))}

            {/* Voice note markers */}
            {voiceNotes.map((note) => (
              <button
                key={note.id}
                className="timeline-marker bg-accent"
                style={{ 
                  left: `${(note.timestamp_seconds / duration) * 100}%`, 
                  top: "50%",
                  boxShadow: "0 0 8px hsl(var(--accent) / 0.6)"
                }}
                onClick={() => onSeek(note.timestamp_seconds)}
                title="Voice note"
              />
            ))}

            {/* Progress slider */}
            <Slider
              value={[currentTime]}
              max={duration}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Skip back */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-foreground/80 hover:text-foreground"
                onClick={() => handleSkip(-10)}
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              {/* Play/Pause */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-foreground/80 hover:text-foreground"
                onClick={handlePlayPause}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
              </Button>

              {/* Skip forward */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-foreground/80 hover:text-foreground"
                onClick={() => handleSkip(10)}
              >
                <SkipForward className="h-4 w-4" />
              </Button>

              {/* Time display */}
              <span className="text-sm font-mono-data text-foreground/80 ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Volume */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-foreground/80 hover:text-foreground"
                  onClick={toggleMute}
                >
                  {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="w-20"
                />
              </div>

              {/* Fullscreen */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-foreground/80 hover:text-foreground"
                onClick={handleFullscreen}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
