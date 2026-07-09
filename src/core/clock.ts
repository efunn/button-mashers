/**
 * The single source of truth for experiment timing. All quantities are pure
 * functions of timestamps on the performance.now() timeline; rendering reads
 * displacement() but classification never reads rendered state.
 *
 * Cycle k spans [farApexTime(k), farApexTime(k+1)). The ripple is farthest
 * from the fingers at each far apex and touches the fingers at peakTime(k),
 * halfway through the cycle.
 */
export class RippleClock {
  readonly periodMs: number;

  constructor(
    /** Run start; must coincide with a far apex. */
    readonly t0: number,
    frequencyHz: number,
  ) {
    this.periodMs = 1000 / frequencyHz;
  }

  /** Time the ripple touches the fingers in cycle k. */
  peakTime(k: number): number {
    return this.t0 + (k + 0.5) * this.periodMs;
  }

  /** Cycle boundary: ripple farthest away; press latch resets here. */
  farApexTime(k: number): number {
    return this.t0 + k * this.periodMs;
  }

  /** Which cycle a timestamp falls in (negative before t0). */
  cycleAt(t: number): number {
    return Math.floor((t - this.t0) / this.periodMs);
  }

  /**
   * 0 = far apex, 1 = at the fingers. Cosine ease, so the water decelerates
   * into both extremes. RENDERING ONLY — never used for classification.
   */
  displacement(t: number): number {
    return 0.5 * (1 - Math.cos((2 * Math.PI * (t - this.t0)) / this.periodMs));
  }
}
