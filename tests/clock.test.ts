import { describe, expect, it } from 'vitest';
import { RippleClock } from '../src/core/clock';

describe('RippleClock', () => {
  const clock = new RippleClock(1000, 0.5); // period 2000ms

  it('computes period from frequency', () => {
    expect(clock.periodMs).toBe(2000);
  });

  it('peak is halfway through each cycle', () => {
    expect(clock.peakTime(0)).toBe(2000);
    expect(clock.peakTime(3)).toBe(8000);
  });

  it('far apex is the cycle boundary', () => {
    expect(clock.farApexTime(0)).toBe(1000);
    expect(clock.farApexTime(5)).toBe(11000);
  });

  it('cycleAt maps timestamps to cycles, boundary inclusive at start', () => {
    expect(clock.cycleAt(1000)).toBe(0);
    expect(clock.cycleAt(2999.999)).toBe(0);
    expect(clock.cycleAt(3000)).toBe(1);
    expect(clock.cycleAt(999)).toBe(-1);
  });

  it('displacement is 0 at apex, 1 at peak', () => {
    expect(clock.displacement(clock.farApexTime(2))).toBeCloseTo(0, 10);
    expect(clock.displacement(clock.peakTime(2))).toBeCloseTo(1, 10);
    expect(clock.displacement(clock.farApexTime(2) + 500)).toBeCloseTo(0.5, 10);
  });

  it('press offset arithmetic: perfect=0, early negative, late positive', () => {
    const peak = clock.peakTime(4);
    expect(peak - peak).toBe(0);
    expect(peak - 152 - peak).toBe(-152);
    expect(peak + 253 - peak).toBe(253);
  });
});
