/**
 * Unified Reel Editor History Stack
 * 
 * Command-based undo/redo that works across all editor edit types:
 * - Effect add/update/delete (delegated from useEffectsTimeline)
 * - Clip trim changes (one entry per completed drag)
 * - Frame/Package selection changes (future)
 * - Clip reorder/delete (future)
 * 
 * In-memory only — does not persist across refresh.
 * Each command stores an undo() and redo() function.
 */

import { useState, useCallback, useRef } from "react";

const MAX_HISTORY = 50;

export type EditCommandType = 
  | "effect_create"
  | "effect_update"
  | "effect_delete"
  | "effect_batch"
  | "trim_change"
  | "frame_change"
  | "package_change"
  | "clip_reorder"
  | "clip_delete";

export interface EditCommand {
  type: EditCommandType;
  /** Human-readable label for dev/debug */
  label: string;
  /** Execute the undo — restore previous state */
  undo: () => void;
  /** Execute the redo — re-apply the change */
  redo: () => void;
}

export interface UseReelEditorHistoryResult {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Execute undo */
  undo: () => void;
  /** Execute redo */
  redo: () => void;
  /** Push a new command onto the history stack */
  pushCommand: (command: EditCommand) => void;
  /** Number of items in the undo stack */
  undoCount: number;
  /** Number of items in the redo stack */
  redoCount: number;
}

export function useReelEditorHistory(): UseReelEditorHistoryResult {
  // Use refs for the stacks to avoid unnecessary re-renders on every push
  const undoStackRef = useRef<EditCommand[]>([]);
  const redoStackRef = useRef<EditCommand[]>([]);
  // Counter state to trigger re-renders when stack sizes change
  const [revision, setRevision] = useState(0);

  const pushCommand = useCallback((command: EditCommand) => {
    undoStackRef.current.push(command);
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift();
    }
    // Clear redo stack on new action
    redoStackRef.current = [];
    setRevision((r) => r + 1);
    console.log(`[EditorHistory] Push: ${command.type} — "${command.label}"`);
  }, []);

  const undo = useCallback(() => {
    const command = undoStackRef.current.pop();
    if (!command) return;

    try {
      command.undo();
      redoStackRef.current.push(command);
      console.log(`[EditorHistory] Undo: ${command.type} — "${command.label}"`);
    } catch (err) {
      console.error("[EditorHistory] Undo failed:", err);
    }
    setRevision((r) => r + 1);
  }, []);

  const redo = useCallback(() => {
    const command = redoStackRef.current.pop();
    if (!command) return;

    try {
      command.redo();
      undoStackRef.current.push(command);
      console.log(`[EditorHistory] Redo: ${command.type} — "${command.label}"`);
    } catch (err) {
      console.error("[EditorHistory] Redo failed:", err);
    }
    setRevision((r) => r + 1);
  }, []);

  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    pushCommand,
    undoCount: undoStackRef.current.length,
    redoCount: redoStackRef.current.length,
  };
}
