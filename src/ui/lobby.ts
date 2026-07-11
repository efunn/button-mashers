import type { GameConfig } from '../config/types';
import type { ModeSelection, RunRecord } from '../core/types';
import { planSchedule } from '../core/trialGen';
import { resultsToCsv, csvFilename } from '../data/csv';
import { downloadCsv } from '../data/download';
import { listRunIds, loadRun } from '../data/store';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

/** Wires the lobby panel: mode selectors, nickname, run info, past runs. */
export class LobbyUI {
  readonly panel = el<HTMLElement>('lobby');
  private readonly nicknameInput = el<HTMLInputElement>('nickname');
  private readonly runInfo = el<HTMLElement>('run-info');
  private mode: ModeSelection;
  onModeChange: ((mode: ModeSelection) => void) | null = null;
  onReady: (() => void) | null = null;

  constructor(
    private readonly cfg: GameConfig,
    identifier: string,
    initialNickname: string,
    private readonly mobile: boolean,
  ) {
    el<HTMLElement>('identifier').textContent = identifier;
    this.nicknameInput.value = initialNickname;

    const difficulties = Object.keys(cfg.difficulties);
    const defaultDifficulty = difficulties.includes('medium') ? 'medium' : difficulties[0]!;
    this.mode = {
      hands: 'right',
      fingersPerHand: mobile ? (cfg.modes.mobile.fingers as 3 | 4 | 5) : 5,
      chordSize: 1,
      difficulty: defaultDifficulty,
    };

    // Build difficulty segment from config.
    const diffSeg = el<HTMLElement>('sel-difficulty');
    for (const name of difficulties) {
      const btn = document.createElement('button');
      btn.dataset.value = name;
      btn.textContent = name;
      if (name === defaultDifficulty) btn.classList.add('active');
      diffSeg.appendChild(btn);
    }

    this.wireSegment('sel-hands', (v) => (this.mode.hands = v as ModeSelection['hands']));
    this.wireSegment('sel-fingers', (v) => (this.mode.fingersPerHand = Number(v) as 3 | 4 | 5));
    this.wireSegment('sel-chord', (v) => (this.mode.chordSize = Number(v) as 1 | 2 | 3));
    this.wireSegment('sel-difficulty', (v) => (this.mode.difficulty = v));

    if (mobile) this.applyMobileConstraints();

    el<HTMLButtonElement>('ready').addEventListener('click', () => this.onReady?.());
    this.nicknameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.onReady?.();
    });

    this.updateRunInfo();
    this.renderPastRuns();
  }

  private wireSegment(id: string, apply: (value: string) => void): void {
    const seg = el<HTMLElement>(id);
    seg.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn || btn.disabled || !btn.dataset.value) return;
      for (const b of seg.querySelectorAll('button')) b.classList.remove('active');
      btn.classList.add('active');
      apply(btn.dataset.value);
      if (this.mobile) this.applyMobileConstraints();
      this.updateRunInfo();
      this.onModeChange?.(this.getMode());
    });
  }

  private applyMobileConstraints(): void {
    // Mobile: one hand, chords capped at maxChord; 3/4/5 fingers all allowed.
    const { maxChord } = this.cfg.modes.mobile;
    if (this.mode.hands === 'both') this.mode.hands = 'right';
    if (this.mode.chordSize > maxChord) this.mode.chordSize = maxChord as 1 | 2 | 3;
    this.setSegment('sel-fingers', String(this.mode.fingersPerHand), []);
    this.setSegment('sel-hands', this.mode.hands, ['both']);
    this.setSegment('sel-chord', String(this.mode.chordSize), maxChord < 3 ? ['3'] : []);
  }

  private setSegment(id: string, value: string, disabled: string[]): void {
    for (const btn of el<HTMLElement>(id).querySelectorAll('button')) {
      btn.classList.toggle('active', btn.dataset.value === value);
      btn.disabled = disabled.includes(btn.dataset.value ?? '');
    }
  }

  getMode(): ModeSelection {
    return { ...this.mode };
  }

  get nickname(): string {
    return this.nicknameInput.value.trim();
  }

  private updateRunInfo(): void {
    const plan = planSchedule(this.getMode(), this.cfg);
    const totalSec = Math.round(plan.runDurationMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = String(totalSec % 60).padStart(2, '0');
    this.runInfo.textContent =
      `${plan.totalTrials} waves · ${mins}:${secs}` +
      (plan.numSets === 1 ? ' · single combination' : '');
    this.runInfo.classList.toggle('warn', plan.outOfBounds);
    if (plan.outOfBounds) {
      this.runInfo.textContent += ' · outside configured length bounds';
    }
  }

  renderPastRuns(): void {
    const list = el<HTMLElement>('past-runs');
    list.innerHTML = '';
    const ids = listRunIds().slice().reverse().slice(0, 12);
    for (const id of ids) {
      const record = loadRun(id);
      if (!record) continue;
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'run-label';
      label.textContent = `${record.startedAtIso.slice(0, 16).replace('T', ' ')} · ${record.score} pts${record.aborted ? ' · aborted' : ''}`;
      const btn = document.createElement('button');
      btn.textContent = 'csv';
      btn.addEventListener('click', () => downloadRecord(record));
      li.append(label, btn);
      list.appendChild(li);
    }
    el<HTMLElement>('past-runs-wrap').classList.toggle('hidden', ids.length === 0);
  }

  show(visible: boolean): void {
    this.panel.classList.toggle('hidden', !visible);
  }
}

export function downloadRecord(record: RunRecord): string {
  const filename = csvFilename({
    identifier: record.identifier,
    nickname: record.nickname,
    mode: record.mode,
    startedAt: new Date(record.startedAtIso),
    aborted: record.aborted,
  });
  downloadCsv(filename, resultsToCsv(record.results));
  return filename;
}
