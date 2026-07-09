import { describe, expect, it } from 'vitest';
import { reconcile } from '../src/core/reconcile';
import type { FingerSlot, PressEvent } from '../src/core/types';

// Column layout mirroring on-screen order: left hand l,r,m,i,t then right t,i,m,r,l.
const ORDER = ['l:l', 'l:r', 'l:m', 'l:i', 'l:t', 'r:t', 'r:i', 'r:m', 'r:r', 'r:l'];
const columnX = (s: FingerSlot): number => ORDER.indexOf(`${s.hand}:${s.finger}`) * 100;

function slot(hand: 'l' | 'r', finger: 't' | 'i' | 'm' | 'r' | 'l'): FingerSlot {
  return { hand, finger };
}

function press(s: FingerSlot, t = 1000): PressEvent {
  return { slot: s, t, offsetMs: 0, cycle: 0, latched: true, points: 0 };
}

describe('reconcile', () => {
  it('exact matches claim their own target first', () => {
    const targets = [slot('l', 'i'), slot('l', 'r')];
    const presses = [press(slot('l', 'r')), press(slot('l', 'i'))];
    const out = reconcile(targets, presses, columnX);
    expect(out[0]!.press!.slot.finger).toBe('i');
    expect(out[1]!.press!.slot.finger).toBe('r');
  });

  it('single wrong press goes to the nearest target', () => {
    // Targets middle + thumb; press on index (adjacent to middle in column space).
    const targets = [slot('l', 'm'), slot('l', 't')];
    const presses = [press(slot('l', 'i'))];
    const out = reconcile(targets, presses, columnX);
    expect(out[0]!.press).not.toBeNull(); // l:i is 100 from l:m, 100 from l:t? -> l:i idx3, l:m idx2 (d=100), l:t idx4 (d=100)
  });

  it('minimizes total distance rather than assigning greedily in press order', () => {
    // Targets at columns 0 (l:l) and 300 (l:i); presses between them at
    // 100 (l:r) and 200 (l:m), delivered in the order [200, 100]. A greedy
    // press-order pass would still work here, but the optimal (non-crossing)
    // assignment is uniquely: 100 -> 0 and 200 -> 300.
    const targets = [slot('l', 'l'), slot('l', 'i')];
    const out = reconcile(targets, [press(slot('l', 'm'), 2), press(slot('l', 'r'), 1)], columnX);
    expect(out[0]!.press!.slot.finger).toBe('r');
    expect(out[1]!.press!.slot.finger).toBe('m');
  });

  it('cross-hand wrong press is assigned by screen distance', () => {
    const targets = [slot('r', 't'), slot('r', 'm')]; // columns 500, 700
    const presses = [press(slot('l', 't'))]; // column 400
    const out = reconcile(targets, presses, columnX);
    expect(out[0]!.press).not.toBeNull(); // r:t at 500 is nearest
    expect(out[1]!.press).toBeNull();
  });

  it('unassigned targets get null (x/x rows)', () => {
    const targets = [slot('l', 'i'), slot('l', 'm'), slot('l', 'r')];
    const out = reconcile(targets, [press(slot('l', 'm'))], columnX);
    expect(out.filter((a) => a.press === null)).toHaveLength(2);
    expect(out[1]!.press).not.toBeNull();
  });

  it('no presses -> all null', () => {
    const out = reconcile([slot('l', 'i'), slot('l', 'm')], [], columnX);
    expect(out.every((a) => a.press === null)).toBe(true);
  });

  it('equidistant ties are deterministic', () => {
    // Press exactly between two targets; run twice, same result.
    const targets = [slot('l', 'm'), slot('l', 't')]; // columns 200, 400
    const presses = [press(slot('l', 'i'))]; // column 300, d=100 to both
    const a = reconcile(targets, presses, columnX);
    const b = reconcile(targets, presses, columnX);
    expect(a[0]!.press !== null).toBe(b[0]!.press !== null);
    expect(a[1]!.press !== null).toBe(b[1]!.press !== null);
    // First-found assignment wins: target order [m, t] -> m gets it.
    expect(a[0]!.press).not.toBeNull();
  });

  it('full 3-target, 3-wrong-press permutation is assigned optimally', () => {
    const targets = [slot('r', 'i'), slot('r', 'm'), slot('r', 'r')]; // 600, 700, 800
    const presses = [
      press(slot('r', 'l'), 1), // 900
      press(slot('r', 't'), 2), // 500
      press(slot('l', 't'), 3), // 400
    ];
    const out = reconcile(targets, presses, columnX);
    expect(out.every((a) => a.press !== null)).toBe(true);

    // Achieved total distance must equal the brute-force optimum.
    const cost = out.reduce(
      (sum, a, i) => sum + Math.abs(columnX(a.press!.slot) - columnX(targets[i]!)),
      0,
    );
    const perms = [
      [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
    ];
    const optimum = Math.min(
      ...perms.map((p) =>
        p.reduce((sum, pi, ti) => sum + Math.abs(columnX(presses[pi]!.slot) - columnX(targets[ti]!)), 0),
      ),
    );
    expect(cost).toBe(optimum);

    // And the tie-break is deterministic.
    const again = reconcile(targets, presses, columnX);
    expect(again.map((a) => columnX(a.press!.slot))).toEqual(out.map((a) => columnX(a.press!.slot)));
  });
});
