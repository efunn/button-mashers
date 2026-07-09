import type { ModeSelection, TrialResult } from '../core/types';

export const CSV_HEADER =
  'trial,target_finger,target_hand,pressed_finger,pressed_hand,timing_ms,press_ms,points,chord_size,cycle';

function field(v: string | number | null): string {
  if (v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function resultsToCsv(results: TrialResult[]): string {
  const lines = [CSV_HEADER];
  for (const r of results) {
    lines.push(
      [
        field(r.trial),
        field(r.targetFinger),
        field(r.targetHand),
        field(r.pressedFinger),
        field(r.pressedHand),
        field(r.timingMs),
        field(r.pressOffsetMs),
        field(r.points),
        field(r.chordSize),
        field(r.cycle),
      ].join(','),
    );
  }
  return lines.join('\n') + '\n';
}

export function sanitizeNickname(nickname: string): string {
  return nickname
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16);
}

function modeTag(mode: ModeSelection): string {
  const hands = mode.hands === 'both' ? 'b' : mode.hands === 'left' ? 'l' : 'r';
  const fingers = (mode.hands === 'both' ? 2 : 1) * mode.fingersPerHand;
  return `${hands}${fingers}f${mode.chordSize}o`;
}

export function csvFilename(opts: {
  identifier: string;
  nickname: string;
  mode: ModeSelection;
  startedAt: Date;
  aborted: boolean;
}): string {
  const d = opts.startedAt;
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const nick = sanitizeNickname(opts.nickname);
  return [
    'bm',
    opts.identifier,
    ...(nick ? [nick] : []),
    modeTag(opts.mode),
    opts.mode.difficulty,
    stamp,
    ...(opts.aborted ? ['aborted'] : []),
  ].join('_') + '.csv';
}
