import type { GameConfig } from '../config/types';
import type { FingerSlot } from '../core/types';
import { slotKey } from '../core/types';
import { orderSlotsForDisplay, type Layout } from '../render/layout';
import type { PressListener } from './keyboard';

export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window;
}

/**
 * Mobile virtual buttons filling the space from the bottom of the wave down
 * to the bottom of the screen. The four fingers sit in a row; if the mode
 * includes the thumb (5-finger), it becomes a full-width button underneath
 * the row ("thumb underneath"). Multi-touch capable for 2-object chords.
 */
export class TouchInput {
  private listener: PressListener | null = null;
  private readonly container: HTMLElement;
  /** Last-built slots, so a resize can reposition without a rebuild. */
  private lastSlots: FingerSlot[] | null = null;
  private lastCfg: GameConfig | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setListener(listener: PressListener | null): void {
    this.listener = listener;
  }

  private makeButton(slot: FingerSlot, cfg: GameConfig, cls?: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    if (cls) btn.className = cls;
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
    return btn;
  }

  /**
   * (Re)build for the active slots, in on-screen column order (matches the
   * canvas layout — fixes mirrored colors for the left hand). `layout`
   * anchors the top edge to the wave's lowest point.
   */
  build(slots: FingerSlot[], cfg: GameConfig, layout: Layout): void {
    this.lastSlots = slots;
    this.lastCfg = cfg;
    this.container.innerHTML = '';

    const ordered = orderSlotsForDisplay(slots);
    const thumb = ordered.find((s) => s.finger === 't') ?? null;
    const fingers = ordered.filter((s) => s.finger !== 't');

    const row = document.createElement('div');
    row.className = 'touch-row';
    for (const slot of fingers) row.appendChild(this.makeButton(slot, cfg));
    this.container.appendChild(row);

    if (thumb) this.container.appendChild(this.makeButton(thumb, cfg, 'touch-thumb'));

    this.position(layout);
  }

  /** Anchor the container top just below the target line. */
  position(layout: Layout): void {
    this.container.style.top = `${Math.round(layout.crosshairY + layout.fingerRadius + 18)}px`;
  }

  /** Reposition on resize without rebuilding (no-op if never built). */
  reflow(layout: Layout): void {
    if (this.lastSlots && this.lastCfg) this.position(layout);
  }

  show(visible: boolean): void {
    this.container.classList.toggle('hidden', !visible);
  }
}
