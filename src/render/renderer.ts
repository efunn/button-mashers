import type { GameConfig } from '../config/types';
import { RippleClock } from '../core/clock';
import type { FingerSlot } from '../core/types';
import { slotKey } from '../core/types';
import { drawEffect, type Effect } from './effects';
import { drawFingers, type FingerMode, type FingerVisualState } from './fingers';
import { columnXLookup, type Layout } from './layout';
import { drawBand, drawObject } from './objects';
import { drawBackdrop } from './background';

/** How long the band -> target crossfade takes. Purely in place. */
export const MORPH_MS = 120;

export interface VisibleTarget {
  slot: FingerSlot;
  /** Popped or glanced away — no longer drawn (effects cover the exit). */
  destroyed: boolean;
  /** Cracked by an early/late press; still falling and catchable. */
  damaged: boolean;
}

/** One falling band and (after its reveal) its target objects. */
export interface VisibleTrial {
  /** The moment the band crosses the target line. */
  peakTime: number;
  /** Fade-in start near the top of the corridor. */
  spawnTime: number;
  /** Band -> target morph moment (windowClose - RT). */
  revealTime: number;
  windowClose: number;
  /** Hard end of visibility (cycle boundary). */
  cycleEnd: number;
  targets: VisibleTarget[];
  /** Lobby rain: a band that never reveals. */
  decorative?: boolean;
}

export interface DebugInfo {
  cycle: number;
  msToPeak: number;
  lastOffsetMs: number | null;
  frameDeltaMs: number;
  maxFrameDeltaMs: number;
}

/** Read-only snapshot handed to the renderer each frame. */
export interface RenderState {
  layout: Layout;
  clock: RippleClock;
  now: number;
  labels: Map<string, string>;
  fingerStates: Map<string, FingerVisualState>;
  /** Per-slot ammo translucency (1 = fully available); crosshair mode only. */
  fingerAlpha: Map<string, number> | null;
  fingerMode: FingerMode;
  /** 0..1 progress through the current capture window; null when closed. */
  windowPulse: number | null;
  trials: VisibleTrial[];
  effects: Effect[];
  showLetters: boolean;
  debug: DebugInfo | null;
}

/** Vertical position of a trial's band/objects at time `now`. */
export function fallY(layout: Layout, fadeLeadMs: number, peakTime: number, now: number): number {
  const v = (layout.crosshairY - layout.topMarginPx) / fadeLeadMs;
  return layout.crosshairY - v * (peakTime - now);
}

export function renderBackground(ctx: CanvasRenderingContext2D, layout: Layout): void {
  drawBackdrop(ctx, layout);
}

export function renderFrame(ctx: CanvasRenderingContext2D, cfg: GameConfig, state: RenderState): void {
  const { layout, now } = state;
  ctx.clearRect(0, 0, layout.width, layout.height);

  const colX = columnXLookup(layout);
  const fadeLead = cfg.fall.fadeLeadMs;

  for (const trial of state.trials) {
    if (now < trial.spawnTime || now >= trial.cycleEnd) continue;
    const y = fallY(layout, fadeLead, trial.peakTime, now);
    if (y > layout.height + layout.objectHeight) continue;

    // Shared alpha envelope: fade in near the top, fade out after the window.
    const fadeIn = Math.min(1, (now - trial.spawnTime) / 300);
    const fadeOut =
      now > trial.windowClose ? Math.max(0, 1 - (now - trial.windowClose) / 500) : 1;
    const envelope = fadeIn * fadeOut;
    if (envelope <= 0) continue;

    // Band -> target crossfade, strictly in place: the morph looks the same
    // whichever column the target is in.
    const revealing = !trial.decorative && now >= trial.revealTime;
    const morph = revealing ? Math.min(1, (now - trial.revealTime) / MORPH_MS) : 0;

    if (morph < 1) {
      drawBand(ctx, layout, y, envelope * (1 - morph));
    }
    if (morph > 0) {
      for (const target of trial.targets) {
        if (target.destroyed) continue;
        drawObject(
          ctx,
          cfg,
          target.slot,
          colX(target.slot),
          y,
          layout.objectHeight,
          envelope * morph,
          now,
          target.damaged,
        );
      }
    }
  }

  drawFingers(
    ctx,
    cfg,
    layout,
    state.labels,
    state.fingerStates,
    state.showLetters,
    state.fingerMode,
    state.windowPulse,
    state.fingerAlpha,
  );

  for (const effect of state.effects) {
    drawEffect(ctx, effect, now, cfg.visuals);
  }

  if (state.debug) drawDebugOverlay(ctx, state.debug);
}

/** Prune expired effects in place (cheap, called once per frame). */
export function pruneEffects(effects: Effect[], now: number, cfg: GameConfig): void {
  const maxAge = Math.max(cfg.visuals.popDurationMs, cfg.visuals.scoreFloatDurationMs, 600);
  for (let i = effects.length - 1; i >= 0; i--) {
    if (now - effects[i]!.startT > maxAge) effects.splice(i, 1);
  }
}

function drawDebugOverlay(ctx: CanvasRenderingContext2D, d: DebugInfo): void {
  ctx.save();
  ctx.font = '12px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = [
    `cycle ${d.cycle}`,
    `to peak ${d.msToPeak.toFixed(0)} ms`,
    `last offset ${d.lastOffsetMs === null ? '—' : d.lastOffsetMs.toFixed(1) + ' ms'}`,
    `frame ${d.frameDeltaMs.toFixed(1)} ms (max ${d.maxFrameDeltaMs.toFixed(1)})`,
  ];
  const w = 200;
  const h = lines.length * 16 + 12;
  ctx.fillStyle = 'rgba(10, 25, 30, 0.72)';
  ctx.fillRect(8, 8, w, h);
  ctx.fillStyle = '#9fe8d8';
  lines.forEach((line, i) => ctx.fillText(line, 16, 15 + i * 16));
  ctx.restore();
}

export { slotKey };
