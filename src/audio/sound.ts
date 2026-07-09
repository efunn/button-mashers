import type { GameConfig } from '../config/types';
import type { PressClass } from '../core/types';
import { RippleClock } from '../core/clock';

/**
 * Fully synthesized soundscape (no assets): a filtered-noise wave wash that
 * swells with the ripple, a soft chime at each peak, and per-outcome score
 * cues. Everything is scheduled on the AudioContext clock via a mapping
 * from the performance.now() timeline, so the wash and peak cues line up
 * with the visual wave regardless of frame rate.
 *
 * Game timing is never derived from audio; this is presentation only.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private washGain: GainNode | null = null;
  private washSource: AudioBufferSourceNode | null = null;
  private clock: RippleClock | null = null;
  /** Last ripple cycle whose wash/peak events have been scheduled. */
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

      // Wave wash: looped noise -> gentle lowpass -> per-cycle gain swells.
      const seconds = 2;
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.washSource = this.ctx.createBufferSource();
      this.washSource.buffer = buffer;
      this.washSource.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 650;
      filter.Q.value = 0.4;
      this.washGain = this.ctx.createGain();
      this.washGain.gain.value = 0;
      this.washSource.connect(filter).connect(this.washGain).connect(this.master);
      this.washSource.start();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Map a performance.now() timestamp onto the AudioContext clock. */
  private audioTime(perfT: number): number {
    return this.ctx!.currentTime + (perfT - performance.now()) / 1000;
  }

  /** Begin following a run clock (call at countdown/run start). */
  startRun(clock: RippleClock): void {
    if (!this.ctx) return;
    this.clock = clock;
    this.scheduledThrough = clock.cycleAt(performance.now()) - 1;
  }

  /**
   * Schedule wash swells and peak chimes for upcoming cycles. Call every
   * frame; schedules ~2s ahead so dropped frames don't cause gaps.
   */
  update(now: number): void {
    if (!this.ctx || !this.washGain || !this.clock) return;
    const horizon = now + 2000;
    while (this.clock.farApexTime(this.scheduledThrough + 1) < horizon) {
      const k = ++this.scheduledThrough;
      if (k < 0) continue;
      const apex = this.audioTime(this.clock.farApexTime(k));
      const peak = this.audioTime(this.clock.peakTime(k));
      const nextApex = this.audioTime(this.clock.farApexTime(k + 1));
      if (nextApex <= this.ctx.currentTime) continue;

      // Wash: swell in toward the peak, recede after.
      const g = this.washGain.gain;
      g.setValueAtTime(0.015, Math.max(apex, this.ctx.currentTime));
      g.linearRampToValueAtTime(0.11, peak);
      g.linearRampToValueAtTime(0.015, nextApex);

      // Peak cue: a soft two-partial chime exactly at the peak.
      this.chime(peak, 660, 0.05, 0.35);
      this.chime(peak, 1320, 0.018, 0.25);
    }
  }

  /** Stop following the run; fade the wash out. */
  stopRun(): void {
    this.clock = null;
    if (this.ctx && this.washGain) {
      const g = this.washGain.gain;
      g.cancelScheduledValues(this.ctx.currentTime);
      g.setValueAtTime(g.value, this.ctx.currentTime);
      g.linearRampToValueAtTime(0, this.ctx.currentTime + 0.6);
    }
  }

  /** Immediate score-outcome cue (fired at press/lost time). */
  cue(kind: PressClass | 'noPress'): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (kind) {
      case 'correct': // rising major third: bright, rewarding
        this.tone(t, 523, 0.09, 0.1, 'sine');
        this.tone(t + 0.08, 659, 0.1, 0.14, 'sine');
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

  private chime(t: number, freq: number, gain: number, duration: number): void {
    this.tone(Math.max(t, this.ctx!.currentTime), freq, gain, duration, 'sine');
  }

  private tone(
    t: number,
    freq: number,
    gain: number,
    duration: number,
    type: OscillatorType,
    lowpassHz?: number,
    glideTo?: number,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo !== undefined) osc.frequency.linearRampToValueAtTime(glideTo, t + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    let head: AudioNode = osc;
    if (lowpassHz !== undefined) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpassHz;
      osc.connect(lp);
      head = lp;
    }
    head.connect(env).connect(this.master!);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }
}
