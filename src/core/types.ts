/** Hand codes as they appear in the CSV. */
export type Hand = 'l' | 'r';

/** Finger codes as they appear in the CSV: thumb, index, middle, ring, little. */
export type Finger = 't' | 'i' | 'm' | 'r' | 'l';

export const FINGERS: readonly Finger[] = ['t', 'i', 'm', 'r', 'l'];
export const HANDS: readonly Hand[] = ['l', 'r'];

/** One addressable key/column: a specific finger on a specific hand. */
export interface FingerSlot {
  hand: Hand;
  finger: Finger;
}

export function slotKey(s: FingerSlot): string {
  return `${s.hand}:${s.finger}`;
}

export function sameSlot(a: FingerSlot, b: FingerSlot): boolean {
  return a.hand === b.hand && a.finger === b.finger;
}

export type Difficulty = string; // keys of config.difficulties, e.g. 'easy'|'medium'|'hard'

export type HandMode = 'left' | 'right' | 'both';

export interface ModeSelection {
  hands: HandMode;
  /** 3 (central), 4 (non-thumb), or 5 fingers per hand. */
  fingersPerHand: 3 | 4 | 5;
  /** Objects per trial: 1 = single, 2-3 = chords (chords target one hand at a time). */
  chordSize: 1 | 2 | 3;
  difficulty: Difficulty;
}

/** One pregenerated trial (one ripple cycle). */
export interface Trial {
  /** 1-based trial number, as written to the CSV. */
  index: number;
  /** Which ripple cycle this trial occupies (0-based from run t0). */
  cycle: number;
  /** Target objects; length 1 for singles, 2-3 for chords (all one hand). */
  targets: FingerSlot[];
  /** The pseudorandomized reaction-time condition (spawn lead + window). */
  reactionTimeMs: number;
  // Absolute times on the performance.now() timeline, filled at run start:
  peakTime: number;
  windowOpen: number;
  windowClose: number;
  spawnTime: number;
}

/** A raw key/touch press on the performance.now() timeline. */
export interface PressEvent {
  slot: FingerSlot;
  /** Normalized high-res timestamp. */
  t: number;
  /** t minus the trial's peakTime; negative = early. */
  offsetMs: number;
  cycle: number;
  /** Whether this press consumed one of the cycle's attempts. */
  latched: boolean;
  /** Points awarded at press time (press-intrinsic). */
  points: number;
}

export type PressClass = 'correct' | 'wrongFinger' | 'early' | 'late' | 'excess';

/**
 * One CSV row: the outcome for a single target object, or — when
 * targetFinger/targetHand are 'x' — a penalized excess press that belongs
 * to no object.
 */
export interface TrialResult {
  trial: number;
  targetFinger: Finger | 'x';
  targetHand: Hand | 'x';
  pressedFinger: Finger | 'x';
  pressedHand: Hand | 'x';
  /** The reaction-time condition for this trial. */
  timingMs: number;
  /** Rounded ms offset from ripple peak; null when no press was attributed. */
  pressOffsetMs: number | null;
  points: number;
  chordSize: number;
  cycle: number;
}

export interface RunRecord {
  id: string;
  identifier: string;
  nickname: string;
  mode: ModeSelection;
  seed: number;
  startedAtIso: string;
  userAgent: string;
  aborted: boolean;
  totalTrials: number;
  score: number;
  results: TrialResult[];
  rawPresses: PressEvent[];
}
