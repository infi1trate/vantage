/**
 * AI Generation Pipeline
 * 
 * Generates Frame variants and Reel Package assets using deterministic template
 * generation. Designed to be swapped for real AI model calls without changing UI.
 * 
 * SAFETY GUARDRAILS:
 * - Hard clamp animation lengths (5-10s)
 * - Never generate flashing/high-epilepsy patterns
 * - Default to subtle pro; meme is opt-in
 * - Keep assets lightweight (no particle sims)
 * 
 * ARCHITECTURE:
 * - Only runs AFTER recording or on explicit Generate click
 * - Never runs during capture
 * - Async with progress tracking
 */

import { 
  StyleKey, 
  AudioMode, 
  EnergyProfile, 
  DEFAULT_ENERGY_PROFILE,
} from "./reelPackageConfig";
import { 
  FrameStyleParams, 
  FrameLayoutParams, 
  DEFAULT_STYLE_PARAMS, 
  DEFAULT_LAYOUT_PARAMS,
  PositionAnchor,
  FrameShape,
} from "./frameOverlays";

// ============= Types =============

export interface GenerationInputs {
  /** Selected style key */
  styleKey: StyleKey;
  /** Game name for theme matching */
  gameName?: string;
  /** Mood: calm, intense, chaotic, etc. */
  mood?: "calm" | "balanced" | "intense" | "chaotic";
  /** Playstyle: aggressive, tactical, support */
  playstyle?: "aggressive" | "tactical" | "support" | "balanced";
  /** Energy profile computed from audio/cuts */
  energyProfile: EnergyProfile;
  /** Session duration in seconds */
  durationSeconds?: number;
  /** Number of clips/moments */
  clipCount?: number;
}

export interface FrameVariant {
  id: string;
  name: string;
  style_params: FrameStyleParams;
  layout_params: FrameLayoutParams;
  confidence: number; // 0-1 how well it matches inputs
  tags: string[];
}

export interface ReelAssetTemplate {
  id: string;
  type: "intro" | "outro" | "transition";
  name: string;
  durationMs: number; // Clamped 5000-10000
  styleKey: StyleKey;
  /** Template params for later rendering */
  params: {
    colorTheme: string;
    textOverlay?: string;
    animationType: "fade" | "slide" | "zoom" | "wipe" | "glitch";
    animationSpeed: "slow" | "normal" | "fast";
    intensity: number; // 0-1, clamped for safety
  };
}

export interface GenerationResult {
  /** Generated frame variants (3-6) */
  frameVariants: FrameVariant[];
  /** Intro asset template */
  introTemplate?: ReelAssetTemplate;
  /** Outro asset template */
  outroTemplate?: ReelAssetTemplate;
  /** Transition templates */
  transitionTemplates: ReelAssetTemplate[];
  /** Generation metadata */
  metadata: {
    generatedAt: string;
    model: string;
    inputHash: string;
    processingTimeMs: number;
  };
}

export type GenerationProgress = {
  stage: "analyzing" | "generating_frames" | "generating_assets" | "finalizing";
  progress: number; // 0-100
  message: string;
};

// ============= Constants & Guardrails =============

const MIN_ANIMATION_DURATION_MS = 5000;
const MAX_ANIMATION_DURATION_MS = 10000;
const MAX_INTENSITY = 0.8; // Never exceed for safety
const MAX_GLOW_INTENSITY = 0.7; // Avoid epilepsy triggers
const MAX_FRAME_VARIANTS = 6;
const MIN_FRAME_VARIANTS = 3;

// Style-specific intensity caps (meme is opt-in and still capped)
const STYLE_INTENSITY_CAPS: Record<StyleKey, number> = {
  auto: 0.6,
  minimalPro: 0.4,
  cinematic: 0.5,
  meme: 0.75, // Higher but still capped
  neon: 0.65,
  retro: 0.55,
  hype: 0.7,
};

// ============= Template Definitions =============

const COLOR_THEMES: Record<StyleKey, string[]> = {
  auto: ["primary", "accent", "muted"],
  minimalPro: ["white", "gray-200", "gray-400"],
  cinematic: ["blue-900", "gray-900", "amber-500"],
  meme: ["yellow-400", "pink-500", "green-400", "orange-500"],
  neon: ["neon-pink", "neon-cyan", "neon-purple", "neon-green"],
  retro: ["retro-green", "retro-amber", "retro-orange"],
  hype: ["red-500", "orange-500", "yellow-400", "primary"],
};

const SHAPE_BY_STYLE: Record<StyleKey, FrameShape[]> = {
  auto: ["rounded", "circle"],
  minimalPro: ["rounded", "circle", "pill"],
  cinematic: ["rounded", "pill"],
  meme: ["rounded", "square", "hex"],
  neon: ["circle", "hex", "rounded"],
  retro: ["square", "rounded"],
  hype: ["hex", "rounded", "circle"],
};

const ANIMATION_TYPES_BY_STYLE: Record<StyleKey, ReelAssetTemplate["params"]["animationType"][]> = {
  auto: ["fade", "slide"],
  minimalPro: ["fade", "slide"],
  cinematic: ["fade", "zoom"],
  meme: ["glitch", "wipe", "zoom"],
  neon: ["fade", "glitch", "slide"],
  retro: ["wipe", "slide"],
  hype: ["zoom", "glitch", "slide"],
};

const POSITION_ANCHORS: PositionAnchor[] = [
  "bottom-right", "bottom-left", "top-right", "top-left",
];

// ============= Utility Functions =============

function generateId(): string {
  return `gen_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function hashInputs(inputs: GenerationInputs): string {
  const str = JSON.stringify({
    styleKey: inputs.styleKey,
    gameName: inputs.gameName,
    mood: inputs.mood,
    playstyle: inputs.playstyle,
    energyProfile: inputs.energyProfile,
  });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function pick<T>(arr: T[], seed: number = Math.random()): T {
  return arr[Math.floor(seed * arr.length)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeIntensity(energy: EnergyProfile, style: StyleKey): number {
  const baseIntensity = (energy.paceScore + energy.loudnessScore + energy.cutScore) / 300;
  const cap = STYLE_INTENSITY_CAPS[style] || MAX_INTENSITY;
  return clamp(baseIntensity * 1.2, 0.2, cap);
}

function computeAnimationSpeed(energy: EnergyProfile): "slow" | "normal" | "fast" {
  const avg = (energy.paceScore + energy.cutScore) / 2;
  if (avg < 35) return "slow";
  if (avg > 65) return "fast";
  return "normal";
}

function computeDuration(energy: EnergyProfile, type: "intro" | "outro" | "transition"): number {
  // Transitions are shorter
  const baseMax = type === "transition" ? 3000 : MAX_ANIMATION_DURATION_MS;
  const baseMin = type === "transition" ? 1000 : MIN_ANIMATION_DURATION_MS;
  
  // Lower pace = longer animations (more time to breathe)
  const paceFactor = 1 - (energy.paceScore / 100);
  const duration = baseMin + (baseMax - baseMin) * paceFactor;
  
  return clamp(Math.round(duration), baseMin, baseMax);
}

// ============= Frame Variant Generation =============

function generateFrameVariants(inputs: GenerationInputs): FrameVariant[] {
  const { styleKey, energyProfile, mood, playstyle, gameName } = inputs;
  const effectiveStyle = styleKey === "auto" ? inferStyleFromInputs(inputs) : styleKey;
  
  const themes = COLOR_THEMES[effectiveStyle] || COLOR_THEMES.auto;
  const shapes = SHAPE_BY_STYLE[effectiveStyle] || SHAPE_BY_STYLE.auto;
  const intensity = computeIntensity(energyProfile, effectiveStyle);
  
  const variants: FrameVariant[] = [];
  const variantCount = MIN_FRAME_VARIANTS + Math.floor(intensity * 3);
  
  for (let i = 0; i < Math.min(variantCount, MAX_FRAME_VARIANTS); i++) {
    const seed = (i + 1) / variantCount;
    const shape = pick(shapes, seed);
    const colorTheme = pick(themes, (seed + 0.33) % 1);
    
    // Calculate glow based on style (capped for safety)
    let glowIntensity = 0;
    if (effectiveStyle === "neon" || effectiveStyle === "hype") {
      glowIntensity = clamp(intensity * 0.8, 0.2, MAX_GLOW_INTENSITY);
    } else if (effectiveStyle === "meme") {
      glowIntensity = clamp(intensity * 0.5, 0, 0.5);
    }
    
    // Stroke width based on style
    let strokeWidth = 2;
    if (effectiveStyle === "minimalPro") strokeWidth = 1;
    else if (effectiveStyle === "hype" || effectiveStyle === "retro") strokeWidth = 4;
    else if (effectiveStyle === "meme") strokeWidth = 3;
    
    const style_params: FrameStyleParams = {
      ...DEFAULT_STYLE_PARAMS,
      shape,
      colorTheme,
      strokeWidth,
      glowIntensity,
      shadowIntensity: clamp(0.3 + intensity * 0.3, 0.2, 0.6),
      nameplateEnabled: i === 0 && (effectiveStyle === "hype" || playstyle === "support"),
      micRingEnabled: i === 0 && mood === "intense",
      micRingSensitivity: 0.5,
    };
    
    const layout_params: FrameLayoutParams = {
      ...DEFAULT_LAYOUT_PARAMS,
      positionAnchor: pick(POSITION_ANCHORS, (seed + 0.5) % 1),
      sizeScale: clamp(0.8 + intensity * 0.4, 0.7, 1.3),
    };
    
    // Calculate confidence based on how well it matches inputs
    let confidence = 0.7;
    if (gameName && themes.includes("primary")) confidence += 0.1;
    if (mood === "intense" && glowIntensity > 0.3) confidence += 0.1;
    if (playstyle === "aggressive" && strokeWidth >= 3) confidence += 0.05;
    confidence = clamp(confidence - (i * 0.05), 0.5, 0.95);
    
    const tags: string[] = [effectiveStyle, shape];
    if (glowIntensity > 0.3) tags.push("glow");
    if (strokeWidth >= 3) tags.push("bold");
    if (mood) tags.push(mood);
    
    variants.push({
      id: generateId(),
      name: `${effectiveStyle} ${shape} ${i + 1}`,
      style_params,
      layout_params,
      confidence,
      tags,
    });
  }
  
  // Sort by confidence
  return variants.sort((a, b) => b.confidence - a.confidence);
}

// ============= Reel Asset Generation =============

function generateIntroTemplate(inputs: GenerationInputs): ReelAssetTemplate {
  const { styleKey, energyProfile, gameName } = inputs;
  const effectiveStyle = styleKey === "auto" ? inferStyleFromInputs(inputs) : styleKey;
  
  const themes = COLOR_THEMES[effectiveStyle];
  const animationTypes = ANIMATION_TYPES_BY_STYLE[effectiveStyle];
  
  return {
    id: generateId(),
    type: "intro",
    name: `${effectiveStyle} Intro`,
    durationMs: computeDuration(energyProfile, "intro"),
    styleKey: effectiveStyle,
    params: {
      colorTheme: pick(themes),
      textOverlay: gameName ? `${gameName} Highlights` : undefined,
      animationType: pick(animationTypes),
      animationSpeed: computeAnimationSpeed(energyProfile),
      intensity: clamp(computeIntensity(energyProfile, effectiveStyle), 0.3, MAX_INTENSITY),
    },
  };
}

function generateOutroTemplate(inputs: GenerationInputs): ReelAssetTemplate {
  const { styleKey, energyProfile } = inputs;
  const effectiveStyle = styleKey === "auto" ? inferStyleFromInputs(inputs) : styleKey;
  
  const themes = COLOR_THEMES[effectiveStyle];
  const animationTypes = ANIMATION_TYPES_BY_STYLE[effectiveStyle];
  
  // Outros are usually calmer
  const outroEnergy: EnergyProfile = {
    paceScore: Math.max(20, energyProfile.paceScore - 20),
    loudnessScore: Math.max(20, energyProfile.loudnessScore - 15),
    cutScore: Math.max(15, energyProfile.cutScore - 25),
  };
  
  return {
    id: generateId(),
    type: "outro",
    name: `${effectiveStyle} Outro`,
    durationMs: computeDuration(outroEnergy, "outro"),
    styleKey: effectiveStyle,
    params: {
      colorTheme: pick(themes, 0.66),
      textOverlay: "Thanks for watching",
      animationType: pick(["fade", "slide"]),
      animationSpeed: "slow",
      intensity: clamp(computeIntensity(outroEnergy, effectiveStyle), 0.2, 0.5),
    },
  };
}

function generateTransitionTemplates(inputs: GenerationInputs): ReelAssetTemplate[] {
  const { styleKey, energyProfile, clipCount = 3 } = inputs;
  const effectiveStyle = styleKey === "auto" ? inferStyleFromInputs(inputs) : styleKey;
  
  const themes = COLOR_THEMES[effectiveStyle];
  const animationTypes = ANIMATION_TYPES_BY_STYLE[effectiveStyle];
  
  // Generate one transition per clip boundary (max 6)
  const transitionCount = Math.min(clipCount - 1, 6);
  const templates: ReelAssetTemplate[] = [];
  
  for (let i = 0; i < transitionCount; i++) {
    templates.push({
      id: generateId(),
      type: "transition",
      name: `Transition ${i + 1}`,
      durationMs: computeDuration(energyProfile, "transition"),
      styleKey: effectiveStyle,
      params: {
        colorTheme: pick(themes, (i + 1) / transitionCount),
        animationType: pick(animationTypes, (i + 0.5) / transitionCount),
        animationSpeed: computeAnimationSpeed(energyProfile),
        intensity: clamp(computeIntensity(energyProfile, effectiveStyle), 0.3, 0.6),
      },
    });
  }
  
  return templates;
}

// ============= Style Inference =============

function inferStyleFromInputs(inputs: GenerationInputs): StyleKey {
  const { gameName, mood, playstyle, energyProfile } = inputs;
  
  // Use energy profile to infer
  const avgEnergy = (energyProfile.paceScore + energyProfile.loudnessScore) / 2;
  
  // High energy = hype
  if (avgEnergy > 70) return "hype";
  
  // Low energy + tactical = cinematic
  if (avgEnergy < 40 && playstyle === "tactical") return "cinematic";
  
  // Intense mood + moderate energy = neon
  if (mood === "intense" && avgEnergy > 50) return "neon";
  
  // Chaotic = meme (opt-in only, but can suggest)
  if (mood === "chaotic") return "meme";
  
  // Default to minimal pro for safety
  return "minimalPro";
}

// ============= Main Generation Function =============

/**
 * Generate AI-style assets from inputs
 * 
 * This is a deterministic template-based generator that can be
 * swapped for real AI model calls without changing the interface.
 * 
 * @param inputs - Generation inputs
 * @param onProgress - Progress callback
 * @returns Generated assets
 */
export async function generateReelAssets(
  inputs: GenerationInputs,
  onProgress?: (progress: GenerationProgress) => void
): Promise<GenerationResult> {
  const startTime = performance.now();
  const inputHash = hashInputs(inputs);
  
  // Stage 1: Analyzing
  onProgress?.({
    stage: "analyzing",
    progress: 10,
    message: "Analyzing content...",
  });
  
  // Simulate async work (in real AI, this would be model inference)
  await delay(200);
  
  // Stage 2: Generating frames
  onProgress?.({
    stage: "generating_frames",
    progress: 30,
    message: "Generating frame variants...",
  });
  
  const frameVariants = generateFrameVariants(inputs);
  await delay(300);
  
  // Stage 3: Generating assets
  onProgress?.({
    stage: "generating_assets",
    progress: 60,
    message: "Creating intro & outro...",
  });
  
  const introTemplate = generateIntroTemplate(inputs);
  const outroTemplate = generateOutroTemplate(inputs);
  const transitionTemplates = generateTransitionTemplates(inputs);
  await delay(300);
  
  // Stage 4: Finalizing
  onProgress?.({
    stage: "finalizing",
    progress: 90,
    message: "Finalizing package...",
  });
  
  await delay(100);
  
  const processingTimeMs = Math.round(performance.now() - startTime);
  
  onProgress?.({
    stage: "finalizing",
    progress: 100,
    message: "Complete!",
  });
  
  return {
    frameVariants,
    introTemplate,
    outroTemplate,
    transitionTemplates,
    metadata: {
      generatedAt: new Date().toISOString(),
      model: "vantage-template-v1", // Can be swapped for real model name
      inputHash,
      processingTimeMs,
    },
  };
}

// ============= Energy Profile Computation =============

/**
 * Compute energy profile from session data
 * 
 * This is a lightweight computation that runs on available metadata,
 * not on raw audio/video streams.
 */
export function computeEnergyProfile(params: {
  /** Total duration in seconds */
  durationSeconds: number;
  /** Number of kills/highlights */
  momentCount: number;
  /** Audio peak data (if available) */
  audioPeaks?: number[];
  /** Number of distinct clips/scenes */
  sceneCount?: number;
}): EnergyProfile {
  const { durationSeconds, momentCount, audioPeaks, sceneCount = 1 } = params;
  
  // Pace score: moments per minute (normalized)
  const momentsPerMinute = (momentCount / durationSeconds) * 60;
  const paceScore = clamp(momentsPerMinute * 10, 0, 100);
  
  // Loudness score: average audio peak intensity
  let loudnessScore = 50; // Default
  if (audioPeaks && audioPeaks.length > 0) {
    const avgPeak = audioPeaks.reduce((a, b) => a + b, 0) / audioPeaks.length;
    loudnessScore = clamp(avgPeak * 100, 0, 100);
  }
  
  // Cut score: scene changes per minute
  const cutsPerMinute = (sceneCount / durationSeconds) * 60;
  const cutScore = clamp(cutsPerMinute * 5, 0, 100);
  
  return {
    paceScore: Math.round(paceScore),
    loudnessScore: Math.round(loudnessScore),
    cutScore: Math.round(cutScore),
  };
}

// ============= Helpers =============

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============= Validation =============

/**
 * Validate that generated assets meet safety requirements
 */
export function validateGeneratedAssets(result: GenerationResult): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Check animation durations
  const allAssets = [
    result.introTemplate,
    result.outroTemplate,
    ...result.transitionTemplates,
  ].filter(Boolean) as ReelAssetTemplate[];
  
  for (const asset of allAssets) {
    if (asset.durationMs > MAX_ANIMATION_DURATION_MS) {
      warnings.push(`${asset.type} exceeds max duration`);
    }
    if (asset.durationMs < MIN_ANIMATION_DURATION_MS && asset.type !== "transition") {
      warnings.push(`${asset.type} below min duration`);
    }
    if (asset.params.intensity > MAX_INTENSITY) {
      warnings.push(`${asset.type} intensity too high`);
    }
  }
  
  // Check frame variants
  for (const variant of result.frameVariants) {
    if (variant.style_params.glowIntensity > MAX_GLOW_INTENSITY) {
      warnings.push(`Frame variant "${variant.name}" glow too intense`);
    }
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}
