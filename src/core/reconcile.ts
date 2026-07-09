import type { FingerSlot, PressEvent } from './types';
import { sameSlot, slotKey } from './types';

/**
 * Left-to-right physical order of all ten slots. Used as the distance
 * metric for nearest-object attribution so that presses on keys outside
 * the current mode (e.g. the idle hand) still have a well-defined column.
 */
const CANONICAL_ORDER = ['l:l', 'l:r', 'l:m', 'l:i', 'l:t', 'r:t', 'r:i', 'r:m', 'r:r', 'r:l'];

export function canonicalColumnX(slot: FingerSlot): number {
  return CANONICAL_ORDER.indexOf(slotKey(slot));
}

export interface Assignment {
  targetIndex: number;
  press: PressEvent | null;
}

/**
 * Attribute latched presses to target objects for the CSV. Scores were
 * already final at press time; this only decides which object-row records
 * each press.
 *
 * 1. Presses on a target slot claim that target.
 * 2. Remaining presses go to the nearest remaining target by screen-column
 *    distance, minimizing total distance over all injective assignments
 *    (at most 3x3, so brute force). Ties break deterministically by press
 *    order, then target order.
 */
export function reconcile(
  targets: FingerSlot[],
  presses: PressEvent[],
  columnX: (slot: FingerSlot) => number,
): Assignment[] {
  const assignments: Assignment[] = targets.map((_, i) => ({ targetIndex: i, press: null }));
  const usedPress = new Set<number>();

  // Pass 1: exact slot matches.
  for (let p = 0; p < presses.length; p++) {
    const press = presses[p]!;
    for (let t = 0; t < targets.length; t++) {
      if (assignments[t]!.press === null && sameSlot(press.slot, targets[t]!)) {
        assignments[t]!.press = press;
        usedPress.add(p);
        break;
      }
    }
  }

  // Pass 2: optimal nearest-column assignment of leftovers.
  const freePresses = presses.map((_, p) => p).filter((p) => !usedPress.has(p));
  const freeTargets = assignments.filter((a) => a.press === null).map((a) => a.targetIndex);
  if (freePresses.length > 0 && freeTargets.length > 0) {
    const n = Math.min(freePresses.length, freeTargets.length);
    let best: { pairs: [number, number][]; cost: number } | null = null;

    const permute = (pool: number[], chosen: number[]): void => {
      if (chosen.length === n) {
        const pairs: [number, number][] = chosen.map((t, i) => [freePresses[i]!, t]);
        const cost = pairs.reduce(
          (sum, [p, t]) => sum + Math.abs(columnX(presses[p]!.slot) - columnX(targets[t]!)),
          0,
        );
        // Strict < keeps the first-found assignment on ties; pools are
        // iterated in press-order x target-order, making ties deterministic.
        if (best === null || cost < best.cost) best = { pairs, cost };
        return;
      }
      for (const t of pool) {
        permute(pool.filter((x) => x !== t), [...chosen, t]);
      }
    };
    permute(freeTargets, []);

    for (const [p, t] of best!.pairs) {
      assignments[t]!.press = presses[p]!;
    }
  }

  return assignments;
}
