import type { GameConfig } from './types';
import { FINGERS, HANDS } from '../core/types';

class ConfigError extends Error {
  constructor(path: string, message: string) {
    super(`game-config.json: ${path} ${message}`);
    this.name = 'ConfigError';
  }
}

function req(obj: unknown, path: string): Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new ConfigError(path, 'must be an object');
  }
  return obj as Record<string, unknown>;
}

function num(obj: Record<string, unknown>, path: string, key: string, opts?: { min?: number; max?: number }): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new ConfigError(`${path}.${key}`, 'must be a finite number');
  }
  if (opts?.min !== undefined && v < opts.min) throw new ConfigError(`${path}.${key}`, `must be >= ${opts.min}`);
  if (opts?.max !== undefined && v > opts.max) throw new ConfigError(`${path}.${key}`, `must be <= ${opts.max}`);
  return v;
}

function str(obj: Record<string, unknown>, path: string, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new ConfigError(`${path}.${key}`, 'must be a non-empty string');
  }
  return v;
}

function numArray(v: unknown, path: string): number[] {
  if (!Array.isArray(v) || v.length === 0 || !v.every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0)) {
    throw new ConfigError(path, 'must be a non-empty array of positive numbers');
  }
  return v as number[];
}

export function validateConfig(raw: unknown): GameConfig {
  const root = req(raw, '(root)');

  const timing = req(root.timing, 'timing');
  const timingOut = {
    captureWindowMs: num(timing, 'timing', 'captureWindowMs', { min: 20 }),
    windowCenterOffsetMs: num(timing, 'timing', 'windowCenterOffsetMs'),
  };

  const speedsRaw = req(root.speeds, 'speeds');
  const speeds: GameConfig['speeds'] = {};
  for (const [name, v] of Object.entries(speedsRaw)) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 200 || v > 20000) {
      throw new ConfigError(`speeds.${name}`, 'must be a period in ms between 200 and 20000');
    }
    speeds[name] = v;
  }
  if (Object.keys(speeds).length === 0) {
    throw new ConfigError('speeds', 'must define at least one speed');
  }
  const defaultSpeed = str(root, '(root)', 'defaultSpeed');
  if (!(defaultSpeed in speeds)) {
    throw new ConfigError('defaultSpeed', `"${defaultSpeed}" is not a key of speeds`);
  }

  const fall = req(root.fall, 'fall');
  const fallOut = { fadeLeadMs: num(fall, 'fall', 'fadeLeadMs', { min: 500 }) };

  const difficultiesRaw = req(root.difficulties, 'difficulties');
  const difficulties: GameConfig['difficulties'] = {};
  for (const [name, d] of Object.entries(difficultiesRaw)) {
    const dObj = req(d, `difficulties.${name}`);
    difficulties[name] = { reactionTimesMs: numArray(dObj.reactionTimesMs, `difficulties.${name}.reactionTimesMs`) };
  }
  if (Object.keys(difficulties).length === 0) {
    throw new ConfigError('difficulties', 'must define at least one difficulty');
  }

  // Non-fatal: reveals must land while the band is visible.
  const maxRt = Math.max(...Object.values(difficulties).flatMap((d) => d.reactionTimesMs));
  if (fallOut.fadeLeadMs < maxRt + timingOut.captureWindowMs / 2 + 100) {
    console.warn(
      `game-config.json: fall.fadeLeadMs (${fallOut.fadeLeadMs}) is shorter than the longest ` +
        `reaction time + half window; long-RT reveals may happen before the band fades in.`,
    );
  }

  const run = req(root.run, 'run');
  const bounds = run.trialCountBounds;
  if (!Array.isArray(bounds) || bounds.length !== 2 || typeof bounds[0] !== 'number' || typeof bounds[1] !== 'number' || bounds[0] > bounds[1]) {
    throw new ConfigError('run.trialCountBounds', 'must be [min, max] with min <= max');
  }
  const runOut = {
    targetTrialCount: num(run, 'run', 'targetTrialCount', { min: 1 }),
    trialCountBounds: [bounds[0], bounds[1]] as [number, number],
  };

  const scoring = req(root.scoring, 'scoring');
  const scoringOut = {
    correct: num(scoring, 'scoring', 'correct'),
    wrongFinger: num(scoring, 'scoring', 'wrongFinger'),
    earlyLate: num(scoring, 'scoring', 'earlyLate'),
    noPress: num(scoring, 'scoring', 'noPress'),
    excessPress: num(scoring, 'scoring', 'excessPress'),
  };

  const keysRaw = req(root.keys, 'keys');
  const keys = {} as GameConfig['keys'];
  const seenCodes = new Map<string, string>();
  for (const hand of HANDS) {
    const handObj = req(keysRaw[hand], `keys.${hand}`);
    keys[hand] = {} as GameConfig['keys']['l'];
    for (const finger of FINGERS) {
      const code = str(handObj, `keys.${hand}`, finger);
      const prev = seenCodes.get(code);
      if (prev) throw new ConfigError(`keys.${hand}.${finger}`, `duplicates key code "${code}" already used by ${prev}`);
      seenCodes.set(code, `keys.${hand}.${finger}`);
      keys[hand][finger] = code;
    }
  }

  const visuals = req(root.visuals, 'visuals');
  const colorsRaw = req(visuals.fingerColors, 'visuals.fingerColors');
  const fingerColors = {} as GameConfig['visuals']['fingerColors'];
  for (const finger of FINGERS) {
    fingerColors[finger] = str(colorsRaw, 'visuals.fingerColors', finger);
  }
  const shapesRaw = req(visuals.handShapes, 'visuals.handShapes');
  const handShapes = {} as GameConfig['visuals']['handShapes'];
  for (const hand of HANDS) {
    const shape = str(shapesRaw, 'visuals.handShapes', hand);
    if (shape !== 'diamond' && shape !== 'circle') {
      throw new ConfigError(`visuals.handShapes.${hand}`, 'must be "diamond" or "circle"');
    }
    handShapes[hand] = shape;
  }
  const visualsOut = {
    fingerColors,
    handShapes,
    popDurationMs: num(visuals, 'visuals', 'popDurationMs', { min: 0 }),
    scoreFloatDurationMs: num(visuals, 'visuals', 'scoreFloatDurationMs', { min: 0 }),
    // Optional: defaults to 0 (no halo) to keep older configs valid.
    glowIntensity:
      visuals.glowIntensity === undefined ? 0 : num(visuals, 'visuals', 'glowIntensity', { min: 0, max: 1 }),
  };

  const modes = req(root.modes, 'modes');
  const threeRaw = modes.threeFingerSet;
  if (!Array.isArray(threeRaw) || threeRaw.length !== 3 || !threeRaw.every((f) => (FINGERS as string[]).includes(f as string))) {
    throw new ConfigError('modes.threeFingerSet', 'must be an array of exactly 3 finger codes (t/i/m/r/l)');
  }
  const fourRaw = modes.fourFingerSet === undefined ? ['i', 'm', 'r', 'l'] : modes.fourFingerSet;
  if (!Array.isArray(fourRaw) || fourRaw.length !== 4 || !fourRaw.every((f) => (FINGERS as string[]).includes(f as string))) {
    throw new ConfigError('modes.fourFingerSet', 'must be an array of exactly 4 finger codes (t/i/m/r/l)');
  }
  const mobile = req(modes.mobile, 'modes.mobile');
  const singleHandThumbKey =
    modes.singleHandThumbKey === undefined ? 'Space' : str(modes, 'modes', 'singleHandThumbKey');
  if (seenCodes.has(singleHandThumbKey)) {
    throw new ConfigError('modes.singleHandThumbKey', `duplicates key code "${singleHandThumbKey}" already used by ${seenCodes.get(singleHandThumbKey)}`);
  }
  const modesOut = {
    threeFingerSet: threeRaw as GameConfig['modes']['threeFingerSet'],
    fourFingerSet: fourRaw as GameConfig['modes']['fourFingerSet'],
    singleHandThumbKey,
    mobile: {
      fingers: num(mobile, 'modes.mobile', 'fingers', { min: 1, max: 5 }),
      maxChord: num(mobile, 'modes.mobile', 'maxChord', { min: 1, max: 3 }),
    },
  };

  // Optional block: defaults keep older configs valid.
  const audioOut = { masterVolume: 0.5 };
  if (root.audio !== undefined) {
    const audio = req(root.audio, 'audio');
    audioOut.masterVolume = num(audio, 'audio', 'masterVolume', { min: 0, max: 1 });
  }

  return {
    timing: timingOut,
    speeds,
    defaultSpeed,
    fall: fallOut,
    difficulties,
    run: runOut,
    scoring: scoringOut,
    keys,
    visuals: visualsOut,
    modes: modesOut,
    audio: audioOut,
  };
}
