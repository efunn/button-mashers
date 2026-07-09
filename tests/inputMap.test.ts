import { describe, expect, it } from 'vitest';
import { buildCodeMap, buildEffectiveCodeMap, effectiveCodeForSlot } from '../src/input/inputMap';
import { mode, testConfig } from './helpers';

const cfg = testConfig();

describe('effective key mapping (spacebar thumbs)', () => {
  it('both-hands mode keeps the configured thumb keys', () => {
    const map = buildEffectiveCodeMap(cfg, mode({ hands: 'both' }));
    expect(map.get('KeyV')).toEqual({ hand: 'l', finger: 't' });
    expect(map.get('KeyN')).toEqual({ hand: 'r', finger: 't' });
    expect(map.has('Space')).toBe(false);
    expect([...map.entries()]).toEqual([...buildCodeMap(cfg).entries()]);
  });

  it('left-hand mode: Space is the left thumb, KeyV unmapped, right hand intact', () => {
    const m = mode({ hands: 'left' });
    const map = buildEffectiveCodeMap(cfg, m);
    expect(map.get('Space')).toEqual({ hand: 'l', finger: 't' });
    expect(map.has('KeyV')).toBe(false);
    expect(map.get('KeyN')).toEqual({ hand: 'r', finger: 't' }); // idle hand still recorded
    expect(map.get('KeyQ')).toEqual({ hand: 'l', finger: 'l' });
    expect(effectiveCodeForSlot(cfg, m, { hand: 'l', finger: 't' })).toBe('Space');
    expect(effectiveCodeForSlot(cfg, m, { hand: 'r', finger: 't' })).toBe('KeyN');
  });

  it('right-hand mode: Space is the right thumb, KeyN unmapped', () => {
    const map = buildEffectiveCodeMap(cfg, mode({ hands: 'right' }));
    expect(map.get('Space')).toEqual({ hand: 'r', finger: 't' });
    expect(map.has('KeyN')).toBe(false);
    expect(map.get('KeyV')).toEqual({ hand: 'l', finger: 't' });
  });

  it('applies in 3-finger single-hand modes too (thumb = wrong-finger key)', () => {
    const map = buildEffectiveCodeMap(cfg, mode({ hands: 'left', fingersPerHand: 3 }));
    expect(map.get('Space')).toEqual({ hand: 'l', finger: 't' });
  });

  it('respects a custom singleHandThumbKey', () => {
    const custom = testConfig();
    custom.modes.singleHandThumbKey = 'KeyB';
    const map = buildEffectiveCodeMap(custom, mode({ hands: 'left' }));
    expect(map.get('KeyB')).toEqual({ hand: 'l', finger: 't' });
  });
});
