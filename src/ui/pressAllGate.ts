import type { FingerSlot } from '../core/types';
import { slotKey } from '../core/types';

/**
 * "PRESS ALL TO START": each mapped press latches its highlight; the gate
 * completes when every active slot has been pressed at least once.
 *
 * Doubles as a keyboard-rollover check for chord modes: we record the
 * largest number of active keys observed held simultaneously. On 2KRO
 * keyboards adjacent-key chords can silently drop — the run record keeps
 * this so the researcher can spot ghosting-limited sessions.
 */
export class PressAllGate {
  private readonly required = new Set<string>();
  private readonly latched = new Set<string>();
  maxSimultaneousHeld = 0;

  constructor(slots: FingerSlot[]) {
    for (const slot of slots) this.required.add(slotKey(slot));
  }

  press(slot: FingerSlot, heldCount: number): void {
    const key = slotKey(slot);
    if (this.required.has(key)) this.latched.add(key);
    this.maxSimultaneousHeld = Math.max(this.maxSimultaneousHeld, heldCount);
  }

  isLatched(slot: FingerSlot): boolean {
    return this.latched.has(slotKey(slot));
  }

  get complete(): boolean {
    return this.latched.size === this.required.size;
  }

  get progress(): { latched: number; total: number } {
    return { latched: this.latched.size, total: this.required.size };
  }

  reset(): void {
    this.latched.clear();
    this.maxSimultaneousHeld = 0;
  }
}
