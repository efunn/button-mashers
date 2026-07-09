import type { GameConfig } from '../config/types';
import { slotKey } from '../core/types';
import type { Layout } from './layout';

export type FingerVisualState = 'idle' | 'held' | 'flash' | 'gate';
export type FingerMode = 'buttons' | 'crosshair';

/**
 * Finger indicators. Two looks:
 * - 'buttons' (lobby / press-all): key-cap discs above the shoreline with
 *   the key letters.
 * - 'crosshair' (gameplay): letterless crosshairs centered on the waterline
 *   peak, translucent so the object shows through; they swell/glint while
 *   the capture window is open and their background darkens while pressed.
 */
export function drawFingers(
  ctx: CanvasRenderingContext2D,
  cfg: GameConfig,
  layout: Layout,
  labels: Map<string, string>,
  states: Map<string, FingerVisualState>,
  showLetters: boolean,
  mode: FingerMode,
  windowPulse: number | null,
  alphas: Map<string, number> | null,
): void {
  for (const slot of layout.orderedSlots) {
    const key = slotKey(slot);
    const x = layout.columns.get(key)!;
    const color = cfg.visuals.fingerColors[slot.finger];
    const state = states.get(key) ?? 'idle';

    if (mode === 'crosshair') {
      drawCrosshair(ctx, x, layout, color, state, windowPulse, alphas?.get(key) ?? 1, cfg.visuals.glowIntensity);
      continue;
    }

    const y = layout.fingerY;
    const r = layout.fingerRadius;

    ctx.save();

    if (state === 'gate' || state === 'flash') {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
    }

    // Base disc
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle =
      state === 'idle' ? 'rgba(255, 253, 247, 0.82)' : state === 'held' ? color : color;
    if (state === 'idle') {
      ctx.fill();
    } else {
      ctx.globalAlpha = state === 'held' ? 0.92 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Colored ring
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.stroke();

    // Key letter (labels are slot-keyed and already mode-resolved).
    if (showLetters) {
      const label = labels.get(key) ?? '';
      ctx.fillStyle = state === 'idle' ? 'rgba(43, 57, 63, 0.85)' : '#ffffff';
      ctx.font = `700 ${Math.round(r * 0.9)}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y + 1);
    }

    // Small pointer notch toward the water.
    ctx.beginPath();
    ctx.moveTo(x - 5, y + r + 3);
    ctx.lineTo(x + 5, y + r + 3);
    ctx.lineTo(x, y + r + 9);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.fill();

    ctx.restore();
  }
}

/**
 * Cached radial-gradient glow sprites, one per color. Replaces
 * ctx.shadowBlur in the per-frame crosshair path — shadow rendering is
 * extremely slow on weak GPUs, which made 10-finger glinting stutter.
 */
const glowSprites = new Map<string, HTMLCanvasElement>();
const GLOW_SIZE = 64;

function glowSprite(color: string): HTMLCanvasElement {
  let sprite = glowSprites.get(color);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = GLOW_SIZE;
    sprite.height = GLOW_SIZE;
    const sctx = sprite.getContext('2d')!;
    const half = GLOW_SIZE / 2;
    const grad = sctx.createRadialGradient(half, half, half * 0.15, half, half, half);
    grad.addColorStop(0, color);
    grad.addColorStop(0.55, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
    glowSprites.set(color, sprite);
  }
  return sprite;
}

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  layout: Layout,
  color: string,
  state: FingerVisualState,
  windowPulse: number | null,
  ammoAlpha: number,
  glowIntensity: number,
): void {
  const y = layout.crosshairY;
  // Single swell over the window: 0 at open/close, 1 at the center.
  const pulse = windowPulse === null ? 0 : Math.sin(Math.PI * Math.min(1, Math.max(0, windowPulse)));
  const r = layout.fingerRadius * (1 + 0.18 * pulse);
  const pressed = state === 'held' || state === 'flash';

  ctx.save();
  // Ammo translucency: consumed/locked-out crosshairs fade toward a floor
  // but still render; press reactions stay full-strength so faded
  // crosshairs still visibly react.
  const base = Math.max(0.2, Math.min(1, ammoAlpha));

  if (glowIntensity > 0 && (pulse > 0 || pressed)) {
    const glowR = r * 1.7 + 5 * pulse;
    ctx.globalAlpha = glowIntensity * (0.22 * pulse + (pressed ? 0.16 : 0));
    ctx.drawImage(glowSprite(color), x - glowR, y - glowR, glowR * 2, glowR * 2);
  }

  // Translucent center: darkens while the key is down.
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = pressed ? 0.45 : base * (0.10 + 0.08 * pulse);
  ctx.fill();

  // Ring
  ctx.globalAlpha = pressed ? 1 : base;
  ctx.lineWidth = 2.4 + 1.2 * pulse;
  ctx.strokeStyle = color;
  ctx.stroke();

  // Four tick marks (outside the ring, leaving the center clear).
  const tickIn = r + 2;
  const tickOut = r + 8 + 3 * pulse;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x + dx * tickIn, y + dy * tickIn);
    ctx.lineTo(x + dx * tickOut, y + dy * tickOut);
    ctx.stroke();
  }

  // Glint: a bright arc sweeping the ring during the window.
  if (windowPulse !== null) {
    const a = -Math.PI / 2 + windowPulse * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x, y, r, a, a + Math.PI / 3);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.globalAlpha = base * 0.85;
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }

  ctx.restore();
}
