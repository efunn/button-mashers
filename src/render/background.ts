import type { Layout } from './layout';

/**
 * Static dark-abstract backdrop for the falling-band paradigm: a deep
 * gradient, faint column guides, and a glowing target line at crosshairY.
 * Drawn once per resize/mode change on the background canvas.
 */
export function drawBackdrop(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { width, height, crosshairY, topMarginPx } = layout;

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#0a1016');
  bg.addColorStop(0.55, '#0e161e');
  bg.addColorStop(1, '#131e28');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Faint column guides through the fall corridor.
  ctx.save();
  ctx.strokeStyle = 'rgba(150, 190, 200, 0.07)';
  ctx.lineWidth = 1;
  for (const x of layout.columns.values()) {
    ctx.beginPath();
    ctx.moveTo(x, topMarginPx);
    ctx.lineTo(x, crosshairY + 40);
    ctx.stroke();
  }

  // Soft fade zone hint at the top of the corridor.
  const fade = ctx.createLinearGradient(0, 0, 0, topMarginPx + 70);
  fade.addColorStop(0, 'rgba(10, 16, 22, 0.9)');
  fade.addColorStop(1, 'rgba(10, 16, 22, 0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, topMarginPx + 70);

  // Glowing target line.
  const glow = ctx.createLinearGradient(0, crosshairY - 14, 0, crosshairY + 14);
  glow.addColorStop(0, 'rgba(90, 200, 190, 0)');
  glow.addColorStop(0.5, 'rgba(90, 200, 190, 0.16)');
  glow.addColorStop(1, 'rgba(90, 200, 190, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, crosshairY - 14, width, 28);

  ctx.strokeStyle = 'rgba(140, 235, 220, 0.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, crosshairY);
  ctx.lineTo(width, crosshairY);
  ctx.stroke();

  // Dimmer zone below the line (spent objects sink into it).
  const below = ctx.createLinearGradient(0, crosshairY, 0, height);
  below.addColorStop(0, 'rgba(6, 10, 14, 0)');
  below.addColorStop(1, 'rgba(6, 10, 14, 0.55)');
  ctx.fillStyle = below;
  ctx.fillRect(0, crosshairY, width, height - crosshairY);
  ctx.restore();
}
