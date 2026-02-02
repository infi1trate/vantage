/**
 * AI Effect Suggestions Generator
 * 
 * Generates proposed VFX/SFX effects based on session metadata:
 * - Moments (kills, deaths, highlights)
 * - Audio intensity spikes (amplitude peaks)
 * - Clip boundary cuts (reel transitions)
 * 
 * IMPORTANT: This runs ONLY after recording ends or when user opens editor.
 * NEVER runs during capture to preserve performance.
 */

import { Annotation } from "@/lib/captures";
import { VFX_CATALOG, SFX_CATALOG, EffectType, EffectIntensity } from "@/lib/effectEvents";

export interface ProposedEffect {
  id: string; // Temporary ID for UI
  type: EffectType;
  key: string;
  name: string;
  startTimeMs: number;
  durationMs: number;
  intensity?: EffectIntensity;
  volume?: number;
  reason: "moment" | "audioPeak" | "clipBoundary";
  reasonLabel: string;
  enabled: boolean; // Toggle in review list
}

interface SuggestionContext {
  annotations: Annotation[];
  durationMs: number;
  audioPeaks?: number[]; // Timestamps in ms of detected audio peaks
  clipBoundaries?: number[]; // Timestamps in ms of clip cuts
}

// Clamp: max 6 effects per minute of video
const MAX_EFFECTS_PER_MINUTE = 6;

// Effect selection rules based on moment type
const MOMENT_EFFECT_RULES: Record<string, { vfx: string[]; sfx: string[] }> = {
  kill: {
    vfx: ["zoomPunch", "hitmarker", "screenShake"],
    sfx: ["hitmarkerSfx", "bassDrop", "boom"],
  },
  death: {
    vfx: ["vignette", "glitchCut", "flashBang"],
    sfx: ["oof", "bruh", "reverseHit"],
  },
  highlight: {
    vfx: ["freezeFrame", "slowZoom", "zoomPunch"],
    sfx: ["crowdCheer", "bassDrop", "riseFx"],
  },
  streak: {
    vfx: ["colorPop", "slowZoom"],
    sfx: ["crowdCheer", "airhorn"],
  },
};

// Weights for different sources (higher = more likely to be included)
const SOURCE_WEIGHTS = {
  moment: 1.0,
  audioPeak: 0.6,
  clipBoundary: 0.8,
};

/**
 * Generate a unique temporary ID for proposed effects
 */
function generateTempId(): string {
  return `proposed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Pick a random element from an array
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get VFX/SFX definitions by key
 */
function getEffectName(type: EffectType, key: string): string {
  if (type === "vfx") {
    return VFX_CATALOG.find(v => v.key === key)?.name || key;
  }
  return SFX_CATALOG.find(s => s.key === key)?.name || key;
}

function getEffectDuration(type: EffectType, key: string): number {
  if (type === "vfx") {
    return VFX_CATALOG.find(v => v.key === key)?.defaultDurationMs || 300;
  }
  return SFX_CATALOG.find(s => s.key === key)?.defaultDurationMs || 300;
}

/**
 * Generate proposed effects from moments (kills, deaths, highlights)
 */
function generateMomentEffects(annotations: Annotation[]): ProposedEffect[] {
  const effects: ProposedEffect[] = [];
  
  const relevantMoments = annotations.filter(a => 
    ["kill", "death", "highlight", "streak"].includes(a.annotation_type)
  );
  
  for (const moment of relevantMoments) {
    const rules = MOMENT_EFFECT_RULES[moment.annotation_type] || MOMENT_EFFECT_RULES.highlight;
    const startTimeMs = moment.timestamp_seconds * 1000;
    
    // Pick one VFX and one SFX per moment
    const vfxKey = pickRandom(rules.vfx);
    const sfxKey = pickRandom(rules.sfx);
    
    effects.push({
      id: generateTempId(),
      type: "vfx",
      key: vfxKey,
      name: getEffectName("vfx", vfxKey),
      startTimeMs,
      durationMs: getEffectDuration("vfx", vfxKey),
      intensity: "med",
      reason: "moment",
      reasonLabel: `${moment.annotation_type} moment`,
      enabled: true,
    });
    
    effects.push({
      id: generateTempId(),
      type: "sfx",
      key: sfxKey,
      name: getEffectName("sfx", sfxKey),
      startTimeMs,
      durationMs: getEffectDuration("sfx", sfxKey),
      volume: 70,
      reason: "moment",
      reasonLabel: `${moment.annotation_type} moment`,
      enabled: true,
    });
  }
  
  return effects;
}

/**
 * Generate proposed effects from audio peaks
 */
function generateAudioPeakEffects(audioPeaks: number[]): ProposedEffect[] {
  const effects: ProposedEffect[] = [];
  
  // Only use top peaks, avoid overload
  const limitedPeaks = audioPeaks.slice(0, 10);
  
  for (const peakMs of limitedPeaks) {
    // Audio peaks get subtle emphasis effects
    const vfxOptions = ["vignette", "colorPop"];
    const sfxOptions = ["whoosh", "riseFx"];
    
    const vfxKey = pickRandom(vfxOptions);
    const sfxKey = pickRandom(sfxOptions);
    
    effects.push({
      id: generateTempId(),
      type: "vfx",
      key: vfxKey,
      name: getEffectName("vfx", vfxKey),
      startTimeMs: peakMs,
      durationMs: getEffectDuration("vfx", vfxKey),
      intensity: "low",
      reason: "audioPeak",
      reasonLabel: "Audio peak",
      enabled: false, // Disabled by default, user can enable
    });
    
    // Only add SFX for some peaks
    if (Math.random() > 0.5) {
      effects.push({
        id: generateTempId(),
        type: "sfx",
        key: sfxKey,
        name: getEffectName("sfx", sfxKey),
        startTimeMs: peakMs,
        durationMs: getEffectDuration("sfx", sfxKey),
        volume: 50,
        reason: "audioPeak",
        reasonLabel: "Audio peak",
        enabled: false,
      });
    }
  }
  
  return effects;
}

/**
 * Generate proposed effects for clip boundaries
 */
function generateClipBoundaryEffects(clipBoundaries: number[]): ProposedEffect[] {
  const effects: ProposedEffect[] = [];
  
  for (const boundaryMs of clipBoundaries) {
    const transitionVfx = ["whipPan", "glitchCut"];
    const vfxKey = pickRandom(transitionVfx);
    
    effects.push({
      id: generateTempId(),
      type: "vfx",
      key: vfxKey,
      name: getEffectName("vfx", vfxKey),
      startTimeMs: boundaryMs,
      durationMs: getEffectDuration("vfx", vfxKey),
      intensity: "med",
      reason: "clipBoundary",
      reasonLabel: "Clip transition",
      enabled: true,
    });
    
    // Add whoosh SFX for transitions
    effects.push({
      id: generateTempId(),
      type: "sfx",
      key: "whoosh",
      name: getEffectName("sfx", "whoosh"),
      startTimeMs: boundaryMs,
      durationMs: getEffectDuration("sfx", "whoosh"),
      volume: 60,
      reason: "clipBoundary",
      reasonLabel: "Clip transition",
      enabled: true,
    });
  }
  
  return effects;
}

/**
 * Filter and clamp effects to respect density limits
 */
function clampEffectDensity(effects: ProposedEffect[], durationMs: number): ProposedEffect[] {
  const maxEffects = Math.ceil((durationMs / 60000) * MAX_EFFECTS_PER_MINUTE);
  
  if (effects.length <= maxEffects) {
    return effects;
  }
  
  // Sort by priority: moments > clipBoundary > audioPeak, then by time
  const sorted = [...effects].sort((a, b) => {
    const weightA = SOURCE_WEIGHTS[a.reason];
    const weightB = SOURCE_WEIGHTS[b.reason];
    if (weightA !== weightB) return weightB - weightA;
    return a.startTimeMs - b.startTimeMs;
  });
  
  // Take top effects, respecting the limit
  return sorted.slice(0, maxEffects);
}

/**
 * Remove duplicate effects at the same timestamp
 */
function deduplicateEffects(effects: ProposedEffect[]): ProposedEffect[] {
  const seen = new Map<string, ProposedEffect>();
  
  for (const effect of effects) {
    // Key by type + approximate timestamp (within 200ms)
    const bucket = Math.floor(effect.startTimeMs / 200);
    const key = `${effect.type}_${bucket}`;
    
    if (!seen.has(key) || SOURCE_WEIGHTS[effect.reason] > SOURCE_WEIGHTS[seen.get(key)!.reason]) {
      seen.set(key, effect);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Main function: Generate AI effect suggestions for a session
 * 
 * @param context - Session metadata including annotations, duration, audio peaks, clip boundaries
 * @returns Array of proposed effects for user review
 */
export function generateEffectSuggestions(context: SuggestionContext): ProposedEffect[] {
  const { annotations, durationMs, audioPeaks = [], clipBoundaries = [] } = context;
  
  // Generate effects from each source
  const momentEffects = generateMomentEffects(annotations);
  const peakEffects = generateAudioPeakEffects(audioPeaks);
  const boundaryEffects = generateClipBoundaryEffects(clipBoundaries);
  
  // Combine all effects
  let allEffects = [...momentEffects, ...peakEffects, ...boundaryEffects];
  
  // Deduplicate overlapping effects
  allEffects = deduplicateEffects(allEffects);
  
  // Sort by time
  allEffects.sort((a, b) => a.startTimeMs - b.startTimeMs);
  
  // Clamp to max density
  allEffects = clampEffectDensity(allEffects, durationMs);
  
  return allEffects;
}

/**
 * Simple audio peak detection from waveform data
 * This is a lightweight client-side analysis, not heavy ML inference
 */
export function detectAudioPeaks(
  waveformData: number[], 
  durationMs: number,
  threshold: number = 0.7
): number[] {
  if (!waveformData.length) return [];
  
  const peaks: number[] = [];
  const msPerSample = durationMs / waveformData.length;
  const minGapMs = 1000; // Minimum 1 second between peaks
  
  let lastPeakMs = -minGapMs;
  
  for (let i = 1; i < waveformData.length - 1; i++) {
    const prev = waveformData[i - 1];
    const curr = waveformData[i];
    const next = waveformData[i + 1];
    
    // Local maximum above threshold
    if (curr > prev && curr > next && curr >= threshold) {
      const peakMs = i * msPerSample;
      
      if (peakMs - lastPeakMs >= minGapMs) {
        peaks.push(Math.round(peakMs));
        lastPeakMs = peakMs;
      }
    }
  }
  
  return peaks;
}
