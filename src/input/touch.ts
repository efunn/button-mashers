import type { GameConfig } from '../config/types';
import type { FingerSlot } from '../core/types';
import { slotKey } from '../core/types';
import type { PressListener } from './keyboard';

export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window;
}

/**
 * Mobile virtual buttons: one per active slot, pinned to the bottom of the
 * screen. Multi-touch capable (pointer events) for 2-object chords.
 */
export class TouchInput {
  private listener: PressListener | null = null;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setListener(listener: PressListener | null): void {
    this.listener = listener;
  }

  /** (Re)build buttons for the active slots. */
  build(slots: FingerSlot[], cfg: GameConfig): void {
    this.container.innerHTML = '';
    for (const slot of slots) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = slot.finger.toUpperCase();
      btn.style.setProperty('--finger-color', cfg.visuals.fingerColors[slot.finger]);
      btn.dataset.slot = slotKey(slot);
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.classList.add('pressed');
        this.listener?.({ slot, t: e.timeStamp });
      });
      const release = (): void => btn.classList.remove('pressed');
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
      this.container.appendChild(btn);
    }
  }

  show(visible: boolean): void {
    this.container.classList.toggle('hidden', !visible);
  }
}
