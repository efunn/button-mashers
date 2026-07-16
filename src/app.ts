import type { GameConfig } from './config/types';
import { RippleClock } from './core/clock';
import { canonicalColumnX } from './core/reconcile';
import { RunController } from './core/run';
import type { RunEvents } from './core/run';
import { activeSlots, fillScheduleTimes, generateSchedule, periodOf } from './core/trialGen';
import type { FingerSlot, PressClass, PressEvent, RunRecord, Trial } from './core/types';
import { sameSlot, slotKey } from './core/types';
import { randomIdentifier } from './data/identifier';
import { loadProfile, saveProfile, saveRun } from './data/store';
import { KeyboardInput } from './input/keyboard';
import type { SlotPress } from './input/keyboard';
import { effectiveCodeForSlot, keyLabels } from './input/inputMap';
import { GameAudio } from './audio/sound';
import { TouchInput, isTouchDevice } from './input/touch';
import type { Effect } from './render/effects';
import type { FingerMode, FingerVisualState } from './render/fingers';
import { computeLayout, type Layout } from './render/layout';
import { fallY, renderBackground, renderFrame, pruneEffects } from './render/renderer';
import type { DebugInfo, RenderState, VisibleTrial } from './render/renderer';
import { LobbyUI, downloadRecord } from './ui/lobby';
import { PressAllGate } from './ui/pressAllGate';
import { hashString, mulberry32 } from './core/rng';

type AppState = 'lobby' | 'armed' | 'countdown' | 'running' | 'complete';

const COUNTDOWN_MIN_MS = 2600;
const STALL_ABORT_MS = 600;
const FLASH_MS = 140;
const SAVE_EVERY_TRIALS = 10;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export class App {
  private state: AppState = 'lobby';
  private readonly bg = el<HTMLCanvasElement>('bg');
  private readonly fx = el<HTMLCanvasElement>('fx');
  private readonly bgCtx = this.bg.getContext('2d')!;
  private readonly fxCtx = this.fx.getContext('2d')!;

  private idleClock: RippleClock;
  private layout: Layout;
  private labels = new Map<string, string>();
  /** slotKey -> display label under the current mode. */
  private slotLabels = new Map<string, string>();

  private readonly keyboard: KeyboardInput;
  private readonly touch: TouchInput;
  private readonly mobile = isTouchDevice();
  private readonly lobby: LobbyUI;
  private gate: PressAllGate | null = null;

  private readonly identifier: string;

  // Run state
  private runClock: RippleClock | null = null;
  private controller: RunController | null = null;
  private trials: Trial[] = [];
  private runRecord: RunRecord | null = null;
  private runStartedAt: Date | null = null;
  private countdownT0 = 0;
  private resolvedCount = 0;

  // Render-side state
  private readonly effects: Effect[] = [];
  /** Objects no longer drawn this run, keyed `${cycle}:${slotKey}`. */
  private readonly destroyed = new Map<string, 'pop' | 'glance'>();
  /** Objects cracked by early/late presses, keyed `${cycle}:${slotKey}`. */
  private readonly damagedSlots = new Set<string>();
  /** Per-cycle latched-press info driving the crosshair ammo fade. */
  private readonly latchFade = new Map<number, { firstT: number; slots: Set<string>; full: boolean }>();
  /** Visual-only randomness (glance/damage assignment), seeded per run. */
  private visualRand: () => number = Math.random;
  private readonly audio: GameAudio;
  private readonly lastPressAt = new Map<string, number>();
  private debugVisible = false;
  /** Dev/testing only (?ignore-hidden): skip abort on blur/hidden/stall. */
  private readonly ignoreInterruptions = new URLSearchParams(location.search).has('ignore-hidden');
  private lastOffsetMs: number | null = null;
  private lastFrameT = performance.now();
  private maxFrameDelta = 0;

  constructor(private readonly cfg: GameConfig) {
    this.idleClock = new RippleClock(performance.now(), 1000 / cfg.speeds[cfg.defaultSpeed]!);

    const profile = loadProfile() ?? {
      identifier: randomIdentifier(),
      nickname: '',
      createdAt: new Date().toISOString(),
    };
    saveProfile(profile);
    this.identifier = profile.identifier;

    this.lobby = new LobbyUI(cfg, profile.identifier, profile.nickname, this.mobile);
    this.lobby.onModeChange = () => this.refreshLayout();
    this.lobby.onReady = () => this.enterArmed();

    this.keyboard = new KeyboardInput(cfg);
    this.keyboard.attach();
    this.audio = new GameAudio(cfg);
    this.keyboard.setListener((press) => this.routePress(press));
    this.touch = new TouchInput(el('touch-buttons'));
    this.touch.setListener((press) => this.routePress(press));

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') this.debugVisible = !this.debugVisible;
      if (e.code === 'Escape') {
        if (this.state === 'armed' || this.state === 'countdown' || this.state === 'complete') {
          this.enterLobby();
        } else if (this.state === 'running') {
          // Bail back to shore at any time; partial data is saved to
          // localStorage (past runs) with the aborted flag.
          this.finishRun(true);
          this.enterLobby();
        }
      }
    });
    window.addEventListener('resize', () => this.refreshLayout());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'running' && !this.ignoreInterruptions) this.abortRun('hidden');
    });
    window.addEventListener('blur', () => {
      if (this.state === 'running' && !this.ignoreInterruptions) this.abortRun('blur');
    });

    el<HTMLButtonElement>('back-to-lobby').addEventListener('click', () => this.enterLobby());
    el<HTMLButtonElement>('save-csv').addEventListener('click', () => {
      if (this.runRecord && this.runRecord.results.length > 0) {
        const filename = downloadRecord(this.runRecord);
        el('complete-saved').textContent = `saved ${filename}`;
      }
    });

    this.layout = this.computeCurrentLayout();
    void keyLabels(cfg).then((labels) => {
      this.labels = labels;
      this.rebuildSlotLabels();
      this.redrawBackground();
    });

    this.refreshLayout();
    requestAnimationFrame(() => this.frame());
  }

  // ---------- layout ----------

  private currentModeSlots(): FingerSlot[] {
    return activeSlots(this.lobby.getMode(), this.cfg);
  }

  private computeCurrentLayout(): Layout {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const canvas of [this.bg, this.fx]) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return computeLayout(w, h, this.currentModeSlots());
  }

  private refreshLayout(): void {
    this.layout = this.computeCurrentLayout();
    // Mode-aware bindings: single-hand modes put the thumb on the spacebar.
    this.keyboard.setMode(this.lobby.getMode());
    // Idle attract rain follows the selected speed.
    const idlePeriod = periodOf(this.lobby.getMode(), this.cfg);
    if (this.idleClock.periodMs !== idlePeriod) {
      this.idleClock = new RippleClock(performance.now(), 1000 / idlePeriod);
    }
    this.rebuildSlotLabels();
    this.redrawBackground();
    this.touch.reflow(this.layout);
  }

  /** Display labels per slot for the current mode ('_' for the spacebar). */
  private rebuildSlotLabels(): void {
    const mode = this.lobby.getMode();
    this.slotLabels = new Map();
    for (const slot of this.layout.orderedSlots) {
      const code = effectiveCodeForSlot(this.cfg, mode, slot);
      this.slotLabels.set(slotKey(slot), this.labels.get(code) ?? code);
    }
  }

  private redrawBackground(): void {
    renderBackground(this.bgCtx, this.layout);
  }

  // ---------- state transitions ----------

  private enterLobby(): void {
    this.state = 'lobby';
    this.gate = null;
    this.controller = null;
    this.runClock = null;
    this.audio.stopRun();
    this.keyboard.captureKeys = false;
    this.effects.length = 0;
    this.destroyed.clear();
    this.damagedSlots.clear();
    this.latchFade.clear();
    this.lobby.show(true);
    this.lobby.renderPastRuns();
    el('armed').classList.add('hidden');
    el('countdown').classList.add('hidden');
    el('hud').classList.add('hidden');
    el('complete').classList.add('hidden');
    this.touch.show(false);
    this.refreshLayout();
  }

  private enterArmed(): void {
    this.state = 'armed';
    this.keyboard.captureKeys = true;
    this.gate = new PressAllGate(this.currentModeSlots());
    this.lobby.show(false);
    el('armed').classList.remove('hidden');
    const mode = this.lobby.getMode();
    el('gate-hint').textContent =
      mode.chordSize > 1
        ? 'tip: hold several keys at once — if some don’t light up, your keyboard may drop chord presses'
        : 'press every key once to begin';
    if (this.mobile) {
      this.touch.build(this.currentModeSlots(), this.cfg, this.layout);
      this.touch.show(true);
    }
    this.refreshLayout();
  }

  private enterCountdown(): void {
    const mode = this.lobby.getMode();
    const seed = (hashString(this.identifier) ^ (Date.now() & 0xffffffff)) >>> 0;
    this.trials = generateSchedule(mode, this.cfg, seed);

    // Align run start with a far apex of the idle clock so the water is
    // visually continuous into the run.
    const now = performance.now();
    const period = this.idleClock.periodMs;
    const k = Math.ceil((now + COUNTDOWN_MIN_MS - this.idleClock.t0) / period);
    this.countdownT0 = this.idleClock.farApexTime(k);

    this.runClock = new RippleClock(this.countdownT0, 1000 / periodOf(mode, this.cfg));
    fillScheduleTimes(this.trials, this.runClock, this.cfg);

    this.runStartedAt = new Date();
    this.resolvedCount = 0;
    this.lastOffsetMs = null;
    this.maxFrameDelta = 0;
    this.destroyed.clear();
    this.damagedSlots.clear();
    this.latchFade.clear();
    this.visualRand = mulberry32(seed ^ 0x9e3779b9);

    const events: RunEvents = {
      onPress: (press, cls, trial) => this.onPress(press, cls, trial),
      onObjectsLost: (trial, lost) => this.onObjectsLost(trial, lost),
      onTrialResolved: () => this.onTrialResolved(),
      onComplete: () => this.finishRun(false),
    };
    this.controller = new RunController(this.trials, this.runClock, this.cfg, canonicalColumnX, events);

    this.runRecord = {
      id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      identifier: this.identifier,
      nickname: this.lobby.nickname,
      mode,
      seed,
      startedAtIso: this.runStartedAt.toISOString(),
      userAgent: navigator.userAgent,
      aborted: false,
      totalTrials: this.trials.length,
      score: 0,
      results: [],
      rawPresses: [],
    };
    saveProfile({
      identifier: this.identifier,
      nickname: this.lobby.nickname,
      createdAt: loadProfile()?.createdAt ?? new Date().toISOString(),
    });

    this.state = 'countdown';
    el('armed').classList.add('hidden');
    el('complete').classList.add('hidden');
    el('countdown').classList.remove('hidden');

    // Reached via a key/tap gesture, so the AudioContext may start here.
    this.audio.ensureStarted();
    this.audio.startRun(this.runClock);
  }

  private startRun(): void {
    this.state = 'running';
    el('countdown').classList.add('hidden');
    el('hud').classList.remove('hidden');
    el('hud-score').textContent = '0';
    el('hud-progress').textContent = `0/${this.trials.length}`;
  }

  private finishRun(aborted: boolean): void {
    if (!this.controller || !this.runRecord) return;
    this.state = 'complete';
    this.audio.stopRun();
    this.controller.finalize();

    this.runRecord.aborted = aborted;
    this.runRecord.score = this.controller.score;
    this.runRecord.results = this.controller.results;
    this.runRecord.rawPresses = this.controller.rawPresses;
    // Kept in localStorage; CSV export is manual only (save button below).
    saveRun(this.runRecord);

    const hasData = this.runRecord.results.length > 0;
    el('hud').classList.add('hidden');
    el('complete').classList.remove('hidden');
    el('complete-title').textContent = aborted ? 'run interrupted' : 'run complete';
    el('complete-score').textContent = `${this.controller.score} pts`;
    el('complete-detail').textContent =
      `${this.controller.results.length} object records over ` +
      `${new Set(this.controller.results.map((r) => r.trial)).size} drops`;
    el('complete-saved').textContent = hasData
      ? 'data kept in this browser — not saved to file yet'
      : 'no completed trials — nothing to save';
    el<HTMLButtonElement>('save-csv').disabled = !hasData;

    // Endless continuation: press all keys again to start another run with
    // the same settings (keyboard capture stays on for the gate).
    this.keyboard.captureKeys = true;
    this.gate = new PressAllGate(this.currentModeSlots());
    if (this.mobile) {
      this.touch.build(this.currentModeSlots(), this.cfg, this.layout);
      this.touch.show(true);
    } else {
      this.touch.show(false);
    }
  }

  private abortRun(reason: string): void {
    console.warn(`Run aborted: ${reason}`);
    this.finishRun(true);
  }

  // ---------- input routing ----------

  private routePress(press: SlotPress): void {
    if (this.state === 'armed' || this.state === 'complete') {
      this.gate?.press(press.slot, this.keyboard.heldCount || 1);
      this.lastPressAt.set(slotKey(press.slot), press.t);
      if (this.gate?.complete) this.enterCountdown();
      return;
    }
    if (this.state === 'running') {
      this.lastPressAt.set(slotKey(press.slot), press.t);
      this.controller?.handlePress(press.slot, press.t);
    }
  }

  // ---------- run event handlers ----------

  private colX(slot: FingerSlot): number {
    return this.layout.columns.get(slotKey(slot)) ?? this.layout.width / 2;
  }

  /** Vertical position of a trial's band/objects at time t (effects anchor). */
  private objectY(trial: Trial | null, t: number): number {
    if (!trial) return this.layout.crosshairY;
    return fallY(this.layout, this.cfg.fall.fadeLeadMs, trial.peakTime, t);
  }

  /** Targets of a trial that are still visually intact (not popped/glanced). */
  private unhitTargets(trial: Trial): FingerSlot[] {
    return trial.targets.filter((t) => !this.destroyed.has(`${trial.cycle}:${slotKey(t)}`));
  }

  /**
   * Early/late presses crack an object: the pressed finger's own object if
   * it's an intact target, otherwise a random intact-and-uncracked one.
   */
  private applyDamage(trial: Trial, pressSlot: FingerSlot): void {
    const intact = this.unhitTargets(trial);
    if (intact.length === 0) return;
    const dmgKey = (s: FingerSlot): string => `${trial.cycle}:${slotKey(s)}`;
    const own = intact.find((s) => sameSlot(s, pressSlot) && !this.damagedSlots.has(dmgKey(s)));
    const undamaged = intact.filter((s) => !this.damagedSlots.has(dmgKey(s)));
    const victim = own ?? (undamaged.length > 0
      ? undamaged[Math.floor(this.visualRand() * undamaged.length)]
      : null);
    if (victim) this.damagedSlots.add(dmgKey(victim));
  }

  private applyGlance(trial: Trial, t: number): boolean {
    const candidates = this.unhitTargets(trial);
    if (candidates.length === 0) return false;
    const victim = candidates[Math.floor(this.visualRand() * candidates.length)]!;
    this.destroyed.set(`${trial.cycle}:${slotKey(victim)}`, 'glance');
    this.effects.push({
      kind: 'glance',
      startT: t,
      x: this.colX(victim),
      y: this.objectY(trial, t),
      color: this.cfg.visuals.fingerColors[victim.finger],
      seed: trial.index * 6151 + candidates.length,
    });
    return true;
  }

  private onPress(press: PressEvent, cls: PressClass, trial: Trial | null): void {
    this.lastOffsetMs = press.offsetMs;
    this.audio.cue(cls);
    const x = this.colX(press.slot);
    const y = this.objectY(trial, press.t);
    const color = this.cfg.visuals.fingerColors[press.slot.finger];

    // Ammo fade bookkeeping: latched presses consume a slot; the fade
    // animation is scheduled for firstPress + window so near-simultaneous
    // chord presses fade in sync.
    if (press.latched && trial) {
      let fade = this.latchFade.get(trial.cycle);
      if (!fade) {
        fade = { firstT: press.t, slots: new Set(), full: false };
        this.latchFade.set(trial.cycle, fade);
      }
      fade.slots.add(slotKey(press.slot));
      if (fade.slots.size >= trial.targets.length) fade.full = true;
    }

    if (cls === 'correct' && trial) {
      const key = `${trial.cycle}:${slotKey(press.slot)}`;
      const wasGlanced = this.destroyed.get(key) === 'glance';
      this.destroyed.set(key, 'pop');
      this.effects.push({ kind: 'pop', startT: press.t, x, y, color, seed: trial.index * 7919 + 13 });
      // The glance that had consumed this object moves to another unhit one.
      if (wasGlanced) this.applyGlance(trial, press.t);
    } else if (cls === 'wrongFinger' && trial) {
      // Glancing hit: destroys a random still-unhit object; if none remain,
      // the press just splashes.
      if (!this.applyGlance(trial, press.t)) {
        this.effects.push({ kind: 'splash', startT: press.t, x, y });
      }
    } else if ((cls === 'early' || cls === 'late') && trial) {
      // Mistimed but valid press: cracks an object (it stays afloat).
      this.applyDamage(trial, press.slot);
      this.effects.push({ kind: 'splash', startT: press.t, x, y });
    } else {
      this.effects.push({ kind: 'splash', startT: press.t, x, y });
    }

    const floatColors: Record<PressClass, string> = {
      correct: '#ffe08a',
      wrongFinger: '#ffc9a1',
      early: '#cfe0da',
      late: '#cfe0da',
      excess: '#ff6b6b',
    };
    this.effects.push({
      kind: 'floater',
      startT: press.t,
      x,
      y: this.floaterY(),
      text: press.points > 0 ? `+${press.points}` : String(press.points),
      color: floatColors[cls],
    });

    el('hud-score').textContent = String(this.controller?.score ?? 0);
  }

  /** Scores always rise from just above the crosshair. */
  private floaterY(): number {
    return this.layout.crosshairY - this.layout.fingerRadius - 16;
  }

  /**
   * Crosshair "ammo" translucency for one slot at `now`. Consumed fingers
   * (and, once the press limit is hit, all fingers) fade to 0.35 starting
   * at firstPress + captureWindow; alphas ramp smoothly back to 1 over the
   * first 500ms of each cycle.
   */
  private slotFadeAlpha(key: string, cycle: number, now: number, withRamp = true): number {
    let alpha = 1;
    if (withRamp && this.runClock && cycle > 0) {
      const start = this.runClock.farApexTime(cycle);
      const p = Math.min(1, Math.max(0, (now - start) / 500));
      if (p < 1) {
        const prevEnd = this.slotFadeAlpha(key, cycle - 1, start, false);
        alpha = prevEnd + (1 - prevEnd) * p;
      }
    }
    const fade = this.latchFade.get(cycle);
    if (fade && (fade.full || fade.slots.has(key))) {
      const fadeStart = fade.firstT + this.cfg.timing.captureWindowMs;
      if (now >= fadeStart) {
        const p = Math.min(1, (now - fadeStart) / 300);
        alpha = Math.min(alpha, 1 - 0.65 * p);
      }
    }
    return alpha;
  }

  private onObjectsLost(trial: Trial, lost: FingerSlot[]): void {
    const now = performance.now();
    const points = this.cfg.scoring.noPress;
    this.audio.cue('noPress'); // once per batch, not per object
    for (const slot of lost) {
      // Skip objects already visually consumed by a glancing hit.
      if (this.destroyed.has(`${trial.cycle}:${slotKey(slot)}`)) continue;
      this.effects.push({
        kind: 'floater',
        startT: now,
        x: this.colX(slot),
        y: this.floaterY(),
        text: points > 0 ? `+${points}` : String(points),
        color: points < 0 ? '#ff6b6b' : '#b9cec7',
      });
    }
  }

  private onTrialResolved(): void {
    this.resolvedCount++;
    el('hud-progress').textContent = `${this.resolvedCount}/${this.trials.length}`;
    // No-press penalties land at resolve time.
    el('hud-score').textContent = String(this.controller?.score ?? 0);
    if (this.controller && this.runRecord && this.resolvedCount % SAVE_EVERY_TRIALS === 0) {
      this.runRecord.score = this.controller.score;
      this.runRecord.results = this.controller.results;
      saveRun(this.runRecord);
    }
  }

  // ---------- per-frame ----------

  private frame(): void {
    const now = performance.now();
    const delta = now - this.lastFrameT;
    this.lastFrameT = now;
    if (this.state === 'running') {
      this.maxFrameDelta = Math.max(this.maxFrameDelta, delta);
      if (delta > STALL_ABORT_MS && !this.ignoreInterruptions) {
        this.abortRun(`frame stall ${Math.round(delta)}ms`);
      }
    }

    if (this.state === 'countdown') {
      const remaining = this.countdownT0 - now;
      if (remaining <= 0) {
        this.startRun();
      } else {
        el('countdown-num').textContent = String(Math.ceil(remaining / 1000));
      }
    }

    if (this.state === 'running' && this.controller) {
      this.controller.update(now);
    }
    if (this.state === 'running' || this.state === 'countdown') {
      this.audio.update(now);
    }

    pruneEffects(this.effects, now, this.cfg);
    renderFrame(this.fxCtx, this.cfg, this.buildRenderState(now));
    requestAnimationFrame(() => this.frame());
  }

  private buildRenderState(now: number): RenderState {
    const running = this.state === 'running' || this.state === 'countdown';
    const clock = running && this.runClock ? this.runClock : this.idleClock;
    // Key hints only in the lobby and press-all screens; gameplay uses
    // letterless crosshairs pinned to the waterline peak.
    const fingerMode: FingerMode = running ? 'crosshair' : 'buttons';
    const showLetters = !this.mobile && !running;

    let windowPulse: number | null = null;
    if (this.state === 'running' && this.controller && this.runClock) {
      const trial = this.controller.currentTrial(now);
      if (trial && now >= trial.windowOpen && now <= trial.windowClose) {
        windowPulse = (now - trial.windowOpen) / Math.max(1, trial.windowClose - trial.windowOpen);
      }
    }

    const gateActive = this.state === 'armed' || this.state === 'complete';
    const fingerStates = new Map<string, FingerVisualState>();
    for (const slot of this.layout.orderedSlots) {
      const key = slotKey(slot);
      let state: FingerVisualState = 'idle';
      if (gateActive && this.gate?.isLatched(slot)) state = 'gate';
      else if (this.keyboard.isHeld(slot)) state = 'held';
      else if (now - (this.lastPressAt.get(key) ?? -Infinity) < FLASH_MS) state = 'flash';
      fingerStates.set(key, state);
    }

    // Ammo translucency (running only).
    let fingerAlpha: Map<string, number> | null = null;
    if (this.state === 'running' && this.runClock) {
      const cycle = Math.max(0, this.runClock.cycleAt(now));
      fingerAlpha = new Map();
      for (const slot of this.layout.orderedSlots) {
        const key = slotKey(slot);
        fingerAlpha.set(key, this.slotFadeAlpha(key, cycle, now));
      }
    }

    const fadeLead = this.cfg.fall.fadeLeadMs;
    const trials: VisibleTrial[] = [];
    if (running && this.controller && this.runClock) {
      // Every scheduled band whose fall corridor intersects the screen:
      // from the still-fading previous cycle up to the fade-in horizon.
      const first = Math.max(0, this.runClock.cycleAt(now) - 1);
      const last = Math.min(this.trials.length - 1, this.runClock.cycleAt(now + fadeLead) + 1);
      for (let k = first; k <= last; k++) {
        const trial = this.controller.trialForCycle(k);
        if (!trial) continue;
        trials.push({
          peakTime: trial.peakTime,
          spawnTime: trial.spawnTime,
          revealTime: trial.revealTime,
          windowClose: trial.windowClose,
          cycleEnd: this.runClock.farApexTime(k + 1) + 400,
          targets: trial.targets.map((slot) => {
            const key = `${trial.cycle}:${slotKey(slot)}`;
            return {
              slot,
              destroyed: this.destroyed.has(key),
              damaged: this.damagedSlots.has(key),
            };
          }),
        });
      }
    } else if (this.state !== 'complete') {
      // Lobby/armed attract: decorative neutral bands raining, never revealing.
      const first = this.idleClock.cycleAt(now) - 1;
      const last = this.idleClock.cycleAt(now + fadeLead) + 1;
      for (let k = first; k <= last; k++) {
        const peakTime = this.idleClock.peakTime(k);
        trials.push({
          peakTime,
          spawnTime: peakTime - fadeLead,
          revealTime: Infinity,
          windowClose: peakTime,
          cycleEnd: peakTime + 700,
          targets: [],
          decorative: true,
        });
      }
    }

    let debug: DebugInfo | null = null;
    if (this.debugVisible) {
      const cycle = clock.cycleAt(now);
      debug = {
        cycle,
        msToPeak: clock.peakTime(cycle) - now,
        lastOffsetMs: this.lastOffsetMs,
        frameDeltaMs: now - this.lastFrameT,
        maxFrameDeltaMs: this.maxFrameDelta,
      };
    }

    return {
      layout: this.layout,
      clock,
      now,
      labels: this.slotLabels,
      fingerStates,
      fingerAlpha,
      fingerMode,
      windowPulse,
      trials,
      effects: this.effects,
      showLetters,
      debug,
    };
  }
}
