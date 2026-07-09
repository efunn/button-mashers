import type { GameConfig } from '../config/types';
import { RippleClock } from '../core/clock';
import type { FingerSlot } from '../core/types';
import { slotKey } from '../core/types';
import { drawEffect, type Effect } from './effects';
import { drawFingers, type FingerMode, type FingerVisualState } from './fingers';
import { columnXLookup, type Layout } from './layout';
import { drawObject } from './objects';
import { drawShore, drawWater, edgeYAt } from './ripple';

export interface VisibleObject {
  slot: FingerSlot;
  /** Fade-in start. */
  spawnTime: number;
  /** End of the capture window (fade-out begins as it recedes). */
  windowClose: number;
  /** Hard end of visibility (cycle boundary). */
  cycleEnd: number;
  /** Popped or glanced away — no longer drawn (effects cover the exit). */
  destroyed: boolean;
  /** Cracked by an early/late press; still afloat and catchable. */
  damaged?: boolean;
  /** Lobby preview objects: pinned far out on the water. */
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
  objects: VisibleObject[];
  effects: Effect[];
  showLetters: boolean;
  debug: DebugInfo | null;
}

export function renderBackground(ctx: CanvasRenderingContext2D, layout: Layout): void {
  drawShore(ctx, layout);
}

export function renderFrame(ctx: CanvasRenderingContext2D, cfg: GameConfig, state: RenderState): void {
  const { layout, clock, now } = state;
  ctx.clearRect(0, 0, layout.width, layout.height);

  const displacement = clock.displacement(now);
  const baseY = layout.shoreY + layout.amplitudePx * (1 - displacement);

  drawWater(ctx, layout, baseY, now);

  // Objects ride the water edge in their finger's column.
  const colX = columnXLookup(layout);
  for (const obj of state.objects) {
    if (obj.destroyed) continue;
    const x = colX(obj.slot);
    let y: number;
    let alpha: number;
    if (obj.decorative) {
      y = edgeYAt(x, layout.shoreY + layout.amplitudePx * 0.8, now) - layout.objectHeight * 0.2;
      alpha = 0.9;
    } else {
      if (now < obj.spawnTime || now >= obj.cycleEnd) continue;
      // Centered on the water edge, so it sits centered under the crosshair
      // when the ripple reaches its peak.
      y = edgeYAt(x, baseY, now);
      const fadeIn = Math.min(1, (now - obj.spawnTime) / 150);
      const fadeOut =
        now > obj.windowClose
          ? Math.max(0, 1 - (now - obj.windowClose) / Math.max(1, obj.cycleEnd - obj.windowClose))
          : 1;
      alpha = fadeIn * (0.35 + 0.65 * fadeOut);
    }
    drawObject(ctx, cfg, obj.slot, x, y, layout.objectHeight, alpha, now, obj.damaged ?? false);
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
