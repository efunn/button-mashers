import type { GameConfig } from '../config/types';
import type { FingerSlot } from '../core/types';

/**
 * Abstract falling shapes. Both hand shapes are normalized to the same
 * vertical height so the visual hitbox reads identically for either hand.
 */
export function drawObject(
  ctx: CanvasRenderingContext2D,
  cfg: GameConfig,
  slot: FingerSlot,
  x: number,
  y: number,
  height: number,
  alpha: number,
  now: number,
  damaged = false,
): void {
  const color = cfg.visuals.fingerColors[slot.finger];
  const shape = cfg.visuals.handShapes[slot.hand];
  const h = height / 2; // half-height, shared by both shapes
  const rot = Math.sin(now * 0.0014 + x * 0.31) * 0.1;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * (damaged ? 0.85 : 1);
  ctx.translate(x, y);
  ctx.rotate(shape === 'diamond' ? rot : 0);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(10, 20, 24, 0.8)';
  ctx.fillStyle = color;

  if (shape === 'diamond') {
    const w = h * 0.78;
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(w, 0);
    ctx.lineTo(0, h);
    ctx.lineTo(-w, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Inner facet line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.55);
    ctx.lineTo(w * 0.55, 0);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, h, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Inner ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Damaged variant: a dark crack across the body (object remains intact).
  if (damaged) {
    ctx.strokeStyle = 'rgba(8, 16, 20, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-h * 0.15, -h * 0.85);
    ctx.lineTo(h * 0.18, -h * 0.3);
    ctx.lineTo(-h * 0.12, 0.05 * h);
    ctx.lineTo(h * 0.22, h * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(h * 0.18, -h * 0.3);
    ctx.lineTo(h * 0.45, -h * 0.24);
    ctx.stroke();
  }

  // Specular glint
  ctx.globalAlpha *= 0.4;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-h * 0.28, -h * 0.34, h * 0.2, h * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * The neutral spanning band: object-height, covering the width of all
 * active columns. Identical every cycle — it carries no information until
 * it morphs into the target(s) at reveal time.
 */
export function drawBand(
  ctx: CanvasRenderingContext2D,
  layout: { columns: Map<string, number>; objectHeight: number },
  y: number,
  alpha: number,
): void {
  const xs = [...layout.columns.values()];
  const pad = layout.objectHeight * 0.7;
  const left = Math.min(...xs) - pad;
  const right = Math.max(...xs) + pad;
  const h = layout.objectHeight;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  const r = h / 2;
  ctx.beginPath();
  ctx.roundRect(left, y - r, right - left, h, r);
  const grad = ctx.createLinearGradient(0, y - r, 0, y + r);
  grad.addColorStop(0, '#3a4a55');
  grad.addColorStop(0.5, '#4b5f6c');
  grad.addColorStop(1, '#33424c');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(160, 200, 210, 0.35)';
  ctx.stroke();

  ctx.restore();
}
