import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Annotation, 
  VoiceNote, 
  AnnotationType,
  createAnnotation, 
  updateAnnotation, 
  deleteAnnotation,
  createVoiceNote 
} from "@/lib/captures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Target, 
  Skull, 
  Star, 
  Flag, 
  Bookmark,
  FileText,
  Mic,
  MicOff,
  Play,
  Square,
  Trash2,
  ArrowLeft,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface DrawerAnnotation {
  annotation?: Annotation;
  type: AnnotationType;
  timestamp: number;
  endTimestamp?: number;
  framePosition?: { x: number; y: number };
}

interface AnnotationDrawerProps {
  sessionId: string;
  currentTime: number;
  drawerAnnotation: DrawerAnnotation | null;
  existingVoiceNotes: VoiceNote[];
  onClose: () => void;
  onAnnotationCreated: (annotation: Annotation) => void;
  onAnnotationUpdated: (annotation: Annotation) => void;
  onAnnotationDeleted: (annotationId: string) => void;
  onSeek: (time: number) => void;
}

const EVENT_TYPES: { type: AnnotationType; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { type: "kill", label: "Kill", icon: Target, color: "text-vantage-success" },
  { type: "death", label: "Death", icon: Skull, color: "text-destructive" },
  { type: "highlight", label: "Highlight", icon: Star, color: "text-vantage-warning" },
  { type: "marker", label: "Marker", icon: Flag, color: "text-primary" },
  { type: "note", label: "Note", icon: FileText, color: "text-accent" },
  { type: "objective", label: "Objective", icon: Bookmark, color: "text-muted-foreground" },
];

export function AnnotationDrawer({
  sessionId,
  currentTime,
  drawerAnnotation,
  existingVoiceNotes,
  onClose,
  onAnnotationCreated,
  onAnnotationUpdated,
  onAnnotationDeleted,
  onSeek,
}: AnnotationDrawerProps) {
  const { user } = useAuth();
  
  // Form state
  const [eventType, setEventType] = useState<AnnotationType>("marker");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [attachFramePosition, setAttachFramePosition] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  
  // Auto-save debounce
  const saveTimeoutRef = useRef<number | null>(null);
  const [annotationId, setAnnotationId] = useState<string | null>(null);
  
  // Undo state
  const [undoStack, setUndoStack] = useState<{ title: string; notes: string }[]>([]);

  const isEditing = !!drawerAnnotation?.annotation;
  const timestamp = drawerAnnotation?.timestamp ?? currentTime;
  const endTimestamp = drawerAnnotation?.endTimestamp;

  // Initialize form from existing annotation
  useEffect(() => {
    if (drawerAnnotation?.annotation) {
      const a = drawerAnnotation.annotation;
      setEventType(a.annotation_type);
      setTitle(a.title || "");
      setNotes(a.content || "");
      setAnnotationId(a.id);
      setAttachFramePosition(!!drawerAnnotation.framePosition);
    } else if (drawerAnnotation) {
      setEventType(drawerAnnotation.type);
      setTitle("");
      setNotes("");
      setAnnotationId(null);
      setAttachFramePosition(!!drawerAnnotation.framePosition);
    }
  }, [drawerAnnotation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Push current state to undo stack
  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-19), { title, notes }]);
  }, [title, notes]);

  // Undo last change
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setTitle(last.title);
    setNotes(last.notes);
    setUndoStack(prev => prev.slice(0, -1));
    toast.info("Undone");
  }, [undoStack]);

  // Auto-save with debounce
  const scheduleAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = window.setTimeout(async () => {
      if (!user || !sessionId) return;
      
      try {
        setSaving(true);
        
        if (annotationId) {
          // Update existing
          const updated = await updateAnnotation(annotationId, {
            annotation_type: eventType,
            title: title || null,
            content: notes || null,
          });
          onAnnotationUpdated(updated);
        } else {
          // Create new
          const created = await createAnnotation(
            sessionId,
            user.id,
            timestamp,
            eventType,
            title || undefined,
            notes || undefined
          );
          setAnnotationId(created.id);
          onAnnotationCreated(created);
        }
      } catch (error) {
        console.error("Auto-save failed:", error);
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [user, sessionId, annotationId, eventType, title, notes, timestamp, onAnnotationCreated, onAnnotationUpdated]);

  // Handle field changes with auto-save
  const handleTitleChange = useCallback((value: string) => {
    pushUndo();
    setTitle(value);
    scheduleAutoSave();
  }, [pushUndo, scheduleAutoSave]);

  const handleNotesChange = useCallback((value: string) => {
    pushUndo();
    setNotes(value);
    scheduleAutoSave();
  }, [pushUndo, scheduleAutoSave]);

  const handleTypeChange = useCallback((type: AnnotationType) => {
    pushUndo();
    setEventType(type);
    scheduleAutoSave();
  }, [pushUndo, scheduleAutoSave]);

  // Delete annotation
  const handleDelete = useCallback(async () => {
    if (!annotationId) {
      onClose();
      return;
    }
    
    setDeleting(true);
    try {
      await deleteAnnotation(annotationId);
      onAnnotationDeleted(annotationId);
      toast.success("Annotation deleted");
      onClose();
    } catch (error) {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }, [annotationId, onAnnotationDeleted, onClose]);

  // Voice recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error("Could not access microphone");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  }, [isRecording]);

  const playAudio = useCallback(() => {
    if (!audioUrl) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  }, [audioUrl]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  // Get associated voice notes
  const linkedVoiceNotes = existingVoiceNotes.filter(v => 
    v.annotation_id === annotationId || 
    Math.abs(v.timestamp_seconds - timestamp) < 1
  );

  const currentEventConfig = EVENT_TYPES.find(e => e.type === eventType) || EVENT_TYPES[0];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={onClose}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-semibold">
            {isEditing ? "Edit Annotation" : "New Annotation"}
          </h2>
        </div>
        {saving && (
          <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Event Type */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Event Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {EVENT_TYPES.map((event) => (
                <button
                  key={event.type}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left",
                    eventType === event.type
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "border-border/40 hover:border-border hover:bg-muted/30"
                  )}
                  onClick={() => handleTypeChange(event.type)}
                >
                  <event.icon className={cn("h-4 w-4", eventType === event.type ? "" : event.color)} />
                  <span className="text-xs font-medium">{event.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Timestamp */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Timestamp</Label>
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-mono"
              onClick={() => onSeek(timestamp)}
            >
              <currentEventConfig.icon className={cn("h-4 w-4", currentEventConfig.color)} />
              <span>{formatTime(timestamp)}</span>
              {endTimestamp && (
                <>
                  <span className="text-muted-foreground">–</span>
                  <span>{formatTime(endTimestamp)}</span>
                </>
              )}
            </button>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Title</Label>
            <Input
              placeholder="Add a title..."
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="bg-background h-9"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Notes</Label>
            <Textarea
              placeholder="Add notes..."
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="bg-background resize-none min-h-[100px]"
            />
          </div>

          {/* Voice Note */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Voice Note</Label>
            
            {/* Existing voice notes */}
            {linkedVoiceNotes.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {linkedVoiceNotes.map((vn) => (
                  <div 
                    key={vn.id} 
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-sm"
                  >
                    <Mic className="h-3.5 w-3.5 text-accent" />
                    <span className="text-xs text-muted-foreground">
                      {vn.duration_seconds.toFixed(1)}s
                    </span>
                    {vn.transcription && (
                      <span className="text-xs truncate flex-1">{vn.transcription}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Recording controls */}
            <div className="flex items-center gap-2">
              {!isRecording && !audioUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={startRecording}
                >
                  <Mic className="h-4 w-4" />
                  Record
                </Button>
              )}
              
              {isRecording && (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={stopRecording}
                  >
                    <Square className="h-3 w-3" />
                    Stop
                  </Button>
                  <span className="text-xs font-mono text-destructive animate-pulse">
                    {formatTime(recordingDuration)}
                  </span>
                </>
              )}
              
              {audioUrl && !isRecording && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={isPlaying ? stopAudio : playAudio}
                  >
                    {isPlaying ? (
                      <>
                        <Square className="h-3 w-3" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" />
                        Play
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (audioUrl) URL.revokeObjectURL(audioUrl);
                      setAudioUrl(null);
                      setAudioBlob(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Frame Position Toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm">Attach frame position</Label>
            </div>
            <Switch
              checked={attachFramePosition}
              onCheckedChange={setAttachFramePosition}
              disabled={!drawerAnnotation?.framePosition}
            />
          </div>

          {/* Delete */}
          {annotationId && (
            <div className="pt-4 border-t border-border/30">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 w-full justify-start"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete Annotation"}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer hint */}
      <div className="shrink-0 px-4 py-2 border-t border-border/30 bg-muted/20">
        <p className="text-[11px] text-muted-foreground text-center">
          Changes save automatically • <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">⌘Z</kbd> to undo
        </p>
      </div>
    </div>
  );
}
