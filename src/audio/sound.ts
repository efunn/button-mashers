import type { GameConfig } from '../config/types';
import type { PressClass } from '../core/types';
import { RippleClock } from '../core/clock';

/**
 * Fully synthesized cues (no assets, no background track): a low pulse at
 * each crossing and per-outcome score cues. Everything is scheduled on the
 * AudioContext clock via a mapping from the performance.now() timeline, so
 * the pulses line up with the visuals regardless of frame rate. Players are
 * welcome to vibe to their own music underneath.
 *
 * Game timing is never derived from audio; this is presentation only.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Pre-scheduled run pulses route here so an abort can mute them. */
  private pulseGain: GainNode | null = null;
  private clock: RippleClock | null = null;
  /** Last ripple cycle whose peak pulse has been scheduled. */
  private scheduledThrough = -1;
  private readonly volume: number;

  constructor(cfg: GameConfig) {
    this.volume = cfg.audio.masterVolume;
  }

  get enabled(): boolean {
    return this.volume > 0;
  }

  /** Create/resume the context. Must be called from a user gesture. */
  ensureStarted(): void {
    if (!this.enabled) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.pulseGain = this.ctx.createGain();
      this.pulseGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Map a performance.now() timestamp onto the AudioContext clock. */
  private audioTime(perfT: number): number {
    return this.ctx!.currentTime + (perfT - performance.now()) / 1000;
  }

  /** Begin following a run clock (call at countdown/run start). */
  startRun(clock: RippleClock): void {
    if (!this.ctx || !this.pulseGain) return;
    this.clock = clock;
    this.scheduledThrough = clock.cycleAt(performance.now()) - 1;
    this.pulseGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.pulseGain.gain.setValueAtTime(1, this.ctx.currentTime);
  }

  /**
   * Schedule the low crossing pulse for upcoming cycles. Call every frame;
   * schedules ~2s ahead so dropped frames don't cause gaps.
   */
  update(now: number): void {
    if (!this.ctx || !this.clock) return;
    const horizon = now + 2000;
    while (this.clock.farApexTime(this.scheduledThrough + 1) < horizon) {
      const k = ++this.scheduledThrough;
      if (k < 0) continue;
      const peak = this.audioTime(this.clock.peakTime(k));
      if (peak <= this.ctx.currentTime) continue;

      // Crossing cue: a low pulse with a soft attack, centered on the
      // timing window (replaces the old high chime).
      this.tone(peak - 0.04, 200, 0.06, 0.26, 'sine', undefined, undefined, 0.04, this.pulseGain!);
    }
  }

  /** Stop following the run; mute any pre-scheduled crossing pulses. */
  stopRun(): void {
    this.clock = null;
    if (this.ctx && this.pulseGain) {
      this.pulseGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.pulseGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  /** Immediate score-outcome cue (fired at press/lost time). */
  cue(kind: PressClass | 'noPress'): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (kind) {
      case 'correct': // rising major arpeggio + octave sparkle: rewarding
        this.tone(t, 523, 0.1, 0.1, 'sine');
        this.tone(t + 0.06, 659, 0.1, 0.1, 'sine');
        this.tone(t + 0.12, 784, 0.12, 0.16, 'sine');
        this.tone(t + 0.12, 1568, 0.035, 0.22, 'sine');
        break;
      case 'wrongFinger': // single mid tone: neutral
        this.tone(t, 440, 0.08, 0.12, 'triangle');
        break;
      case 'early':
      case 'late': // dull water thud
        this.tone(t, 180, 0.09, 0.12, 'sine');
        break;
      case 'excess': // low buzz: discouraging
        this.tone(t, 110, 0.08, 0.18, 'sawtooth', 320);
        break;
      case 'noPress': // soft descending sigh
        this.tone(t, 330, 0.05, 0.1, 'sine', undefined, 220);
        break;
    }
  }

  private tone(
    t: number,
    freq: number,
    gain: number,
    duration: number,
    type: OscillatorType,
    lowpassHz?: number,
    glideTo?: number,
    attack = 0.012,
    destination?: GainNode,
  ): void {
    const ctx = this.ctx!;
    const start = Math.max(t, ctx.currentTime);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo !== undefined) osc.frequency.linearRampToValueAtTime(glideTo, start + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(gain, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    let head: AudioNode = osc;
    if (lowpassHz !== undefined) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpassHz;
      osc.connect(lp);
      head = lp;
    }
    head.connect(env).connect(destination ?? this.master!);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }
}
