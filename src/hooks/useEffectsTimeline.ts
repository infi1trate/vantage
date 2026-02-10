/**
 * Effects Timeline Hook
 * 
 * Container hook that manages effects state for a session,
 * including drag-and-drop, snapping, undo/redo, smart pairing, and AI suggestions.
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { EffectEvent, EffectType, SnapSource } from "@/lib/effectEvents";
import {
  useSessionEffectEvents,
  useCreateEffectEvent,
  useUpdateEffectEvent,
  useDeleteEffectEvent,
  useDuplicateEffectEvent,
  useBatchCreateEffects,
} from "@/hooks/useEffectEvents";
import { SnapSettings, showSmartPairingToast } from "@/components/player/effects";
import { Annotation } from "@/lib/captures";
import { generateEffectSuggestions, ProposedEffect } from "@/lib/effectSuggestions";

interface UseEffectsTimelineOptions {
  sessionId: string | undefined;
  annotations?: Annotation[];
  duration: number;
  audioPeaks?: number[];
  clipBoundaries?: number[];
  /** External history push — when provided, effects undo/redo delegates to the unified stack */
  onHistoryPush?: (command: import("@/hooks/useReelEditorHistory").EditCommand) => void;
}

interface UseEffectsTimelineResult {
  // Effects data
  effects: EffectEvent[];
  isLoading: boolean;
  
  // Drag state
  isDragging: boolean;
  dragEffectKey: string | null;
  dragEffectType: EffectType | null;
  
  // Snap settings
  snapSettings: SnapSettings;
  setSnapSettings: (settings: SnapSettings) => void;
  
  // Drag handlers
  handleDragStart: (e: React.DragEvent, effectKey: string, type: EffectType) => void;
  handleDragEnd: () => void;
  handleDrop: (effectKey: string, type: EffectType, startTimeMs: number) => void;
  
  // Effect CRUD
  handleEffectUpdate: (effectId: string, updates: Partial<EffectEvent>) => void;
  handleEffectDelete: (effectId: string) => void;
  handleEffectDuplicate: (effectId: string, newStartTimeMs: number) => void;
  
  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  
  // Auto-enhance / AI suggestions
  proposedEffects: ProposedEffect[];
  isAutoEnhancing: boolean;
  generateSuggestions: () => void;
  applyProposedEffects: (effects: ProposedEffect[]) => void;
  applyAllProposedEffects: () => void;
}

interface HistoryEntry {
  action: "create" | "update" | "delete";
  effectId: string;
  previousState?: Partial<EffectEvent>;
  effectData?: Partial<EffectEvent>;
}

const MAX_HISTORY = 30;

export function useEffectsTimeline({
  sessionId,
  annotations = [],
  duration,
  audioPeaks = [],
  clipBoundaries = [],
  onHistoryPush,
}: UseEffectsTimelineOptions): UseEffectsTimelineResult {
  // Query effects
  const { data: effects = [], isLoading } = useSessionEffectEvents(sessionId);
  
  // Mutations
  const createMutation = useCreateEffectEvent();
  const updateMutation = useUpdateEffectEvent();
  const deleteMutation = useDeleteEffectEvent();
  const duplicateMutation = useDuplicateEffectEvent();
  const batchCreateMutation = useBatchCreateEffects();
  
  // Local state
  const [isDragging, setIsDragging] = useState(false);
  const [dragEffectKey, setDragEffectKey] = useState<string | null>(null);
  const [dragEffectType, setDragEffectType] = useState<EffectType | null>(null);
  const [snapSettings, setSnapSettings] = useState<SnapSettings>({
    snapToMoments: true,
    snapToAudioPeaks: false,
  });
  
  // Undo/Redo history
  const historyRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const canUndo = historyRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;
  
  // Auto-enhance state
  const [proposedEffects, setProposedEffects] = useState<ProposedEffect[]>([]);
  const [isAutoEnhancing, setIsAutoEnhancing] = useState(false);
  
  // Snap time to nearest moment if enabled
  const snapToMoments = useCallback((timeMs: number): { timeMs: number; snapSource: SnapSource; snappedToId?: string } => {
    if (!snapSettings.snapToMoments || annotations.length === 0) {
      return { timeMs, snapSource: "manual" };
    }
    
    const SNAP_THRESHOLD_MS = 500; // Snap within 500ms
    
    let closestMoment: Annotation | null = null;
    let closestDistance = Infinity;
    
    for (const annotation of annotations) {
      if (!["kill", "death", "highlight"].includes(annotation.annotation_type)) continue;
      
      const momentTimeMs = annotation.timestamp_seconds * 1000;
      const distance = Math.abs(timeMs - momentTimeMs);
      
      if (distance < closestDistance && distance <= SNAP_THRESHOLD_MS) {
        closestDistance = distance;
        closestMoment = annotation;
      }
    }
    
    if (closestMoment) {
      return {
        timeMs: closestMoment.timestamp_seconds * 1000,
        snapSource: "moment",
        snappedToId: closestMoment.id,
      };
    }
    
    return { timeMs, snapSource: "manual" };
  }, [snapSettings.snapToMoments, annotations]);
  
  // Push to local history
  const pushHistory = useCallback((entry: HistoryEntry) => {
    historyRef.current.push(entry);
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    redoStackRef.current = [];
    setHistoryIndex(historyRef.current.length);
  }, []);

  // Execute undo/redo for a single history entry (shared logic)
  const executeUndoRef = useRef<(entry: HistoryEntry) => void>(() => {});
  const executeRedoRef = useRef<(entry: HistoryEntry) => void>(() => {});

  /**
   * Push to unified history when available, otherwise just local.
   */
  const pushToHistory = useCallback((entry: HistoryEntry, label: string) => {
    pushHistory(entry);
    
    if (onHistoryPush) {
      // Capture the entry for the unified command closures
      const capturedEntry = { ...entry };
      onHistoryPush({
        type: (entry.action === "create" ? "effect_create" 
          : entry.action === "update" ? "effect_update" 
          : "effect_delete") as any,
        label,
        undo: () => executeUndoRef.current(capturedEntry),
        redo: () => executeRedoRef.current(capturedEntry),
      });
    }
  }, [pushHistory, onHistoryPush]);
  
  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, effectKey: string, type: EffectType) => {
    setIsDragging(true);
    setDragEffectKey(effectKey);
    setDragEffectType(type);
    
    // Set drag data
    e.dataTransfer.setData("effect/key", effectKey);
    e.dataTransfer.setData("effect/type", type);
    e.dataTransfer.effectAllowed = "copy";
  }, []);
  
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragEffectKey(null);
    setDragEffectType(null);
  }, []);
  
  const handleDrop = useCallback((effectKey: string, type: EffectType, startTimeMs: number) => {
    if (!sessionId) return;
    
    // Apply snapping
    const snapped = snapToMoments(startTimeMs);
    
    createMutation.mutate({
      sessionId,
      type,
      key: effectKey,
      startTimeMs: snapped.timeMs,
      snapSource: snapped.snapSource,
      snappedToId: snapped.snappedToId,
    }, {
      onSuccess: (data) => {
        if (data) {
          pushToHistory({
            action: "create",
            effectId: data.id,
            effectData: data,
          }, `Add ${effectKey} effect`);
          
          // Show smart pairing toast for VFX effects
          if (type === "vfx") {
            showSmartPairingToast({
              effectId: data.id,
              vfxKey: effectKey,
              startTimeMs: snapped.timeMs,
              onApply: (sfxKey, sfxStartTimeMs) => {
                createMutation.mutate({
                  sessionId,
                  type: "sfx",
                  key: sfxKey,
                  startTimeMs: sfxStartTimeMs,
                  snapSource: "manual",
                });
              },
            });
          }
        }
      },
    });
    
    handleDragEnd();
  }, [sessionId, snapToMoments, createMutation, pushToHistory, handleDragEnd]);
  
  // Effect CRUD handlers
  const handleEffectUpdate = useCallback((effectId: string, updates: Partial<EffectEvent>) => {
    if (!sessionId) return;
    
    const current = effects.find(e => e.id === effectId);
    if (current) {
      pushToHistory({
        action: "update",
        effectId,
        previousState: current,
      }, `Update effect`);
    }
    
    updateMutation.mutate({
      eventId: effectId,
      sessionId,
      updates,
    });
  }, [sessionId, effects, updateMutation, pushToHistory]);
  
  const handleEffectDelete = useCallback((effectId: string) => {
    if (!sessionId) return;
    
    const current = effects.find(e => e.id === effectId);
    if (current) {
      pushToHistory({
        action: "delete",
        effectId,
        effectData: current,
      }, `Delete effect`);
    }
    
    deleteMutation.mutate({ eventId: effectId, sessionId });
  }, [sessionId, effects, deleteMutation, pushToHistory]);
  
  const handleEffectDuplicate = useCallback((effectId: string, newStartTimeMs: number) => {
    if (!sessionId) return;
    
    duplicateMutation.mutate({
      eventId: effectId,
      sessionId,
      newStartTimeMs,
    }, {
      onSuccess: (data) => {
        if (data) {
          pushToHistory({
            action: "create",
            effectId: data.id,
            effectData: data,
          }, `Duplicate effect`);
        }
      },
    });
  }, [sessionId, duplicateMutation, pushToHistory]);
  
  // Execute undo/redo for a single history entry (shared logic)
  const executeUndo = useCallback((entry: HistoryEntry) => {
    if (!sessionId) return;
    switch (entry.action) {
      case "create":
        deleteMutation.mutate({ eventId: entry.effectId, sessionId });
        break;
      case "update":
        if (entry.previousState) {
          updateMutation.mutate({
            eventId: entry.effectId,
            sessionId,
            updates: entry.previousState,
          });
        }
        break;
      case "delete":
        if (entry.effectData) {
          createMutation.mutate({
            sessionId,
            type: entry.effectData.type!,
            key: entry.effectData.key!,
            startTimeMs: entry.effectData.start_time_ms!,
            durationMs: entry.effectData.duration_ms,
            intensity: entry.effectData.intensity ?? undefined,
            volume: entry.effectData.volume ?? undefined,
            snapSource: entry.effectData.snap_source ?? undefined,
            snappedToId: entry.effectData.snapped_to_id ?? undefined,
          });
        }
        break;
    }
  }, [sessionId, createMutation, updateMutation, deleteMutation]);

  // Keep refs in sync for unified history closures
  executeUndoRef.current = executeUndo;

  const executeRedo = useCallback((entry: HistoryEntry) => {
    if (!sessionId) return;
    switch (entry.action) {
      case "create":
        if (entry.effectData) {
          createMutation.mutate({
            sessionId,
            type: entry.effectData.type!,
            key: entry.effectData.key!,
            startTimeMs: entry.effectData.start_time_ms!,
            durationMs: entry.effectData.duration_ms,
            intensity: entry.effectData.intensity ?? undefined,
            volume: entry.effectData.volume ?? undefined,
          });
        }
        break;
      case "update":
        break;
      case "delete":
        deleteMutation.mutate({ eventId: entry.effectId, sessionId });
        break;
    }
  }, [sessionId, createMutation, deleteMutation]);

  // Keep refs in sync for unified history closures
  executeRedoRef.current = executeRedo;
  const undo = useCallback(() => {
    if (!canUndo || !sessionId) return;
    
    const entry = historyRef.current.pop();
    if (!entry) return;
    
    setHistoryIndex(historyRef.current.length);
    redoStackRef.current.push(entry);
    executeUndo(entry);
  }, [canUndo, sessionId, executeUndo]);
  
  const redo = useCallback(() => {
    if (!canRedo || !sessionId) return;
    
    const entry = redoStackRef.current.pop();
    if (!entry) return;
    
    historyRef.current.push(entry);
    setHistoryIndex(historyRef.current.length);
    executeRedo(entry);
  }, [canRedo, sessionId, executeRedo]);
  
  // Auto-enhance: Generate AI suggestions
  const generateSuggestions = useCallback(() => {
    if (!sessionId) return;
    
    setIsAutoEnhancing(true);
    
    // Simulate brief delay for UX, then generate client-side
    setTimeout(() => {
      const suggestions = generateEffectSuggestions({
        annotations,
        durationMs: duration * 1000,
        audioPeaks,
        clipBoundaries,
      });
      
      setProposedEffects(suggestions);
      setIsAutoEnhancing(false);
    }, 500);
  }, [sessionId, annotations, duration, audioPeaks, clipBoundaries]);
  
  // Apply selected proposed effects
  const applyProposedEffects = useCallback((effectsToApply: ProposedEffect[]) => {
    if (!sessionId || effectsToApply.length === 0) return;
    
    // Batch create effects
    const effectData = effectsToApply.map(e => ({
      type: e.type,
      key: e.key,
      startTimeMs: e.startTimeMs,
      durationMs: e.durationMs,
      intensity: e.intensity,
      volume: e.volume,
      snapSource: e.reason as "moment" | "audioPeak" | "manual",
    }));
    
    batchCreateMutation.mutate({
      sessionId,
      effects: effectData,
    });
    
    // Clear proposals after applying
    setProposedEffects([]);
  }, [sessionId, batchCreateMutation]);
  
  // Apply all proposed effects
  const applyAllProposedEffects = useCallback(() => {
    applyProposedEffects(proposedEffects);
  }, [proposedEffects, applyProposedEffects]);
  
  return {
    effects,
    isLoading,
    isDragging,
    dragEffectKey,
    dragEffectType,
    snapSettings,
    setSnapSettings,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleEffectUpdate,
    handleEffectDelete,
    handleEffectDuplicate,
    canUndo,
    canRedo,
    undo,
    redo,
    proposedEffects,
    isAutoEnhancing,
    generateSuggestions,
    applyProposedEffects,
    applyAllProposedEffects,
  };
}
