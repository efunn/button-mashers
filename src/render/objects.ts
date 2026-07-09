import type { GameConfig } from '../config/types';
import type { FingerSlot } from '../core/types';

/**
 * Draw one floating object centered at (x, y). Shape depends on hand, color
 * on finger — mirrored colors across hands, distinct silhouettes per hand.
 * Both shapes are normalized to the same vertical height so the visual
 * hitbox reads identically for either hand.
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
  const bob = Math.sin(now * 0.004 + x * 0.13) * 1.6;
  const rot = Math.sin(now * 0.0016 + x * 0.31) * 0.14;
  const h = height / 2; // half-height, shared by both shapes

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * (damaged ? 0.85 : 1);
  ctx.translate(x, y + bob);
  ctx.rotate(rot);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(20, 40, 46, 0.65)';
  ctx.fillStyle = color;

  if (shape === 'leaf') {
    // Pointed ellipse with a vein; spans [-h, +h] vertically.
    const w = h * 0.62;
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.bezierCurveTo(w, -h * 0.4, w, h * 0.45, 0, h);
    ctx.bezierCurveTo(-w, h * 0.45, -w, -h * 0.4, 0, -h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.75);
    ctx.lineTo(0, h * 0.8);
    ctx.strokeStyle = 'rgba(20, 40, 46, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    // Scalloped shell fan, normalized to span [-h, +h] vertically:
    // hinge at the bottom (+h), scalloped rim at the top (-h).
    const r = h * 2 / 1.85; // fan radius so total height = 2h
    const yOff = h - r * 0.85; // shifts the fan so extremes hit ±h
    const scallops = 5;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= scallops; i++) {
      const a = Math.PI + (i / scallops) * Math.PI;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 0.85 - yOff;
      if (i === 0) ctx.lineTo(px, py);
      else {
        const prevA = Math.PI + ((i - 0.5) / scallops) * Math.PI;
        const cx = Math.cos(prevA) * r * 1.18;
        const cy = Math.sin(prevA) * r * 1.0 - yOff;
        ctx.quadraticCurveTo(cx, cy, px, py);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Ribs
    ctx.strokeStyle = 'rgba(20, 40, 46, 0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i < scallops; i++) {
      const a = Math.PI + (i / scallops) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.9);
      ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.75 - yOff);
      ctx.stroke();
    }
  }

  // Damaged variant: a dark crack across the body (object remains intact).
  if (damaged) {
    ctx.strokeStyle = 'rgba(20, 40, 46, 0.8)';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-h * 0.15, -h * 0.9);
    ctx.lineTo(h * 0.18, -h * 0.35);
    ctx.lineTo(-h * 0.12, 0.05 * h);
    ctx.lineTo(h * 0.22, h * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(h * 0.18, -h * 0.35);
    ctx.lineTo(h * 0.5, -h * 0.28);
    ctx.stroke();
  }

  // Specular glint
  ctx.globalAlpha *= 0.5;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-h * 0.3, -h * 0.42, h * 0.24, h * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
