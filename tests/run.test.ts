import { describe, expect, it } from 'vitest';
import { RippleClock } from '../src/core/clock';
import { RunController, normalizeTimestamp } from '../src/core/run';
import type { RunEvents } from '../src/core/run';
import { fillScheduleTimes, generateSchedule } from '../src/core/trialGen';
import type { FingerSlot, PressClass, Trial, TrialResult } from '../src/core/types';
import { mode, testConfig } from './helpers';

const cfg = testConfig();
const ORDER = ['l:l', 'l:r', 'l:m', 'l:i', 'l:t', 'r:t', 'r:i', 'r:m', 'r:r', 'r:l'];
const columnX = (s: FingerSlot): number => ORDER.indexOf(`${s.hand}:${s.finger}`) * 100;

interface Captured {
  presses: { cls: PressClass; points: number }[];
  resolved: TrialResult[][];
  lost: FingerSlot[][];
  completed: boolean;
}

function makeRun(m = mode(), seed = 42): { rc: RunController; clock: RippleClock; trials: Trial[]; cap: Captured } {
  const trials = generateSchedule(m, cfg, seed);
  const clock = new RippleClock(10_000, cfg.ripple.frequencyHz);
  fillScheduleTimes(trials, clock, cfg);
  const cap: Captured = { presses: [], resolved: [], lost: [], completed: false };
  const events: RunEvents = {
    onPress: (press, cls) => cap.presses.push({ cls, points: press.points }),
    onObjectsLost: (_trial, lostTargets) => cap.lost.push(lostTargets),
    onTrialResolved: (_trial, results) => cap.resolved.push(results),
    onComplete: () => (cap.completed = true),
  };
  return { rc: new RunController(trials, clock, cfg, columnX, events), clock, trials, cap };
}

describe('RunController', () => {
  it('perfect press on the target scores correct points and resolves to a row', () => {
    const { rc, trials, cap } = makeRun();
    const t0 = trials[0]!;
    rc.handlePress(t0.targets[0]!, t0.peakTime); // offset 0
    expect(cap.presses).toEqual([{ cls: 'correct', points: 3 }]);
    rc.update(t0.peakTime + 1001); // past far apex of cycle 0
    expect(cap.resolved).toHaveLength(1);
    const row = cap.resolved[0]![0]!;
    expect(row.pressedFinger).toBe(t0.targets[0]!.finger);
    expect(row.pressOffsetMs).toBe(0);
    expect(row.points).toBe(3);
    expect(row.timingMs).toBe(t0.reactionTimeMs);
  });

  it('wrong finger in window scores 1; early/late score 0', () => {
    const { rc, trials, cap } = makeRun();
    const t0 = trials[0]!;
    const wrongSlot = { hand: 'l' as const, finger: t0.targets[0]!.finger === 'm' ? ('i' as const) : ('m' as const) };
    rc.handlePress(wrongSlot, t0.peakTime + 50);
    expect(cap.presses[0]).toEqual({ cls: 'wrongFinger', points: 1 });

    const t1 = trials[1]!;
    rc.update(t1.peakTime - 900);
    rc.handlePress(t1.targets[0]!, t1.peakTime - 400); // early
    expect(cap.presses[1]).toEqual({ cls: 'early', points: 0 });

    const t2 = trials[2]!;
    rc.update(t2.peakTime - 900);
    rc.handlePress(t2.targets[0]!, t2.peakTime + 150); // late (window ±100)
    expect(cap.presses[2]).toEqual({ cls: 'late', points: 0 });
  });

  it('only the first press in a cycle latches; extras are penalized as excess', () => {
    const { rc, trials, cap } = makeRun();
    const t0 = trials[0]!;
    rc.handlePress(t0.targets[0]!, t0.peakTime - 500); // early, latches, 0 pts
    rc.handlePress(t0.targets[0]!, t0.peakTime); // repeat key: excess, -1
    rc.handlePress({ hand: 'l', finger: 't' }, t0.peakTime); // over capacity: excess, -1
    expect(cap.presses.map((p) => p.cls)).toEqual(['early', 'excess', 'excess']);
    expect(rc.rawPresses).toHaveLength(3);
    expect(rc.rawPresses.filter((p) => p.latched)).toHaveLength(1);
    expect(rc.score).toBe(-2);
    rc.update(t0.peakTime + 1001);
    // The early latched press consumed the attempt: 0 points on the object
    // row, plus one target='x' row per excess press.
    const rows = cap.resolved[0]!;
    expect(rows).toHaveLength(3);
    expect(rows[0]!.points).toBe(0);
    expect(rows[0]!.pressOffsetMs).toBe(-500);
    const excessRows = rows.filter((r) => r.targetFinger === 'x');
    expect(excessRows).toHaveLength(2);
    expect(excessRows[0]!.targetHand).toBe('x');
    expect(excessRows[0]!.pressedFinger).not.toBe('x');
    expect(excessRows.every((r) => r.points === -1)).toBe(true);
    expect(excessRows.every((r) => r.trial === t0.index)).toBe(true);
  });

  it('no press resolves to x/x with the noPress penalty', () => {
    const { rc, trials, cap } = makeRun();
    rc.update(trials[0]!.peakTime + 1001);
    const row = cap.resolved[0]![0]!;
    expect(row.pressedFinger).toBe('x');
    expect(row.pressedHand).toBe('x');
    expect(row.pressOffsetMs).toBeNull();
    expect(row.points).toBe(-1);
    expect(rc.score).toBe(-1);
  });

  it('ignoring a 2-chord entirely costs one penalty per object', () => {
    const { rc, trials, cap } = makeRun(mode({ chordSize: 2 }));
    rc.update(trials[0]!.peakTime + 1001);
    const rows = cap.resolved[0]!;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.pressedFinger === 'x' && r.points === -1)).toBe(true);
    expect(rc.score).toBe(-2);
  });

  it('score always equals the sum of the points column', () => {
    const { rc, trials, clock } = makeRun(mode({ chordSize: 2 }));
    // Mixed bag: correct+wrong in cycle 0, one press + spam in cycle 1,
    // nothing in cycle 2, correct-only in cycle 3.
    const t0 = trials[0]!;
    rc.handlePress(t0.targets[0]!, t0.peakTime);
    rc.handlePress({ hand: 'l', finger: 't' }, t0.peakTime + 20);
    const t1 = trials[1]!;
    rc.handlePress(t1.targets[0]!, t1.peakTime + 10);
    rc.handlePress({ hand: 'l', finger: 't' }, t1.peakTime + 30); // fills capacity
    rc.handlePress({ hand: 'l', finger: 'i' }, t1.peakTime + 50); // excess
    rc.handlePress({ hand: 'l', finger: 'i' }, t1.peakTime + 70); // excess (repeat)
    const t3 = trials[3]!;
    rc.handlePress(t3.targets[0]!, t3.peakTime - 5);
    rc.handlePress(t3.targets[1]!, t3.peakTime + 5);
    rc.update(clock.farApexTime(5));
    const sum = rc.results.reduce((s, r) => s + r.points, 0);
    expect(rc.score).toBe(sum);
  });

  it('press cycle is determined by timestamp, not processing time', () => {
    const { rc, trials, cap } = makeRun();
    const t0 = trials[0]!;
    // Press timestamped in cycle 0 but processed "late" (before update ran):
    rc.handlePress(t0.targets[0]!, t0.peakTime + 20);
    rc.update(trials[2]!.peakTime); // catch-up across two cycles at once
    expect(cap.resolved).toHaveLength(2);
    expect(cap.resolved[0]![0]!.pressOffsetMs).toBe(20);
    expect(cap.resolved[1]![0]!.pressedFinger).toBe('x');
  });

  it('emits onObjectsLost once for untouched targets after the peak', () => {
    const { rc, trials, cap, clock } = makeRun();
    const t0 = trials[0]!;
    rc.update(t0.peakTime + clock.periodMs / 4 + 1);
    rc.update(t0.peakTime + clock.periodMs / 4 + 2);
    expect(cap.lost).toHaveLength(1);
    expect(cap.lost[0]).toEqual(t0.targets);
  });

  it('does not flag an object as lost when a wrong-finger press will claim it', () => {
    // v0.1.2 fix: a mistimed press on a non-target finger is still latched
    // and gets attributed to the object at resolve (0 pts, not the no-press
    // penalty), so no "-1" feedback should appear for that object.
    const { rc, trials, cap, clock } = makeRun();
    const t0 = trials[0]!;
    const nonTarget: FingerSlot = {
      hand: 'l',
      finger: (['t', 'i', 'm', 'r', 'l'] as const).find((f) => f !== t0.targets[0]!.finger)!,
    };
    rc.handlePress(nonTarget, t0.peakTime - 400); // early, wrong finger, latched
    rc.update(t0.peakTime + clock.periodMs / 4 + 1);
    expect(cap.lost).toHaveLength(0);
    rc.update(t0.peakTime + 1001);
    // The object row received the press with the earlyLate points, no penalty.
    const row = cap.resolved[0]![0]!;
    expect(row.pressedFinger).toBe(nonTarget.finger);
    expect(row.points).toBe(0);
    expect(rc.score).toBe(0);
  });

  it('flags only the truly unclaimed object in a partially pressed chord', () => {
    const { rc, trials, cap, clock } = makeRun(mode({ chordSize: 2 }));
    const t0 = trials[0]!;
    rc.handlePress(t0.targets[0]!, t0.peakTime); // one correct press
    rc.update(t0.peakTime + clock.periodMs / 4 + 1);
    expect(cap.lost).toHaveLength(1);
    expect(cap.lost[0]).toEqual([t0.targets[1]!]);
  });

  it('chord mode latches up to chord-size distinct presses and reconciles rows', () => {
    const { rc, trials, cap } = makeRun(mode({ chordSize: 2 }));
    const t0 = trials[0]!;
    expect(t0.targets).toHaveLength(2);
    rc.handlePress(t0.targets[0]!, t0.peakTime + 10);
    rc.handlePress(t0.targets[1]!, t0.peakTime + 40);
    rc.handlePress({ hand: 'r', finger: 't' }, t0.peakTime + 50); // over capacity: excess -1
    expect(cap.presses).toHaveLength(3);
    expect(cap.presses[2]!.cls).toBe('excess');
    expect(rc.score).toBe(5); // 3 + 3 - 1
    rc.update(t0.peakTime + 1001);
    expect(cap.resolved[0]).toHaveLength(3);
    const targetRows = cap.resolved[0]!.filter((r) => r.targetFinger !== 'x');
    const offsets = targetRows.map((r) => r.pressOffsetMs).sort((a, b) => a! - b!);
    expect(offsets).toEqual([10, 40]);
    const excessRow = cap.resolved[0]!.find((r) => r.targetFinger === 'x')!;
    expect(excessRow.pressedFinger).toBe('t');
    expect(excessRow.pressedHand).toBe('r');
    expect(excessRow.pressOffsetMs).toBe(50);
    expect(excessRow.points).toBe(-1);
  });

  it('chord wrong press is attributed to the nearest object in the CSV', () => {
    const { rc, trials, cap } = makeRun(mode({ chordSize: 2 }), 7);
    const t0 = trials[0]!;
    // One correct press, one wrong press.
    const wrong: FingerSlot = { hand: t0.targets[0]!.hand, finger: (['t', 'i', 'm', 'r', 'l'] as const).find(
      (f) => !t0.targets.some((x) => x.finger === f),
    )! };
    rc.handlePress(t0.targets[0]!, t0.peakTime);
    rc.handlePress(wrong, t0.peakTime + 30);
    expect(rc.score).toBe(4); // 3 + 1, points final at press time
    rc.update(t0.peakTime + 1001);
    const rows = cap.resolved[0]!;
    const correctRow = rows.find((r) => r.targetFinger === t0.targets[0]!.finger)!;
    const otherRow = rows.find((r) => r.targetFinger !== t0.targets[0]!.finger)!;
    expect(correctRow.pressedFinger).toBe(t0.targets[0]!.finger);
    expect(otherRow.pressedFinger).toBe(wrong.finger); // nearest-object attribution
    expect(otherRow.points).toBe(1);
  });

  it('runs to completion over the whole schedule', () => {
    const { rc, trials, cap, clock } = makeRun();
    rc.update(clock.farApexTime(trials.length) + 1);
    expect(cap.completed).toBe(true);
    expect(rc.done).toBe(true);
    expect(rc.results).toHaveLength(trials.length);
    expect(cap.resolved).toHaveLength(trials.length);
  });
});

describe('normalizeTimestamp', () => {
  it('keeps sane event timestamps', () => {
    expect(normalizeTimestamp(1000, 1003)).toBe(1000);
  });
  it('falls back when the timestamp is not on the performance timeline', () => {
    expect(normalizeTimestamp(1.7e12, 5000)).toBe(5000);
  });
});
