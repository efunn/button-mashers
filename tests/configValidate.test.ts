import { describe, expect, it } from 'vitest';
import { validateConfig } from '../src/config/validate';
import { stripJsonComments } from '../src/config/load';
import { testConfig } from './helpers';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('validateConfig', () => {
  it('accepts a complete config', () => {
    const cfg = validateConfig(JSON.parse(JSON.stringify(testConfig())));
    expect(cfg.ripple.frequencyHz).toBe(0.5);
    expect(Object.keys(cfg.difficulties)).toContain('medium');
  });

  it('accepts the shipped public/game-config.json (with comments)', () => {
    const path = fileURLToPath(new URL('../public/game-config.json', import.meta.url));
    const raw = JSON.parse(stripJsonComments(readFileSync(path, 'utf-8')));
    const cfg = validateConfig(raw);
    expect(cfg.keys.l.t).toBe('KeyV');
    expect(cfg.keys.r.t).toBe('KeyN');
    expect(cfg.modes.threeFingerSet).toEqual(['i', 'm', 'r']);
  });

  it('rejects missing sections and bad values with descriptive paths', () => {
    const base = JSON.parse(JSON.stringify(testConfig())) as Record<string, unknown>;
    expect(() => validateConfig({ ...base, ripple: undefined })).toThrow(/ripple/);
    expect(() => validateConfig({ ...base, difficulties: {} })).toThrow(/difficulties/);

    const badTiming = JSON.parse(JSON.stringify(testConfig()));
    badTiming.difficulties.easy.reactionTimesMs = [500, 'x'];
    expect(() => validateConfig(badTiming)).toThrow(/reactionTimesMs/);

    const badBounds = JSON.parse(JSON.stringify(testConfig()));
    badBounds.run.trialCountBounds = [200, 100];
    expect(() => validateConfig(badBounds)).toThrow(/trialCountBounds/);

    const oldScoring = JSON.parse(JSON.stringify(testConfig()));
    oldScoring.scoring = { correct: 3, wrongFinger: 1, miss: 0 }; // pre-0.1.1 shape
    expect(() => validateConfig(oldScoring)).toThrow(/scoring\.(earlyLate|noPress|excessPress)/);
  });

  it('rejects duplicate key codes', () => {
    const dup = JSON.parse(JSON.stringify(testConfig()));
    dup.keys.r.l = 'KeyQ'; // already left little
    expect(() => validateConfig(dup)).toThrow(/duplicates key code "KeyQ"/);
  });
});

describe('stripJsonComments', () => {
  it('strips // and /* */ outside strings, preserves them inside strings', () => {
    const src = '{\n// note\n"a": "http://x", /* b */ "c": 1\n}';
    expect(JSON.parse(stripJsonComments(src))).toEqual({ a: 'http://x', c: 1 });
  });
});
