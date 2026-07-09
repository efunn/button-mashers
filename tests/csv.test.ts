import { describe, expect, it } from 'vitest';
import { CSV_HEADER, csvFilename, resultsToCsv, sanitizeNickname } from '../src/data/csv';
import type { TrialResult } from '../src/core/types';
import { mode } from './helpers';

const row = (overrides?: Partial<TrialResult>): TrialResult => ({
  trial: 1,
  targetFinger: 'i',
  targetHand: 'l',
  pressedFinger: 'i',
  pressedHand: 'l',
  timingMs: 500,
  pressOffsetMs: -23,
  points: 3,
  chordSize: 1,
  cycle: 0,
  ...overrides,
});

describe('resultsToCsv', () => {
  it('writes the spec columns in order', () => {
    const csv = resultsToCsv([row()]);
    const [header, line] = csv.trim().split('\n');
    expect(header).toBe(CSV_HEADER);
    expect(line).toBe('1,i,l,i,l,500,-23,3,1,0');
  });

  it('writes x/x and empty press_ms for non-presses', () => {
    const csv = resultsToCsv([
      row({ trial: 2, pressedFinger: 'x', pressedHand: 'x', pressOffsetMs: null, points: 0 }),
    ]);
    expect(csv.trim().split('\n')[1]).toBe('2,i,l,x,x,500,,0,1,0');
  });

  it('writes excess-press rows with x targets and negative points', () => {
    const csv = resultsToCsv([
      row({ trial: 3, targetFinger: 'x', targetHand: 'x', pressedFinger: 'm', pressedHand: 'r', pressOffsetMs: 42, points: -1, chordSize: 2 }),
    ]);
    expect(csv.trim().split('\n')[1]).toBe('3,x,x,m,r,500,42,-1,2,0');
  });

  it('keeps negative and positive rounded offsets', () => {
    const csv = resultsToCsv([row({ pressOffsetMs: 253 }), row({ trial: 2, pressOffsetMs: -152 })]);
    const lines = csv.trim().split('\n');
    expect(lines[1]).toContain(',253,');
    expect(lines[2]).toContain(',-152,');
  });
});

describe('sanitizeNickname', () => {
  it('lowercases, strips specials, trims dashes, truncates to 16', () => {
    expect(sanitizeNickname('Ethan Oblak!')).toBe('ethan-oblak');
    expect(sanitizeNickname('--wavy~~')).toBe('wavy');
    expect(sanitizeNickname('a'.repeat(30))).toHaveLength(16);
    expect(sanitizeNickname('émil@')).toBe('mil');
  });
});

describe('csvFilename', () => {
  const startedAt = new Date(2026, 6, 8, 15, 30, 12);

  it('includes identifier, nickname, mode tag, difficulty, timestamp', () => {
    expect(
      csvFilename({ identifier: '7GK4QZ', nickname: 'Ethan', mode: mode({ hands: 'both' }), startedAt, aborted: false }),
    ).toBe('bm_7GK4QZ_ethan_b10f1o_medium_20260708-153012.csv');
  });

  it('omits empty nickname and marks aborted runs', () => {
    expect(
      csvFilename({ identifier: 'ABC123', nickname: '', mode: mode({ fingersPerHand: 3, chordSize: 2, difficulty: 'hard' }), startedAt, aborted: true }),
    ).toBe('bm_ABC123_l3f2o_hard_20260708-153012_aborted.csv');
  });
});
