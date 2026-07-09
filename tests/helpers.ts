import type { GameConfig } from '../src/config/types';
import type { ModeSelection } from '../src/core/types';

export function testConfig(overrides?: Partial<GameConfig>): GameConfig {
  return {
    ripple: { frequencyHz: 0.5, captureWindowMs: 200, windowCenterOffsetMs: 0, amplitudePx: 260 },
    difficulties: {
      easy: { reactionTimesMs: [500, 650, 800, 1000, 1200] },
      medium: { reactionTimesMs: [350, 450, 550, 700, 900] },
      hard: { reactionTimesMs: [150, 225, 300, 400, 500] },
      eight: { reactionTimesMs: [200, 250, 300, 350, 400, 450, 500, 550] },
    },
    run: { targetTrialCount: 150, trialCountBounds: [120, 200] },
    scoring: { correct: 3, wrongFinger: 1, earlyLate: 0, noPress: -1, excessPress: -1 },
    keys: {
      l: { l: 'KeyQ', r: 'KeyW', m: 'KeyE', i: 'KeyR', t: 'KeyV' },
      r: { t: 'KeyN', i: 'KeyU', m: 'KeyI', r: 'KeyO', l: 'KeyP' },
    },
    visuals: {
      fingerColors: { t: '#f4b942', i: '#e4572e', m: '#2ab7a9', r: '#5c6bc0', l: '#ab5cc0' },
      handShapes: { l: 'leaf', r: 'shell' },
      popDurationMs: 380,
      scoreFloatDurationMs: 900,
      glowIntensity: 0,
    },
    modes: { threeFingerSet: ['i', 'm', 'r'], singleHandThumbKey: 'Space', mobile: { fingers: 3, maxChord: 2 } },
    audio: { masterVolume: 0.5 },
    ...overrides,
  };
}

export function mode(overrides?: Partial<ModeSelection>): ModeSelection {
  return { hands: 'left', fingersPerHand: 5, chordSize: 1, difficulty: 'medium', ...overrides };
}
