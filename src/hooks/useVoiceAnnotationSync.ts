import { useState, useRef, useEffect, useCallback } from "react";
import { VoiceNote } from "@/lib/captures";

interface UseVoiceAnnotationSyncOptions {
  voiceNotes: VoiceNote[];
  currentTime: number;
  isVideoPlaying: boolean;
  enabled?: boolean;
}

interface UseVoiceAnnotationSyncReturn {
  activeVoiceNote: VoiceNote | null;
  isPlayingVoiceNote: boolean;
  playVoiceNote: (voiceNote: VoiceNote) => void;
  stopVoiceNote: () => void;
  setEnabled: (enabled: boolean) => void;
}

export function useVoiceAnnotationSync({
  voiceNotes,
  currentTime,
  isVideoPlaying,
  enabled = true,
}: UseVoiceAnnotationSyncOptions): UseVoiceAnnotationSyncReturn {
  const [activeVoiceNote, setActiveVoiceNote] = useState<VoiceNote | null>(null);
  const [isPlayingVoiceNote, setIsPlayingVoiceNote] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(enabled);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playedNotesRef = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef(0);

  // Check if we should play a voice note based on current time
  useEffect(() => {
    if (!syncEnabled || !isVideoPlaying) return;

    // Detect if we're seeking (large time jump)
    const timeDelta = Math.abs(currentTime - lastTimeRef.current);
    const isSeeking = timeDelta > 0.5;
    lastTimeRef.current = currentTime;

    // If seeking, reset played notes for notes we've passed
    if (isSeeking) {
      const newPlayedNotes = new Set<string>();
      voiceNotes.forEach((note) => {
        // Keep notes that are before the current time
        if (note.timestamp_seconds + note.duration_seconds < currentTime) {
          newPlayedNotes.add(note.id);
        }
      });
      playedNotesRef.current = newPlayedNotes;
    }

    // Find voice note that should start playing
    const noteToPlay = voiceNotes.find((note) => {
      const startTime = note.timestamp_seconds;
      const endTime = startTime + note.duration_seconds;
      const isInRange = currentTime >= startTime && currentTime < endTime;
      const notPlayed = !playedNotesRef.current.has(note.id);
      return isInRange && notPlayed;
    });

    if (noteToPlay && !activeVoiceNote) {
      playVoiceNote(noteToPlay);
    }
  }, [currentTime, isVideoPlaying, syncEnabled, voiceNotes, activeVoiceNote]);

  // Stop voice note when video stops
  useEffect(() => {
    if (!isVideoPlaying && isPlayingVoiceNote) {
      pauseAudio();
    }
  }, [isVideoPlaying, isPlayingVoiceNote]);

  // Resume voice note when video resumes
  useEffect(() => {
    if (isVideoPlaying && activeVoiceNote && !isPlayingVoiceNote) {
      resumeAudio();
    }
  }, [isVideoPlaying, activeVoiceNote, isPlayingVoiceNote]);

  const playVoiceNote = useCallback((voiceNote: VoiceNote) => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(voiceNote.audio_url);
    
    // Calculate offset based on current video time
    const offset = Math.max(0, currentTime - voiceNote.timestamp_seconds);
    if (offset > 0) {
      audio.currentTime = offset;
    }

    audio.onended = () => {
      setActiveVoiceNote(null);
      setIsPlayingVoiceNote(false);
      playedNotesRef.current.add(voiceNote.id);
      audioRef.current = null;
    };

    audio.onerror = () => {
      console.error("Error playing voice note:", voiceNote.id);
      setActiveVoiceNote(null);
      setIsPlayingVoiceNote(false);
      audioRef.current = null;
    };

    audio.play().catch((error) => {
      console.error("Failed to play voice note:", error);
    });

    audioRef.current = audio;
    setActiveVoiceNote(voiceNote);
    setIsPlayingVoiceNote(true);
  }, [currentTime]);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingVoiceNote(false);
    }
  }, []);

  const resumeAudio = useCallback(() => {
    if (audioRef.current && activeVoiceNote) {
      audioRef.current.play().catch(console.error);
      setIsPlayingVoiceNote(true);
    }
  }, [activeVoiceNote]);

  const stopVoiceNote = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setActiveVoiceNote(null);
    setIsPlayingVoiceNote(false);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setSyncEnabled(enabled);
    if (!enabled) {
      stopVoiceNote();
    }
  }, [stopVoiceNote]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    activeVoiceNote,
    isPlayingVoiceNote,
    playVoiceNote,
    stopVoiceNote,
    setEnabled,
  };
}
