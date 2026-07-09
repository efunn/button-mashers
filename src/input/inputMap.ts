import type { GameConfig } from '../config/types';
import type { FingerSlot, Hand, Finger } from '../core/types';
import { FINGERS, HANDS, slotKey } from '../core/types';

/** code -> slot lookup built from config. */
export function buildCodeMap(cfg: GameConfig): Map<string, FingerSlot> {
  const map = new Map<string, FingerSlot>();
  for (const hand of HANDS) {
    for (const finger of FINGERS) {
      map.set(cfg.keys[hand][finger], { hand, finger });
    }
  }
  return map;
}

export function codeForSlot(cfg: GameConfig, slot: FingerSlot): string {
  return cfg.keys[slot.hand][slot.finger];
}

/** QWERTY fallback label for a KeyboardEvent.code. */
function fallbackLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

/**
 * Best-effort display labels for key codes (AZERTY etc. via the Keyboard
 * API where available; QWERTY letters otherwise).
 */
export async function keyLabels(cfg: GameConfig): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const codes = [...buildCodeMap(cfg).keys()];
  let layout: { get(code: string): string | undefined } | null = null;
  const kbd = (navigator as { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard;
  if (kbd?.getLayoutMap) {
    try {
      layout = await kbd.getLayoutMap();
    } catch {
      layout = null;
    }
  }
  for (const code of codes) {
    labels.set(code, (layout?.get(code) ?? fallbackLabel(code)).toUpperCase());
  }
  return labels;
}

const FINGER_NAMES: Record<Finger, string> = {
  t: 'thumb',
  i: 'index',
  m: 'middle',
  r: 'ring',
  l: 'little',
};
const HAND_NAMES: Record<Hand, string> = { l: 'left', r: 'right' };

export function describeSlot(slot: FingerSlot): string {
  return `${HAND_NAMES[slot.hand]} ${FINGER_NAMES[slot.finger]}`;
}

export { slotKey };
