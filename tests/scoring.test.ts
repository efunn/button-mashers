import { describe, expect, it } from 'vitest';
import { classifyPress, inWindow, pointsFor } from '../src/core/scoring';
import { testConfig } from './helpers';

const cfg = testConfig();

describe('scoring', () => {
  it('window boundaries are inclusive at exactly ±w/2', () => {
    expect(inWindow(-100, cfg.timing)).toBe(true);
    expect(inWindow(100, cfg.timing)).toBe(true);
    expect(inWindow(-100.001, cfg.timing)).toBe(false);
    expect(inWindow(100.001, cfg.timing)).toBe(false);
    expect(inWindow(0, cfg.timing)).toBe(true);
  });

  it('classifies correct / wrong / early / late', () => {
    expect(classifyPress(0, true, cfg.timing)).toBe('correct');
    expect(classifyPress(50, false, cfg.timing)).toBe('wrongFinger');
    expect(classifyPress(-300, true, cfg.timing)).toBe('early');
    expect(classifyPress(300, true, cfg.timing)).toBe('late');
  });

  it('respects windowCenterOffsetMs', () => {
    const ripple = { ...cfg.timing, windowCenterOffsetMs: -50 };
    expect(inWindow(-150, ripple)).toBe(true);
    expect(inWindow(51, ripple)).toBe(false);
    expect(classifyPress(60, true, ripple)).toBe('late');
  });

  it('maps classes to configured points', () => {
    expect(pointsFor('correct', cfg.scoring)).toBe(3);
    expect(pointsFor('wrongFinger', cfg.scoring)).toBe(1);
    expect(pointsFor('early', cfg.scoring)).toBe(0);
    expect(pointsFor('late', cfg.scoring)).toBe(0);
    expect(pointsFor('excess', cfg.scoring)).toBe(-1);
  });
});
