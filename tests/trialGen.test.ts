import { describe, expect, it } from 'vitest';
import {
  activeFingers,
  buildTransitionBalancedSequence,
  generateSchedule,
  planSchedule,
  targetSets,
} from '../src/core/trialGen';
import { mulberry32 } from '../src/core/rng';
import { slotKey } from '../src/core/types';
import { mode, testConfig } from './helpers';

const cfg = testConfig();

function setId(targets: { hand: string; finger: string }[]): string {
  return targets.map((t) => `${t.hand}:${t.finger}`).join('+');
}

describe('planSchedule', () => {
  it('reproduces the spec example: 5 fingers x 5 timings -> 150 trials', () => {
    const plan = planSchedule(mode(), cfg);
    expect(plan.numSets).toBe(5);
    expect(plan.numTimings).toBe(5);
    expect(plan.reps).toBe(6);
    expect(plan.totalTrials).toBe(150);
    expect(plan.outOfBounds).toBe(false);
  });

  it('reproduces the spec example: 3 fingers x 8 timings -> 168 trials', () => {
    const plan = planSchedule(mode({ fingersPerHand: 3, difficulty: 'eight' }), cfg);
    expect(plan.numSets).toBe(3);
    expect(plan.numTimings).toBe(8);
    expect(plan.reps).toBe(7);
    expect(plan.totalTrials).toBe(168);
  });

  it('chord runs pick the nearest counterbalanced multiple within bounds', () => {
    // 2-of-5 chords, both hands: 20 sets x 5 timings = 100 conditions.
    const plan = planSchedule(mode({ hands: 'both', chordSize: 2 }), cfg);
    expect(plan.numSets).toBe(20);
    expect(plan.totalTrials).toBe(200); // 100 is below lo=120; 200 is in bounds
    expect(plan.outOfBounds).toBe(false);
  });

  it('flags when no multiple fits the bounds', () => {
    const tight = testConfig({ run: { targetTrialCount: 150, trialCountBounds: [149, 151] } });
    const plan = planSchedule(mode({ hands: 'both', chordSize: 2 }), tight);
    expect(plan.outOfBounds).toBe(true);
    expect(plan.totalTrials).toBe(100); // closest multiple of 100 to 150 is 100 or 200; 100 wins ties? |100-150|=|200-150| -> first found kept
  });

  it('computes run duration from ripple frequency', () => {
    const plan = planSchedule(mode(), cfg);
    expect(plan.runDurationMs).toBe(150 * 2000);
  });
});

describe('activeFingers', () => {
  it('selects the finger set by count', () => {
    expect(activeFingers(mode({ fingersPerHand: 5 }), cfg)).toEqual(['t', 'i', 'm', 'r', 'l']);
    expect(activeFingers(mode({ fingersPerHand: 4 }), cfg)).toEqual(['i', 'm', 'r', 'l']);
    expect(activeFingers(mode({ fingersPerHand: 3 }), cfg)).toEqual(['i', 'm', 'r']);
  });

  it('4-finger set never includes the thumb', () => {
    expect(activeFingers(mode({ fingersPerHand: 4 }), cfg)).not.toContain('t');
  });
});

describe('targetSets', () => {
  it('enumerates same-hand chord combinations', () => {
    expect(targetSets(mode({ chordSize: 2 }), cfg)).toHaveLength(10);
    expect(targetSets(mode({ hands: 'both', chordSize: 2 }), cfg)).toHaveLength(20);
    expect(targetSets(mode({ hands: 'both', chordSize: 3, fingersPerHand: 3 }), cfg)).toHaveLength(2);
    expect(targetSets(mode({ hands: 'both' }), cfg)).toHaveLength(10);
  });

  it('handles 4-finger single and chord counts', () => {
    // Single-hand singles → 4 slots; both hands → 8.
    expect(targetSets(mode({ fingersPerHand: 4 }), cfg)).toHaveLength(4);
    expect(targetSets(mode({ hands: 'both', fingersPerHand: 4 }), cfg)).toHaveLength(8);
    // 2-of-4 chords per hand = C(4,2) = 6; both hands = 12.
    expect(targetSets(mode({ fingersPerHand: 4, chordSize: 2 }), cfg)).toHaveLength(6);
    expect(targetSets(mode({ hands: 'both', fingersPerHand: 4, chordSize: 2 }), cfg)).toHaveLength(12);
  });

  it('4-finger single-hand run counterbalances cleanly (4 fingers x 5 timings = 20)', () => {
    const plan = planSchedule(mode({ fingersPerHand: 4 }), cfg);
    expect(plan.numSets).toBe(4);
    expect(plan.numTimings).toBe(5);
    expect(plan.totalTrials % 20).toBe(0);
    expect(plan.outOfBounds).toBe(false);
  });

  it('chord targets never span hands', () => {
    for (const set of targetSets(mode({ hands: 'both', chordSize: 3 }), cfg)) {
      expect(new Set(set.map((s) => s.hand)).size).toBe(1);
    }
  });
});

describe('buildTransitionBalancedSequence', () => {
  it('every set appears exactly its quota', () => {
    for (const seed of [1, 2, 3, 42]) {
      const seq = buildTransitionBalancedSequence(5, 30, mulberry32(seed));
      expect(seq).toHaveLength(150);
      const counts = new Map<number, number>();
      for (const s of seq) counts.set(s, (counts.get(s) ?? 0) + 1);
      for (let i = 0; i < 5; i++) expect(counts.get(i)).toBe(30);
    }
  });

  it('transition counts are flat: every ordered pair within ±1, exact when N | Q', () => {
    for (const seed of [7, 99, 12345]) {
      const N = 5;
      const Q = 30; // Q/N = 6 exactly
      const seq = buildTransitionBalancedSequence(N, Q, mulberry32(seed));
      const trans = new Map<string, number>();
      for (let i = 1; i < seq.length; i++) {
        const key = `${seq[i - 1]}>${seq[i]}`;
        trans.set(key, (trans.get(key) ?? 0) + 1);
      }
      // 25 transition types x 6 each = 150, minus the dropped wrap-around edge.
      const values: number[] = [];
      for (let a = 0; a < N; a++) {
        for (let b = 0; b < N; b++) values.push(trans.get(`${a}>${b}`) ?? 0);
      }
      expect(values.reduce((s, v) => s + v, 0)).toBe(Q * N - 1);
      expect(Math.min(...values)).toBeGreaterThanOrEqual(5);
      expect(Math.max(...values)).toBeLessThanOrEqual(6);
      expect(values.filter((v) => v === 5)).toHaveLength(1); // only the wrap edge is short
    }
  });

  it('near-exact when N does not divide Q: counts within ±1 of each other', () => {
    for (const seed of [3, 8, 21]) {
      const N = 3;
      const Q = 56; // 3f x 8 timings x 7 reps
      const seq = buildTransitionBalancedSequence(N, Q, mulberry32(seed));
      expect(seq).toHaveLength(168);
      const trans = new Map<string, number>();
      for (let i = 1; i < seq.length; i++) {
        const key = `${seq[i - 1]}>${seq[i]}`;
        trans.set(key, (trans.get(key) ?? 0) + 1);
      }
      const values: number[] = [];
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) values.push(trans.get(`${a}>${b}`) ?? 0);
      // base=18, r=2: counts should be 18 or 19 (one 18/19 short by the wrap edge).
      expect(Math.min(...values)).toBeGreaterThanOrEqual(17);
      expect(Math.max(...values)).toBeLessThanOrEqual(19);
    }
  });

  it('sparse chord case: immediate repeats still occur', () => {
    for (const seed of [5, 17, 400]) {
      const N = 20;
      const Q = 10; // 2-of-5 both hands, 5 timings x 2 reps
      const seq = buildTransitionBalancedSequence(N, Q, mulberry32(seed));
      expect(seq).toHaveLength(200);
      let repeats = 0;
      for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) repeats++;
      expect(repeats).toBeGreaterThan(0);
      const counts = new Map<number, number>();
      for (const s of seq) counts.set(s, (counts.get(s) ?? 0) + 1);
      for (let i = 0; i < N; i++) expect(counts.get(i)).toBe(Q);
    }
  });

  it('handles the degenerate single-set case', () => {
    expect(buildTransitionBalancedSequence(1, 8, mulberry32(1))).toEqual(new Array(8).fill(0));
  });
});

describe('generateSchedule', () => {
  it('is deterministic for a given seed and differs across seeds', () => {
    const a1 = generateSchedule(mode(), cfg, 42);
    const a2 = generateSchedule(mode(), cfg, 42);
    const b = generateSchedule(mode(), cfg, 43);
    expect(a1.map((t) => setId(t.targets) + ':' + t.reactionTimeMs)).toEqual(
      a2.map((t) => setId(t.targets) + ':' + t.reactionTimeMs),
    );
    expect(a1.map((t) => setId(t.targets))).not.toEqual(b.map((t) => setId(t.targets)));
  });

  it('counterbalances exactly: every (set, timing) condition appears reps times', () => {
    for (const m of [
      mode(),
      mode({ fingersPerHand: 3, difficulty: 'eight' }),
      mode({ hands: 'both' }),
      mode({ hands: 'both', chordSize: 2 }),
      mode({ chordSize: 3 }),
    ]) {
      const plan = planSchedule(m, cfg);
      const trials = generateSchedule(m, cfg, 7);
      expect(trials).toHaveLength(plan.totalTrials);
      const counts = new Map<string, number>();
      for (const t of trials) {
        const key = setId(t.targets) + '@' + t.reactionTimeMs;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      expect(counts.size).toBe(plan.numSets * plan.numTimings);
      for (const v of counts.values()) expect(v).toBe(plan.reps);
    }
  });

  it('assigns sequential 1-based trial indices and 0-based cycles', () => {
    const trials = generateSchedule(mode(), cfg, 9);
    trials.forEach((t, i) => {
      expect(t.index).toBe(i + 1);
      expect(t.cycle).toBe(i);
    });
  });

  it('single-object trials have exactly one target from the active slots', () => {
    const trials = generateSchedule(mode({ fingersPerHand: 3 }), cfg, 11);
    const allowed = new Set(['l:i', 'l:m', 'l:r']);
    for (const t of trials) {
      expect(t.targets).toHaveLength(1);
      expect(allowed.has(slotKey(t.targets[0]!))).toBe(true);
    }
  });
});
