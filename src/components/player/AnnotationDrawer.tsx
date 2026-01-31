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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ChevronDown,
  Clock,
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

// Authored types require explicit "Done" action
const AUTHORED_TYPES: AnnotationType[] = ["note"];
const isAuthoredType = (type: AnnotationType) => AUTHORED_TYPES.includes(type);

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
  const [pendingClose, setPendingClose] = useState(false);
  
  // Undo state
  const [undoStack, setUndoStack] = useState<{ title: string; notes: string }[]>([]);

  const isAuthored = isAuthoredType(eventType);

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
      toast.success("Moment deleted");
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

  // Content checks for authored types
  const hasContent = title.trim() !== "" || notes.trim() !== "" || audioBlob !== null || linkedVoiceNotes.length > 0;
  const hasVoiceContent = audioBlob !== null || linkedVoiceNotes.length > 0;
  const canCommit = !isRecording && (!isAuthored || hasContent);

  const currentEventConfig = EVENT_TYPES.find(e => e.type === eventType) || EVENT_TYPES[0];

  // Handle Done/Commit action
  const handleDone = useCallback(async () => {
    // Cancel any pending auto-save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
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
      } else if (hasContent) {
        // Create new only if there's content
        const created = await createAnnotation(
          sessionId,
          user.id,
          timestamp,
          eventType,
          title || undefined,
          notes || undefined
        );
        onAnnotationCreated(created);
      }
      
      toast.success("Moment saved");
      onClose();
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save moment");
    } finally {
      setSaving(false);
    }
  }, [user, sessionId, annotationId, eventType, title, notes, timestamp, hasContent, onAnnotationCreated, onAnnotationUpdated, onClose]);

  // Handle cancel with confirmation for authored types
  const handleCancel = useCallback(() => {
    if (isAuthored && hasContent && !annotationId) {
      // Has unsaved content - show confirmation
      setPendingClose(true);
    } else {
      onClose();
    }
  }, [isAuthored, hasContent, annotationId, onClose]);

  const confirmDiscard = useCallback(() => {
    // Cancel any pending auto-save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setPendingClose(false);
    onClose();
  }, [onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Allow Escape in input fields for authored types
        if (e.key === "Escape" && isAuthored) {
          e.preventDefault();
          handleCancel();
        }
        return;
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
      
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
      
      // Enter to commit for authored types
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && isAuthored && canCommit) {
        e.preventDefault();
        handleDone();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleCancel, handleDone, isAuthored, canCommit]);

  return (
    <div className="flex flex-col h-full">
      {/* Discard confirmation overlay */}
      {pendingClose && (
        <div className="absolute inset-0 z-50 bg-background/95 flex flex-col items-center justify-center p-6 gap-4">
          <p className="text-sm text-muted-foreground text-center">
            Discard unsaved changes?
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingClose(false)}
            >
              Keep Editing
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={confirmDiscard}
              className="text-destructive hover:text-destructive"
            >
              Discard
            </Button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={handleCancel}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-semibold">
            {isEditing ? "Edit Moment" : "New Moment"}
          </h2>
        </div>
        {saving && (
          <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5 space-y-6">
          
          {/* ═══════════════════════════════════════════════════════════════
              SECTION 1: Event Type
              ═══════════════════════════════════════════════════════════════ */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wide">
              Event Type
            </h3>
            <div className="grid grid-cols-3 gap-1.5">
              {EVENT_TYPES.map((event) => (
                <button
                  key={event.type}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg transition-all touch-manipulation",
                    eventType === event.type
                      ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "hover:bg-muted/40 active:bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => handleTypeChange(event.type)}
                >
                  <event.icon className={cn("h-4 w-4", eventType === event.type ? "" : event.color)} />
                  <span className="text-[11px] font-medium">{event.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 2: Timing
              ═══════════════════════════════════════════════════════════════ */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Timing
            </h3>
            <button
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 active:bg-muted/50 transition-colors w-full text-left touch-manipulation min-h-12"
              onClick={() => onSeek(timestamp)}
            >
              <currentEventConfig.icon className={cn("h-4 w-4 shrink-0", currentEventConfig.color)} />
              <span className="text-sm font-mono tabular-nums">{formatTime(timestamp)}</span>
              {endTimestamp && (
                <>
                  <span className="text-muted-foreground/60">→</span>
                  <span className="text-sm font-mono tabular-nums">{formatTime(endTimestamp)}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {(endTimestamp - timestamp).toFixed(1)}s
                  </span>
                </>
              )}
            </button>
          </section>

          {/* Subtle divider */}
          <div className="border-t border-border/20" />

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 3: Reactions (Text + Voice)
              ═══════════════════════════════════════════════════════════════ */}
          <section className="space-y-4">
            <h3 className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wide">
              Add Your Thoughts
            </h3>
            
            {/* Title - minimal styling */}
            <div className="space-y-1.5">
              <Input
                placeholder="Title (optional)"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="border-0 bg-transparent px-0 h-8 text-sm font-medium placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            {/* Notes - minimal styling */}
            <div className="space-y-1.5">
              <Textarea
                placeholder="Jot down your thoughts..."
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                className="border-0 bg-muted/20 focus:bg-muted/30 resize-none min-h-[80px] text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/20"
              />
            </div>

            {/* Voice Note - compact */}
            <div className="space-y-2">
              {/* Existing voice notes */}
              {linkedVoiceNotes.length > 0 && (
                <div className="space-y-1">
                  {linkedVoiceNotes.map((vn) => (
                    <div 
                      key={vn.id} 
                      className="flex items-center gap-2 p-2 rounded-md bg-accent/10 text-sm"
                    >
                      <Mic className="h-3 w-3 text-accent shrink-0" />
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {vn.duration_seconds.toFixed(1)}s
                      </span>
                      {vn.transcription && (
                        <span className="text-xs truncate flex-1 text-muted-foreground">{vn.transcription}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Recording controls - inline */}
              <div className="flex items-center gap-2">
                {!isRecording && !audioUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-2"
                    onClick={startRecording}
                  >
                    <Mic className="h-3.5 w-3.5" />
                    <span className="text-xs">Add voice note</span>
                  </Button>
                )}
                
                {isRecording && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-destructive/10">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/20 h-7 px-2"
                      onClick={stopRecording}
                    >
                      <Square className="h-3 w-3" />
                      <span className="text-xs">Stop</span>
                    </Button>
                    <span className="text-xs font-mono text-destructive animate-pulse">
                      {formatTime(recordingDuration)}
                    </span>
                  </div>
                )}
                
                {audioUrl && !isRecording && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/30">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 h-7 px-2"
                      onClick={isPlaying ? stopAudio : playAudio}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="h-3 w-3" />
                          <span className="text-xs">Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3" />
                          <span className="text-xs">Play</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (audioUrl) URL.revokeObjectURL(audioUrl);
                        setAudioUrl(null);
                        setAudioBlob(null);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 4: Advanced Options (Progressive Disclosure)
              ═══════════════════════════════════════════════════════════════ */}
          {(drawerAnnotation?.framePosition || annotationId) && (
            <Collapsible className="space-y-2">
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group w-full">
                <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                <span>Advanced options</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                {/* Frame Position Toggle */}
                {drawerAnnotation?.framePosition && (
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label className="text-xs text-muted-foreground">Attach to frame position</Label>
                    </div>
                    <Switch
                      checked={attachFramePosition}
                      onCheckedChange={setAttachFramePosition}
                      className="scale-90"
                    />
                  </div>
                )}

                {/* Delete */}
                {annotationId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 gap-1.5 w-full justify-start h-8 text-xs"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deleting ? "Deleting..." : "Delete this moment"}
                  </Button>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </ScrollArea>

      {/* Footer - different for authored vs instant-save types */}
      {isAuthored ? (
        <div className="shrink-0 px-4 py-3 border-t border-border/30 bg-muted/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-muted-foreground">
                Changes save automatically
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">Esc</kbd> to cancel
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleDone}
              disabled={!canCommit || saving}
              className="h-8 px-4 text-xs font-medium bg-secondary/80 hover:bg-secondary border-0 shadow-sm"
            >
              {saving ? "Saving..." : "Done"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 px-4 py-2 border-t border-border/30 bg-muted/20">
          <p className="text-[11px] text-muted-foreground text-center">
            Changes save automatically • <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">⌘Z</kbd> to undo
          </p>
        </div>
      )}
    </div>
  );
}
