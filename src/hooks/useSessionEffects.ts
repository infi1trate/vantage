/**
 * React hook for managing session effect metadata
 * 
 * Provides effect state management with auto-save and undo support.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  SessionEffects,
  FrameConfig,
  SFXConfig,
  VFXConfig,
  getSessionEffects,
  saveSessionEffects,
  createDefaultEffects,
  applyReelPackage,
  REEL_PACKAGES,
  DEFAULT_FRAME_CONFIG,
} from "@/lib/effectMetadataStore";

export interface UseSessionEffectsResult {
  /** Current effects state */
  effects: SessionEffects;
  /** Loading state */
  isLoading: boolean;
  /** Whether effects have been modified */
  isDirty: boolean;
  /** Update frame config */
  setFrame: (frame: Partial<FrameConfig>) => void;
  /** Add SFX instance */
  addSFX: (sfx: Omit<SFXConfig, "enabled">) => void;
  /** Update SFX by index */
  updateSFX: (index: number, sfx: Partial<SFXConfig>) => void;
  /** Remove SFX by index */
  removeSFX: (index: number) => void;
  /** Add VFX instance */
  addVFX: (vfx: Omit<VFXConfig, "enabled">) => void;
  /** Update VFX by index */
  updateVFX: (index: number, vfx: Partial<VFXConfig>) => void;
  /** Remove VFX by index */
  removeVFX: (index: number) => void;
  /** Apply a reel package */
  applyPackage: (packageId: string, moments?: Array<{ type: string; timestampSeconds: number; endTimestampSeconds?: number }>) => void;
  /** Reset to defaults */
  reset: () => void;
  /** Save changes */
  save: () => void;
  /** Undo last change */
  undo: () => void;
  /** Can undo */
  canUndo: boolean;
}

const MAX_HISTORY = 20;

export function useSessionEffects(sessionId: string | undefined): UseSessionEffectsResult {
  const [effects, setEffects] = useState<SessionEffects>(() => 
    sessionId ? getSessionEffects(sessionId) ?? createDefaultEffects(sessionId) : createDefaultEffects("")
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  
  // History for undo
  const historyRef = useRef<SessionEffects[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  
  // Load effects when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    const loaded = getSessionEffects(sessionId);
    setEffects(loaded ?? createDefaultEffects(sessionId));
    historyRef.current = [];
    setCanUndo(false);
    setIsDirty(false);
    setIsLoading(false);
  }, [sessionId]);
  
  // Push to history before making changes
  const pushHistory = useCallback(() => {
    historyRef.current.push({ ...effects });
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    setCanUndo(true);
  }, [effects]);
  
  const setFrame = useCallback((frame: Partial<FrameConfig>) => {
    pushHistory();
    setEffects((prev) => ({
      ...prev,
      frame: { ...prev.frame, ...frame },
    }));
    setIsDirty(true);
  }, [pushHistory]);
  
  const addSFX = useCallback((sfx: Omit<SFXConfig, "enabled">) => {
    pushHistory();
    setEffects((prev) => ({
      ...prev,
      sfx: [...prev.sfx, { ...sfx, enabled: true }],
    }));
    setIsDirty(true);
  }, [pushHistory]);
  
  const updateSFX = useCallback((index: number, sfx: Partial<SFXConfig>) => {
    pushHistory();
    setEffects((prev) => ({
      ...prev,
      sfx: prev.sfx.map((s, i) => (i === index ? { ...s, ...sfx } : s)),
    }));
    setIsDirty(true);
  }, [pushHistory]);
  
  const removeSFX = useCallback((index: number) => {
    pushHistory();
    setEffects((prev) => ({
      ...prev,
      sfx: prev.sfx.filter((_, i) => i !== index),
    }));
    setIsDirty(true);
  }, [pushHistory]);
  
  const addVFX = useCallback((vfx: Omit<VFXConfig, "enabled">) => {
    pushHistory();
    setEffects((prev) => ({
      ...prev,
      vfx: [...prev.vfx, { ...vfx, enabled: true }],
    }));
    setIsDirty(true);
  }, [pushHistory]);
  
  const updateVFX = useCallback((index: number, vfx: Partial<VFXConfig>) => {
    pushHistory();
    setEffects((prev) => ({
      ...prev,
      vfx: prev.vfx.map((v, i) => (i === index ? { ...v, ...vfx } : v)),
    }));
    setIsDirty(true);
  }, [pushHistory]);
  
  const removeVFX = useCallback((index: number) => {
    pushHistory();
    setEffects((prev) => ({
      ...prev,
      vfx: prev.vfx.filter((_, i) => i !== index),
    }));
    setIsDirty(true);
  }, [pushHistory]);
  
  const applyPackageHandler = useCallback((
    packageId: string,
    moments?: Array<{ type: string; timestampSeconds: number; endTimestampSeconds?: number }>
  ) => {
    pushHistory();
    setEffects((prev) => applyReelPackage(prev, packageId, moments));
    setIsDirty(true);
  }, [pushHistory]);
  
  const reset = useCallback(() => {
    if (!sessionId) return;
    pushHistory();
    setEffects(createDefaultEffects(sessionId));
    setIsDirty(true);
  }, [sessionId, pushHistory]);
  
  const save = useCallback(() => {
    if (!sessionId) return;
    saveSessionEffects(effects);
    setIsDirty(false);
  }, [sessionId, effects]);
  
  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const previous = historyRef.current.pop()!;
    setEffects(previous);
    setCanUndo(historyRef.current.length > 0);
    setIsDirty(true);
  }, []);
  
  // Auto-save with debounce
  useEffect(() => {
    if (!isDirty || !sessionId) return;
    
    const timeout = setTimeout(() => {
      saveSessionEffects(effects);
      setIsDirty(false);
    }, 1000);
    
    return () => clearTimeout(timeout);
  }, [effects, isDirty, sessionId]);
  
  return {
    effects,
    isLoading,
    isDirty,
    setFrame,
    addSFX,
    updateSFX,
    removeSFX,
    addVFX,
    updateVFX,
    removeVFX,
    applyPackage: applyPackageHandler,
    reset,
    save,
    undo,
    canUndo,
  };
}

export { REEL_PACKAGES, DEFAULT_FRAME_CONFIG };
