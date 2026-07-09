import type { GameConfig } from '../config/types';
import type { FingerSlot } from '../core/types';
import { slotKey } from '../core/types';
import { buildCodeMap } from './inputMap';
import { normalizeTimestamp } from '../core/run';

export interface SlotPress {
  slot: FingerSlot;
  /** Normalized high-res timestamp on the performance.now() timeline. */
  t: number;
}

export type PressListener = (press: SlotPress) => void;

/**
 * Global keyboard capture. Maps physical key positions (event.code) to
 * finger slots, filters auto-repeat, and requires a keyup between latches
 * of the same key so held keys can't fire across cycles.
 */
export class KeyboardInput {
  private readonly codeMap: Map<string, FingerSlot>;
  private readonly heldSlots = new Set<string>();
  private listener: PressListener | null = null;
  /** When true, preventDefault() on mapped game keys. */
  captureKeys = false;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const slot = this.codeMap.get(e.code);
    if (!slot) return;
    if (this.captureKeys) e.preventDefault();
    if (e.repeat) return;
    const key = slotKey(slot);
    if (this.heldSlots.has(key)) return; // no keyup seen since last press
    this.heldSlots.add(key);
    this.listener?.({ slot, t: normalizeTimestamp(e.timeStamp, performance.now()) });
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const slot = this.codeMap.get(e.code);
    if (slot) this.heldSlots.delete(slotKey(slot));
  };

  private readonly onBlur = (): void => {
    this.heldSlots.clear();
  };

  constructor(cfg: GameConfig) {
    this.codeMap = buildCodeMap(cfg);
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('blur', this.onBlur);
  }

  setListener(listener: PressListener | null): void {
    this.listener = listener;
  }

  /** Codes currently held (for the press-all gate's chord check). */
  get heldCount(): number {
    return this.heldSlots.size;
  }

  isHeld(slot: FingerSlot): boolean {
    return this.heldSlots.has(slotKey(slot));
  }
}
