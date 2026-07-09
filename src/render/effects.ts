import type { VisualsConfig } from '../config/types';
import { mulberry32 } from '../core/rng';

export type Effect =
  | { kind: 'pop'; startT: number; x: number; y: number; color: string; seed: number }
  | { kind: 'glance'; startT: number; x: number; y: number; color: string; seed: number }
  | { kind: 'floater'; startT: number; x: number; y: number; text: string; color: string }
  | { kind: 'splash'; startT: number; x: number; y: number };

const SPLASH_MS = 450;
const GLANCE_MS = 500;

function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

/** Draw one effect; returns false once it has fully played out. */
export function drawEffect(
  ctx: CanvasRenderingContext2D,
  e: Effect,
  now: number,
  visuals: VisualsConfig,
): boolean {
  const elapsed = now - e.startT;

  if (e.kind === 'pop') {
    if (elapsed > visuals.popDurationMs) return false;
    const p = elapsed / visuals.popDurationMs;
    const ease = easeOutCubic(p);

    // Expanding ring
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 3 * (1 - p) + 1;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 8 + ease * 30, 0, Math.PI * 2);
    ctx.stroke();

    // Particles with deterministic velocities
    const rand = mulberry32(e.seed);
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.8;
      const speed = 24 + rand() * 40;
      const px = e.x + Math.cos(angle) * speed * ease;
      const py = e.y + Math.sin(angle) * speed * ease - 14 * ease;
      const r = (2.6 + rand() * 2) * (1 - p);
      ctx.globalAlpha = (1 - p) * 0.95;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.3, r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return true;
  }

  if (e.kind === 'glance') {
    // Glancing destruction: the object chips into a few shards that tumble
    // aside and sink — dimmer and shorter than a full pop.
    if (elapsed > GLANCE_MS) return false;
    const p = elapsed / GLANCE_MS;
    const ease = easeOutCubic(p);
    const rand = mulberry32(e.seed);
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const angle = -Math.PI / 2 + (i - 1) * 0.9 + (rand() - 0.5) * 0.5;
      const speed = 18 + rand() * 22;
      const px = e.x + Math.cos(angle) * speed * ease;
      const py = e.y + Math.sin(angle) * speed * ease + 26 * ease * ease; // gravity: shards sink
      const size = 5.5 + rand() * 3;
      ctx.globalAlpha = (1 - p) * 0.85;
      ctx.fillStyle = e.color;
      ctx.strokeStyle = 'rgba(20, 40, 46, 0.5)';
      ctx.lineWidth = 1;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rand() * Math.PI + ease * (rand() > 0.5 ? 2.2 : -2.2));
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.8, size * 0.5);
      ctx.lineTo(-size * 0.7, size * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    return true;
  }

  if (e.kind === 'floater') {
    if (elapsed > visuals.scoreFloatDurationMs) return false;
    const p = elapsed / visuals.scoreFloatDurationMs;
    ctx.save();
    ctx.globalAlpha = p < 0.15 ? p / 0.15 : 1 - easeOutCubic((p - 0.15) / 0.85);
    ctx.font = '800 26px "Avenir Next", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fy = e.y - easeOutCubic(p) * 46;
    // Dark outline keeps the score legible on both sand and water.
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(16, 38, 46, 0.75)';
    ctx.strokeText(e.text, e.x, fy);
    ctx.fillStyle = e.color;
    ctx.fillText(e.text, e.x, fy);
    ctx.restore();
    return true;
  }

  // splash
  if (elapsed > SPLASH_MS) return false;
  const p = elapsed / SPLASH_MS;
  const ease = easeOutCubic(p);
  ctx.save();
  ctx.globalAlpha = (1 - p) * 0.5;
  ctx.strokeStyle = '#eaf6f3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(e.x, e.y, 6 + ease * 22, (6 + ease * 22) * 0.35, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  return true;
}
