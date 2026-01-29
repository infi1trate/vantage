import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { VoiceNote, createVoiceNote, uploadVoiceNote } from "@/lib/captures";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Play, Pause, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  const [saving, setSaving] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    setRecordingStartTime(currentTime);
    await startRecording();
  };

  const handleStopRecording = async () => {
    if (!user) return;

    const blob = await stopRecording();
    if (!blob) return;

    setSaving(true);
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

      onVoiceNoteCreated(voiceNote);
      toast.success("Voice note saved");
    } catch (err) {
      console.error("Error saving voice note:", err);
      toast.error("Failed to save voice note");
    } finally {
      setSaving(false);
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

  return (
    <Card className="flex flex-col h-full bg-card border-border/50">
      <div className="p-4 border-b border-border/50">
        <h3 className="font-semibold mb-3">Voice Notes</h3>

        {/* Recording control */}
        <div className="flex items-center gap-3">
          {isRecording ? (
            <>
              {/* Recording indicator */}
              <div className="flex items-center gap-2 flex-1">
                <span className="w-3 h-3 rounded-full bg-red-500 recording-pulse" />
                <span className="text-sm font-mono-data">
                  {formatTime(recordingDuration)}
                </span>
                <div className="flex items-center gap-0.5 h-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="waveform-bar h-4" />
                  ))}
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStopRecording}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <MicOff className="h-4 w-4 mr-1" />
                    Stop
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground flex-1">
                @ {formatTime(currentTime)}
              </span>
              <Button
                size="sm"
                onClick={handleStartRecording}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Mic className="h-4 w-4 mr-1" />
                Record
              </Button>
            </>
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive mt-2">{error}</p>
        )}
      </div>

      {/* Voice notes list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {voiceNotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mic className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No voice notes yet</p>
              <p className="text-xs">Click record to add</p>
            </div>
          ) : (
            <div className="space-y-1">
              {voiceNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handlePlayVoiceNote(note)}
                    >
                      {playingId === note.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" fill="currentColor" />
                      )}
                    </Button>

                    <button
                      className="flex-1 text-left"
                      onClick={() => onVoiceNoteClick(note)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono-data text-primary">
                          {formatTime(note.timestamp_seconds)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({formatTime(note.duration_seconds)})
                        </span>
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
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onVoiceNoteDelete(note.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
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
