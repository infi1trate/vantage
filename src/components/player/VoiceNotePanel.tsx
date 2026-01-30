import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { VoiceNote, createVoiceNote, uploadVoiceNote } from "@/lib/captures";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Trash2, 
  Loader2, 
  Square,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RecordingState = "idle" | "recording" | "saving" | "saved";

interface VoiceNotePanelProps {
  sessionId: string;
  currentTime: number;
  voiceNotes: VoiceNote[];
  onVoiceNoteCreated: (voiceNote: VoiceNote) => void;
  onVoiceNoteClick: (voiceNote: VoiceNote) => void;
  onVoiceNoteDelete?: (voiceNoteId: string) => void;
}

export function VoiceNotePanel({
  sessionId,
  currentTime,
  voiceNotes,
  onVoiceNoteCreated,
  onVoiceNoteClick,
  onVoiceNoteDelete,
}: VoiceNotePanelProps) {
  const { user } = useAuth();
  const { isRecording, recordingDuration, startRecording, stopRecording, error } = useAudioRecorder();
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [lastSavedNote, setLastSavedNote] = useState<VoiceNote | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    setRecordingStartTime(currentTime);
    setRecordingState("recording");
    setLastSavedNote(null);
    await startRecording();
  };

  const handleStopRecording = async () => {
    if (!user) return;

    const blob = await stopRecording();
    if (!blob) {
      setRecordingState("idle");
      return;
    }

    setRecordingState("saving");
    try {
      // Upload audio to storage
      const audioUrl = await uploadVoiceNote(user.id, sessionId, blob);

      // Create voice note record
      const voiceNote = await createVoiceNote(
        sessionId,
        user.id,
        recordingStartTime,
        recordingDuration,
        audioUrl
      );

      setLastSavedNote(voiceNote);
      setRecordingState("saved");
      onVoiceNoteCreated(voiceNote);
      toast.success("Voice note saved");

      // Auto-reset to idle after showing saved state
      setTimeout(() => {
        setRecordingState("idle");
        setLastSavedNote(null);
      }, 2000);
    } catch (err) {
      console.error("Error saving voice note:", err);
      toast.error("Failed to save voice note");
      setRecordingState("idle");
    }
  };

  const handlePlayVoiceNote = (voiceNote: VoiceNote) => {
    if (playingId === voiceNote.id) {
      // Stop playing
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
      setPlayingId(null);
      setAudioElement(null);
    } else {
      // Stop current audio
      if (audioElement) {
        audioElement.pause();
      }

      // Play new audio
      const audio = new Audio(voiceNote.audio_url);
      audio.onended = () => {
        setPlayingId(null);
        setAudioElement(null);
      };
      audio.play();
      setPlayingId(voiceNote.id);
      setAudioElement(audio);
    }
  };

  // State indicator component
  const StateIndicator = () => {
    switch (recordingState) {
      case "idle":
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Circle className="h-3 w-3" />
            <span className="text-xs uppercase tracking-wider">Ready</span>
          </div>
        );
      case "recording":
        return (
          <div className="flex items-center gap-2 text-destructive">
            <span className="w-3 h-3 rounded-full bg-destructive recording-pulse" />
            <span className="text-xs uppercase tracking-wider font-medium">Recording</span>
          </div>
        );
      case "saving":
        return (
          <div className="flex items-center gap-2 text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs uppercase tracking-wider">Saving...</span>
          </div>
        );
      case "saved":
        return (
          <div className="flex items-center gap-2 text-vantage-success">
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-xs uppercase tracking-wider font-medium">Saved!</span>
          </div>
        );
    }
  };

  return (
    <Card className="flex flex-col h-full bg-card border-border/50">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Voice Notes
          </h3>
          <StateIndicator />
        </div>

        {/* Recording control - large hit target */}
        <div 
          className={cn(
            "rounded-lg p-4 transition-all",
            recordingState === "recording" && "bg-destructive/10 border border-destructive/30",
            recordingState === "saving" && "bg-primary/10 border border-primary/30",
            recordingState === "saved" && "bg-vantage-success/10 border border-vantage-success/30",
            recordingState === "idle" && "bg-muted/30 border border-border/50"
          )}
        >
          {/* Idle state */}
          {recordingState === "idle" && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Recording will start at <span className="font-mono text-foreground">{formatTime(currentTime)}</span>
              </p>
              <Button
                size="lg"
                onClick={handleStartRecording}
                className="h-14 px-8 text-base bg-accent hover:bg-accent/90 text-accent-foreground gap-3"
                aria-label="Start recording voice note"
              >
                <Mic className="h-5 w-5" />
                Start Recording
              </Button>
            </div>
          )}

          {/* Recording state */}
          {recordingState === "recording" && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-mono font-semibold tabular-nums text-destructive">
                  {formatTime(recordingDuration)}
                </span>
                <div className="flex items-center gap-1 h-8">
                  {[...Array(7)].map((_, i) => (
                    <div 
                      key={i} 
                      className="waveform-bar w-1 bg-destructive rounded-full"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Recording at {formatTime(recordingStartTime)}
              </p>
              <Button
                size="lg"
                variant="destructive"
                onClick={handleStopRecording}
                className="h-14 px-8 text-base gap-3"
                aria-label="Stop and save recording"
              >
                <Square className="h-4 w-4" fill="currentColor" />
                Stop & Save
              </Button>
            </div>
          )}

          {/* Saving state */}
          {recordingState === "saving" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Saving voice note...</p>
            </div>
          )}

          {/* Saved state */}
          {recordingState === "saved" && lastSavedNote && (
            <div className="flex flex-col items-center gap-3 py-2">
              <CheckCircle2 className="h-10 w-10 text-vantage-success" />
              <div className="text-center">
                <p className="text-sm font-medium text-vantage-success">Voice note saved!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTime(lastSavedNote.duration_seconds)} at {formatTime(lastSavedNote.timestamp_seconds)}
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive mt-3 flex items-center gap-1.5">
            <MicOff className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
      </div>

      {/* Voice notes list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {voiceNotes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                <Mic className="h-8 w-8 opacity-50" />
              </div>
              <p className="text-sm font-medium mb-1">No voice notes yet</p>
              <p className="text-xs">Press the record button above to add your first note</p>
            </div>
          ) : (
            <div className="space-y-1">
              {voiceNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    {/* Large play button for accessibility */}
                    <Button
                      variant={playingId === note.id ? "secondary" : "ghost"}
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      onClick={() => handlePlayVoiceNote(note)}
                      aria-label={playingId === note.id ? "Pause voice note" : "Play voice note"}
                    >
                      {playingId === note.id ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5" fill="currentColor" />
                      )}
                    </Button>

                    <button
                      className="flex-1 text-left min-h-[44px] flex flex-col justify-center"
                      onClick={() => onVoiceNoteClick(note)}
                      aria-label={`Jump to voice note at ${formatTime(note.timestamp_seconds)}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-primary">
                          {formatTime(note.timestamp_seconds)}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {formatTime(note.duration_seconds)}
                        </Badge>
                      </div>
                      {note.transcription && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {note.transcription}
                        </p>
                      )}
                    </button>

                    {onVoiceNoteDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onVoiceNoteDelete(note.id)}
                        aria-label="Delete voice note"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
