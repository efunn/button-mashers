import type { RippleConfig, ScoringConfig } from '../config/types';
import type { PressClass } from './types';

/** Is a peak-relative offset inside the capture window? */
export function inWindow(offsetMs: number, ripple: RippleConfig): boolean {
  return Math.abs(offsetMs - ripple.windowCenterOffsetMs) <= ripple.captureWindowMs / 2;
}

/**
 * Classify a press by its peak-relative offset and whether it hit a target
 * slot. Points are press-intrinsic: they do not depend on which object the
 * press is later attributed to.
 */
export function classifyPress(
  offsetMs: number,
  hitTargetSlot: boolean,
  ripple: RippleConfig,
): PressClass {
  if (!inWindow(offsetMs, ripple)) {
    return offsetMs < ripple.windowCenterOffsetMs ? 'early' : 'late';
  }
  return hitTargetSlot ? 'correct' : 'wrongFinger';
}

export function pointsFor(cls: PressClass, scoring: ScoringConfig): number {
  switch (cls) {
    case 'correct':
      return scoring.correct;
    case 'wrongFinger':
      return scoring.wrongFinger;
    case 'early':
    case 'late':
      return scoring.earlyLate;
    case 'excess':
      return scoring.excessPress;
  }
}
