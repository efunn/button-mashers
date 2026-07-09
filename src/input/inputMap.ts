import type { GameConfig } from '../config/types';
import type { FingerSlot, Hand, Finger, ModeSelection } from '../core/types';
import { FINGERS, HANDS, slotKey } from '../core/types';

/** code -> slot lookup built from config (both-hands layout). */
export function buildCodeMap(cfg: GameConfig): Map<string, FingerSlot> {
  const map = new Map<string, FingerSlot>();
  for (const hand of HANDS) {
    for (const finger of FINGERS) {
      map.set(cfg.keys[hand][finger], { hand, finger });
    }
  }
  return map;
}

/**
 * The key code for a slot under a given mode: in single-hand modes the
 * played hand's thumb moves to the spacebar (replacing V/N); ten-finger
 * (both hands) keeps the configured thumb keys.
 */
export function effectiveCodeForSlot(cfg: GameConfig, mode: ModeSelection, slot: FingerSlot): string {
  const playedHand: Hand | null = mode.hands === 'left' ? 'l' : mode.hands === 'right' ? 'r' : null;
  if (playedHand !== null && slot.hand === playedHand && slot.finger === 't') {
    return cfg.modes.singleHandThumbKey;
  }
  return cfg.keys[slot.hand][slot.finger];
}

/** code -> slot lookup for a mode. The replaced thumb key is unmapped. */
export function buildEffectiveCodeMap(cfg: GameConfig, mode: ModeSelection): Map<string, FingerSlot> {
  const map = new Map<string, FingerSlot>();
  for (const hand of HANDS) {
    for (const finger of FINGERS) {
      const slot: FingerSlot = { hand, finger };
      map.set(effectiveCodeForSlot(cfg, mode, slot), slot);
    }
  }
  return map;
}

export function codeForSlot(cfg: GameConfig, slot: FingerSlot): string {
  return cfg.keys[slot.hand][slot.finger];
}

/** QWERTY fallback label for a KeyboardEvent.code. */
function fallbackLabel(code: string): string {
  if (code === 'Space') return '_';
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
  const codes = [...buildCodeMap(cfg).keys(), cfg.modes.singleHandThumbKey];
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
    // Space always displays as '_' (a layout map would return ' ').
    const label = code === 'Space' ? '_' : (layout?.get(code) ?? fallbackLabel(code)).toUpperCase();
    labels.set(code, label.trim() === '' ? fallbackLabel(code) : label);
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
