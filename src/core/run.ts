import type { GameConfig } from '../config/types';
import type { FingerSlot, PressClass, PressEvent, Trial, TrialResult } from './types';
import { sameSlot, slotKey } from './types';
import { RippleClock } from './clock';
import { classifyPress, pointsFor } from './scoring';
import { reconcile } from './reconcile';

export interface RunEvents {
  /** A mapped press was processed (latched or not). Fired at press time. */
  onPress(press: PressEvent, cls: PressClass, trial: Trial | null): void;
  /** Targets that floated back out with no press against them. */
  onObjectsLost(trial: Trial, lostTargets: FingerSlot[]): void;
  /** All presses for the trial's cycle are final; CSV rows emitted. */
  onTrialResolved(trial: Trial, results: TrialResult[]): void;
  onComplete(): void;
}

/**
 * Drives one run: latches presses per ripple cycle, scores them at press
 * time, and resolves each trial into CSV rows at the cycle boundary. All
 * decisions compare event timestamps against precomputed times — never
 * rendered state.
 */
export class RunController {
  readonly rawPresses: PressEvent[] = [];
  readonly results: TrialResult[] = [];
  score = 0;
  done = false;

  private readonly pressesByCycle = new Map<number, PressEvent[]>();
  /** Penalized presses beyond the per-cycle limit; become target='x' rows. */
  private readonly excessByCycle = new Map<number, PressEvent[]>();
  private readonly lostEmitted = new Set<number>();
  private resolvedThrough = -1;
  /** "Object lost" feedback fires this long after the peak. */
  private readonly lostDelayMs: number;

  constructor(
    readonly trials: Trial[],
    readonly clock: RippleClock,
    private readonly cfg: GameConfig,
    private readonly columnX: (slot: FingerSlot) => number,
    private readonly events: RunEvents,
  ) {
    this.lostDelayMs = clock.periodMs / 4;
  }

  trialForCycle(cycle: number): Trial | null {
    return cycle >= 0 && cycle < this.trials.length ? this.trials[cycle]! : null;
  }

  /** Current (unresolved) trial, for rendering. */
  currentTrial(now: number): Trial | null {
    return this.trialForCycle(this.clock.cycleAt(now));
  }

  handlePress(slot: FingerSlot, t: number): void {
    if (this.done) return;
    const cycle = this.clock.cycleAt(t);
    const trial = this.trialForCycle(cycle);
    if (trial === null || cycle <= this.resolvedThrough) {
      // Outside the schedule (or a stale delivery); raw-log only.
      this.rawPresses.push({ slot, t, offsetMs: NaN, cycle, latched: false, points: 0 });
      return;
    }

    let cyclePresses = this.pressesByCycle.get(cycle);
    if (!cyclePresses) {
      cyclePresses = [];
      this.pressesByCycle.set(cycle, cyclePresses);
    }

    const offsetMs = t - trial.peakTime;
    const isRepeatKey = cyclePresses.some((p) => sameSlot(p.slot, slot));
    const hasCapacity = cyclePresses.length < trial.targets.length;
    const latched = !isRepeatKey && hasCapacity;

    const hitTargetSlot = trial.targets.some((target) => sameSlot(target, slot));
    // Beyond the per-cycle limit (or a mashed repeat): penalized regardless
    // of timing, and recorded as its own target='x' row at resolve.
    const cls: PressClass = latched ? classifyPress(offsetMs, hitTargetSlot, this.cfg.ripple) : 'excess';
    const points = pointsFor(cls, this.cfg.scoring);

    const press: PressEvent = { slot, t, offsetMs, cycle, latched, points };
    this.rawPresses.push(press);
    this.score += points;

    if (latched) {
      cyclePresses.push(press);
    } else {
      let excess = this.excessByCycle.get(cycle);
      if (!excess) {
        excess = [];
        this.excessByCycle.set(cycle, excess);
      }
      excess.push(press);
    }
    this.events.onPress(press, cls, trial);
  }

  /** Advance trial resolution to `now`. Idempotent; catches up across stalls. */
  update(now: number): void {
    if (this.done) return;

    // "Lost" feedback for the in-flight cycle's untouched objects. Uses the
    // same reconciliation as resolve, so a target that a latched
    // wrong-finger press will claim is not falsely flagged as a no-press.
    const currentCycle = this.clock.cycleAt(now);
    const current = this.trialForCycle(currentCycle);
    if (current && !this.lostEmitted.has(currentCycle) && now >= current.peakTime + this.lostDelayMs) {
      this.lostEmitted.add(currentCycle);
      const cyclePresses = this.pressesByCycle.get(currentCycle) ?? [];
      const lost = reconcile(current.targets, cyclePresses, this.columnX)
        .filter((a) => a.press === null)
        .map((a) => current.targets[a.targetIndex]!);
      if (lost.length > 0) this.events.onObjectsLost(current, lost);
    }

    while (
      this.resolvedThrough + 1 < this.trials.length &&
      now >= this.clock.farApexTime(this.resolvedThrough + 2)
    ) {
      this.resolveCycle(this.resolvedThrough + 1);
    }

    if (this.resolvedThrough === this.trials.length - 1) {
      this.done = true;
      this.events.onComplete();
    }
  }

  /** Resolve all remaining latched presses immediately (run abort). */
  finalize(): void {
    if (this.done) return;
    // Only resolve cycles whose window has fully passed; in-flight trials
    // with a live window are dropped rather than recorded as misses.
    this.done = true;
  }

  private resolveCycle(cycle: number): void {
    const trial = this.trials[cycle]!;
    const presses = this.pressesByCycle.get(cycle) ?? [];
    const assignments = reconcile(trial.targets, presses, this.columnX);

    const rows: TrialResult[] = assignments.map(({ targetIndex, press }) => {
      const target = trial.targets[targetIndex]!;
      return {
        trial: trial.index,
        targetFinger: target.finger,
        targetHand: target.hand,
        pressedFinger: press ? press.slot.finger : 'x',
        pressedHand: press ? press.slot.hand : 'x',
        timingMs: trial.reactionTimeMs,
        pressOffsetMs: press ? Math.round(press.offsetMs) : null,
        points: press ? press.points : this.cfg.scoring.noPress,
        chordSize: trial.targets.length,
        cycle: trial.cycle,
      };
    });

    // Penalized excess presses belong to no object: target = 'x'.
    for (const press of this.excessByCycle.get(cycle) ?? []) {
      rows.push({
        trial: trial.index,
        targetFinger: 'x',
        targetHand: 'x',
        pressedFinger: press.slot.finger,
        pressedHand: press.slot.hand,
        timingMs: trial.reactionTimeMs,
        pressOffsetMs: Math.round(press.offsetMs),
        points: press.points,
        chordSize: trial.targets.length,
        cycle: trial.cycle,
      });
    }

    // No-press penalties change the score at resolve time.
    for (const row of rows) {
      if (row.pressedFinger === 'x' && row.targetFinger !== 'x') {
        this.score += row.points;
      }
    }

    this.results.push(...rows);
    this.pressesByCycle.delete(cycle);
    this.excessByCycle.delete(cycle);
    this.resolvedThrough = cycle;
    this.events.onTrialResolved(trial, rows);
  }
}

/** Used by keyboard input: sanity-check event.timeStamp against performance.now(). */
export function normalizeTimestamp(eventTimeStamp: number, nowAtHandler: number): number {
  // Some engines report epoch-based or otherwise incomparable timestamps;
  // if the value is wildly off the performance.now() timeline, fall back.
  return Math.abs(eventTimeStamp - nowAtHandler) > 5000 ? nowAtHandler : eventTimeStamp;
}

export function slotList(slots: FingerSlot[]): string {
  return slots.map(slotKey).join(',');
}
