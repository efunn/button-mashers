import type { Finger, FingerSlot, Hand } from '../core/types';
import { slotKey } from '../core/types';

/** All geometry in CSS pixels; canvases are DPR-scaled elsewhere. */
export interface Layout {
  width: number;
  height: number;
  /** Vertical center of the finger key buttons (lobby / press-all screens). */
  fingerY: number;
  /** The target line: bands cross it exactly at their trial's peak time. */
  crosshairY: number;
  /** Normalized vertical height shared by both object shapes and the band. */
  objectHeight: number;
  /** Top of the fall corridor: bands fade in just below this. */
  topMarginPx: number;
  columns: Map<string, number>;
  orderedSlots: FingerSlot[];
  objectRadius: number;
  fingerRadius: number;
  /** True when both hands are shown (affects the central gap). */
  twoHands: boolean;
}

/** Anatomical left-to-right display order. */
const LEFT_ORDER: Finger[] = ['l', 'r', 'm', 'i', 't'];
const RIGHT_ORDER: Finger[] = ['t', 'i', 'm', 'r', 'l'];

export function orderSlotsForDisplay(slots: FingerSlot[]): FingerSlot[] {
  const byHand = (hand: Hand, order: Finger[]): FingerSlot[] =>
    order
      .map((finger) => slots.find((s) => s.hand === hand && s.finger === finger))
      .filter((s): s is FingerSlot => s !== undefined);
  return [...byHand('l', LEFT_ORDER), ...byHand('r', RIGHT_ORDER)];
}

export function computeLayout(
  width: number,
  height: number,
  slots: FingerSlot[],
): Layout {
  const orderedSlots = orderSlotsForDisplay(slots);
  const twoHands = orderedSlots.some((s) => s.hand === 'l') && orderedSlots.some((s) => s.hand === 'r');

  // Rain falls through the upper ~62% of the screen; controls live below.
  const crosshairY = Math.round(height * 0.62);
  const topMarginPx = 20;

  // Columns: even spacing; in two-handed mode the fingers pack tighter and
  // the thumbs sit 1.5 finger-spacings apart (0.5 extra beyond normal).
  const margin = Math.max(28, width * 0.06);
  const usable = width - 2 * margin;
  const gapUnits = twoHands ? 0.5 : 0;
  const n = orderedSlots.length;
  const spacing = usable / Math.max(1, n - 1 + gapUnits);

  const columns = new Map<string, number>();
  let cursor = margin;
  // Center single groups / narrow sets rather than stretching to full width.
  const maxSpacing = Math.min(spacing, twoHands ? 80 : 110);
  const totalSpan = maxSpacing * (n - 1 + gapUnits);
  cursor = (width - totalSpan) / 2;
  let prevHand: Hand | null = null;
  for (const slot of orderedSlots) {
    if (prevHand !== null && slot.hand !== prevHand) cursor += maxSpacing * gapUnits;
    columns.set(slotKey(slot), Math.round(cursor));
    cursor += maxSpacing;
    prevHand = slot.hand;
  }
  // Remove the trailing advance for exact span; harmless either way.

  const fingerRadius = Math.max(14, Math.min(24, maxSpacing * 0.3));
  const objectRadius = Math.max(11, Math.min(20, maxSpacing * 0.26));
  const fingerY = crosshairY - fingerRadius - 14;
  const objectHeight = objectRadius * 2.1;

  return {
    width,
    height,
    fingerY,
    crosshairY,
    objectHeight,
    topMarginPx,
    columns,
    orderedSlots,
    objectRadius,
    fingerRadius,
    twoHands,
  };
}

export function columnXLookup(layout: Layout): (slot: FingerSlot) => number {
  return (slot) => layout.columns.get(slotKey(slot)) ?? layout.width / 2;
}
