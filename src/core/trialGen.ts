import type { GameConfig } from '../config/types';
import type { Finger, FingerSlot, Hand, ModeSelection, Trial } from './types';
import { FINGERS } from './types';
import { RippleClock } from './clock';
import { mulberry32, randInt, shuffle } from './rng';

/** Fingers active per hand for a mode, in a stable order. */
export function activeFingers(mode: ModeSelection, cfg: GameConfig): Finger[] {
  if (mode.fingersPerHand === 5) return [...FINGERS];
  if (mode.fingersPerHand === 4) return [...cfg.modes.fourFingerSet];
  return [...cfg.modes.threeFingerSet];
}

export function activeHands(mode: ModeSelection): Hand[] {
  return mode.hands === 'both' ? ['l', 'r'] : [mode.hands === 'left' ? 'l' : 'r'];
}

export function activeSlots(mode: ModeSelection, cfg: GameConfig): FingerSlot[] {
  const slots: FingerSlot[] = [];
  for (const hand of activeHands(mode)) {
    for (const finger of activeFingers(mode, cfg)) {
      slots.push({ hand, finger });
    }
  }
  return slots;
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...rest] = items as [T, ...T[]];
  return [
    ...combinations(rest, k - 1).map((c) => [head, ...c]),
    ...combinations(rest, k),
  ];
}

/**
 * The distinct target sets for a mode: single fingers, or same-hand chord
 * combinations. Each set is one "node" for transition balancing.
 */
export function targetSets(mode: ModeSelection, cfg: GameConfig): FingerSlot[][] {
  if (mode.chordSize === 1) {
    return activeSlots(mode, cfg).map((s) => [s]);
  }
  const sets: FingerSlot[][] = [];
  for (const hand of activeHands(mode)) {
    for (const combo of combinations(activeFingers(mode, cfg), mode.chordSize)) {
      sets.push(combo.map((finger) => ({ hand, finger })));
    }
  }
  return sets;
}

export interface SchedulePlan {
  /** Trials per (target set × reaction time) condition. */
  reps: number;
  totalTrials: number;
  numSets: number;
  numTimings: number;
  /** True when totalTrials could not be kept inside run.trialCountBounds. */
  outOfBounds: boolean;
  runDurationMs: number;
}

/**
 * Choose the repetition count for full counterbalancing: the smallest
 * counterbalanced total >= targetTrialCount that fits trialCountBounds
 * (the spec's 24-condition example rounds 150 up to 168). If nothing >=
 * target fits, take the largest in-bounds total; if no multiple is in
 * bounds at all, take the closest to target and flag it.
 */
export function planSchedule(mode: ModeSelection, cfg: GameConfig): SchedulePlan {
  const numSets = targetSets(mode, cfg).length;
  const difficulty = cfg.difficulties[mode.difficulty];
  if (!difficulty) throw new Error(`Unknown difficulty "${mode.difficulty}"`);
  const numTimings = difficulty.reactionTimesMs.length;
  const conditions = numSets * numTimings;
  const [lo, hi] = cfg.run.trialCountBounds;
  const target = cfg.run.targetTrialCount;

  const candidates: { reps: number; total: number; inBounds: boolean }[] = [];
  for (let reps = 1; ; reps++) {
    const total = reps * conditions;
    candidates.push({ reps, total, inBounds: total >= lo && total <= hi });
    if (total >= Math.max(hi, target)) break;
  }

  const inBounds = candidates.filter((c) => c.inBounds);
  const chosen =
    inBounds.find((c) => c.total >= target) ??
    inBounds[inBounds.length - 1] ??
    candidates.reduce((a, b) => (Math.abs(b.total - target) < Math.abs(a.total - target) ? b : a));
  return {
    reps: chosen.reps,
    totalTrials: chosen.total,
    numSets,
    numTimings,
    outOfBounds: !chosen.inBounds,
    runDurationMs: chosen.total * periodOf(mode, cfg),
  };
}

/** Period between objects in ms for the mode's selected speed. */
export function periodOf(mode: ModeSelection, cfg: GameConfig): number {
  const periodMs = cfg.speeds[mode.speed];
  if (periodMs === undefined) throw new Error(`Unknown speed "${mode.speed}"`);
  return periodMs;
}

/**
 * Build a target-set sequence with balanced first-order transitions,
 * including self-transitions (immediate repeats).
 *
 * Method: build a directed multigraph on the N target sets where every node
 * has out-degree = in-degree = Q (its trial quota) and each ordered pair
 * (i -> j) carries either floor(Q/N) or floor(Q/N)+1 edges, then walk a
 * random Eulerian circuit. Every transition type therefore occurs as evenly
 * as integrally possible. Which pairs get the +1 edge is chosen per-node
 * offset (circulant) under a random node relabeling; when Q < N (chords),
 * offsets always include 0 (guaranteeing each set repeats back-to-back once)
 * and 1 (guaranteeing the graph is connected).
 */
export function buildTransitionBalancedSequence(
  numSets: number,
  quotaPerSet: number,
  rand: () => number,
): number[] {
  const N = numSets;
  const Q = quotaPerSet;
  if (N === 1) return new Array<number>(Q).fill(0);

  const base = Math.floor(Q / N);
  const r = Q % N;

  // Random relabeling so the circulant "+1" pattern doesn't correlate with
  // any meaningful set ordering.
  const label = shuffle(Array.from({ length: N }, (_, i) => i), rand);

  // Choose r offsets to receive the extra edge.
  const offsets: number[] = [];
  if (r > 0) {
    const pool = Array.from({ length: N }, (_, i) => i);
    if (base === 0) {
      // Sparse case: force self-loops (0) so repeats happen, and offset 1 so
      // the circulant graph is strongly connected.
      offsets.push(0, 1);
      shuffle(pool.filter((o) => o > 1), rand)
        .slice(0, Math.max(0, r - 2))
        .forEach((o) => offsets.push(o));
      if (r === 1) offsets.length = 1; // degenerate; keep just the self-loop... unreachable for realistic Q
    } else {
      shuffle(pool, rand).slice(0, r).forEach((o) => offsets.push(o));
    }
  }
  const offsetSet = new Set(offsets);

  // adjacency[i] = multiset of destinations, in relabeled space.
  const adjacency: number[][] = Array.from({ length: N }, () => []);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const count = base + (offsetSet.has((j - i + N) % N) ? 1 : 0);
      for (let c = 0; c < count; c++) adjacency[i]!.push(j);
    }
  }
  for (const list of adjacency) shuffle(list, rand);

  // Hierholzer's algorithm; in-degree == out-degree everywhere, so a circuit
  // exists whenever the graph is connected (guaranteed by base>=1 or offset 1).
  const start = randInt(N, rand);
  const stack: number[] = [start];
  const circuit: number[] = [];
  while (stack.length > 0) {
    const v = stack[stack.length - 1]!;
    const edges = adjacency[v]!;
    if (edges.length > 0) {
      stack.push(edges.pop()!);
    } else {
      circuit.push(stack.pop()!);
    }
  }
  circuit.reverse();
  // Circuit visits Q*N edges -> Q*N + 1 nodes with first == last; drop the
  // final node so every set appears exactly Q times.
  circuit.pop();

  if (circuit.length !== Q * N) {
    // Disconnected multigraph (can only happen for adversarial N/Q); fall
    // back to a plain shuffle rather than produce a short run.
    const flat: number[] = [];
    for (let i = 0; i < N; i++) for (let q = 0; q < Q; q++) flat.push(i);
    return shuffle(flat, rand).map((i) => label[i]!);
  }

  return circuit.map((i) => label[i]!);
}

/**
 * Generate the full pregenerated schedule for a run. Absolute times are not
 * filled here — call fillScheduleTimes with the run's RippleClock at start.
 */
export function generateSchedule(mode: ModeSelection, cfg: GameConfig, seed: number): Trial[] {
  const sets = targetSets(mode, cfg);
  const plan = planSchedule(mode, cfg);
  const reactionTimes = cfg.difficulties[mode.difficulty]!.reactionTimesMs;
  const rand = mulberry32(seed);

  const quotaPerSet = plan.reps * plan.numTimings;
  const sequence = buildTransitionBalancedSequence(sets.length, quotaPerSet, rand);

  // Balanced reaction-time assignment within each target set: each set gets
  // exactly `reps` trials of every timing, in shuffled order.
  const timingQueues = sets.map(() => {
    const q: number[] = [];
    for (const rt of reactionTimes) for (let i = 0; i < plan.reps; i++) q.push(rt);
    return shuffle(q, rand);
  });

  return sequence.map((setIndex, i) => ({
    index: i + 1,
    cycle: i,
    targets: sets[setIndex]!,
    reactionTimeMs: timingQueues[setIndex]!.pop()!,
    peakTime: 0,
    windowOpen: 0,
    windowClose: 0,
    spawnTime: 0,
    revealTime: 0,
  }));
}

/** Fill absolute performance.now()-timeline times once the run clock exists. */
export function fillScheduleTimes(trials: Trial[], clock: RippleClock, cfg: GameConfig): void {
  const halfWindow = cfg.timing.captureWindowMs / 2;
  const center = cfg.timing.windowCenterOffsetMs;
  for (const trial of trials) {
    trial.peakTime = clock.peakTime(trial.cycle);
    trial.windowOpen = trial.peakTime + center - halfWindow;
    trial.windowClose = trial.peakTime + center + halfWindow;
    // The band itself fades in at a uniform lead; only the REVEAL carries
    // the reaction-time manipulation (formerly the spawn formula).
    trial.spawnTime = trial.peakTime - cfg.fall.fadeLeadMs;
    trial.revealTime = trial.windowClose - trial.reactionTimeMs;
  }
}
