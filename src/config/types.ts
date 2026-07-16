import type { Finger, Hand } from '../core/types';

export interface TimingConfig {
  /** Total capture window width, centered on the peak (± half). */
  captureWindowMs: number;
  /** Shifts the window center relative to the peak; 0 = symmetric. */
  windowCenterOffsetMs: number;
}

export interface FallConfig {
  /**
   * How long before its peak a band becomes visible near the top of the
   * screen (its whole fall is prespawned; this is just the fade-in cutoff).
   * Must exceed the longest reaction time + half window so every reveal
   * happens while the band is visible. Rendering only.
   */
  fadeLeadMs: number;
}

export interface DifficultyConfig {
  reactionTimesMs: number[];
}

export interface RunConfig {
  targetTrialCount: number;
  /** [min, max] acceptable total trial counts after counterbalancing. */
  trialCountBounds: [number, number];
}

export interface ScoringConfig {
  correct: number;
  wrongFinger: number;
  /** Latched press outside the window (early or late). */
  earlyLate: number;
  /** A target object that ends its cycle with no attributed press. */
  noPress: number;
  /** Press beyond the per-cycle limit (or a repeated key). */
  excessPress: number;
}

export interface VisualsConfig {
  fingerColors: Record<Finger, string>;
  handShapes: Record<Hand, 'diamond' | 'circle'>;
  popDurationMs: number;
  scoreFloatDurationMs: number;
  /** Crosshair glow strength during the window; 0 disables the halo. */
  glowIntensity: number;
}

export interface ModesConfig {
  threeFingerSet: Finger[];
  /** Fingers used in 4-finger mode (default the four non-thumb fingers). */
  fourFingerSet: Finger[];
  /** Thumb key for single-hand modes (replaces the configured thumb key). */
  singleHandThumbKey: string;
  mobile: { fingers: number; maxChord: number };
}

export interface AudioConfig {
  /** 0 disables audio entirely. */
  masterVolume: number;
}

export interface GameConfig {
  timing: TimingConfig;
  /** Speed presets: name -> period between objects in ms. */
  speeds: Record<string, number>;
  defaultSpeed: string;
  fall: FallConfig;
  difficulties: Record<string, DifficultyConfig>;
  run: RunConfig;
  scoring: ScoringConfig;
  /** KeyboardEvent.code per hand and finger. */
  keys: Record<Hand, Record<Finger, string>>;
  visuals: VisualsConfig;
  modes: ModesConfig;
  audio: AudioConfig;
}
