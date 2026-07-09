import type { Layout } from './layout';

/**
 * Water edge y at a given x, around a base line. The wobble is small
 * (< 5px) and low-frequency so perceived arrival time is uniform across
 * finger columns.
 */
export function edgeYAt(x: number, baseY: number, now: number): number {
  return (
    baseY +
    2.6 * Math.sin(x * 0.018 + now * 0.0016) +
    1.8 * Math.sin(x * 0.007 - now * 0.0011 + 1.7)
  );
}

/** Draw the water sheet from its current edge down to the bottom. */
export function drawWater(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  baseY: number,
  now: number,
): void {
  const { width, height } = layout;

  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(0, edgeYAt(0, baseY, now));
    for (let x = 8; x <= width; x += 8) {
      ctx.lineTo(x, edgeYAt(x, baseY, now));
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
  };

  // Body gradient: bright at the leading edge, deep below.
  const grad = ctx.createLinearGradient(0, baseY - 10, 0, height);
  grad.addColorStop(0, '#3f9aa8');
  grad.addColorStop(0.12, '#2b7f92');
  grad.addColorStop(0.45, '#175e73');
  grad.addColorStop(1, '#0d3d51');
  ctx.fillStyle = grad;
  path();
  ctx.fill();

  // Translucent leading band (thin film pushing up the sand).
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#bfe8e2';
  ctx.beginPath();
  ctx.moveTo(0, edgeYAt(0, baseY, now));
  for (let x = 8; x <= width; x += 8) ctx.lineTo(x, edgeYAt(x, baseY, now));
  for (let x = width; x >= 0; x -= 8) ctx.lineTo(x, edgeYAt(x, baseY, now * 1.04) + 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Foam line on the edge.
  ctx.save();
  ctx.strokeStyle = 'rgba(240, 252, 249, 0.85)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, edgeYAt(0, baseY, now));
  for (let x = 6; x <= width; x += 6) ctx.lineTo(x, edgeYAt(x, baseY, now));
  ctx.stroke();

  // A few drifting shimmer arcs behind the edge.
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#d9f2ec';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    const yOff = 26 + i * 34 + 6 * Math.sin(now * 0.0009 + i * 2.1);
    const xShift = ((now * (0.02 + i * 0.008)) % (width + 300)) - 150;
    ctx.beginPath();
    ctx.ellipse(xShift, baseY + yOff, 90, 7, 0, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

/** Static sand/shore background, drawn once per resize/mode change. */
export function drawShore(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { width, height, shoreY, amplitudePx } = layout;

  const sky = ctx.createLinearGradient(0, 0, 0, shoreY + amplitudePx);
  sky.addColorStop(0, '#f6ead2');
  sky.addColorStop(0.5, '#f0dfc0');
  sky.addColorStop(1, '#e3cba4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Damp sand band where the water sweeps.
  const damp = ctx.createLinearGradient(0, shoreY - 6, 0, shoreY + amplitudePx + 30);
  damp.addColorStop(0, 'rgba(160, 132, 96, 0)');
  damp.addColorStop(0.35, 'rgba(150, 120, 86, 0.18)');
  damp.addColorStop(1, 'rgba(120, 96, 70, 0.34)');
  ctx.fillStyle = damp;
  ctx.fillRect(0, shoreY - 6, width, amplitudePx + 40);

  // Speckle texture.
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#8a6f4d';
  let seed = 12345;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 420; i++) {
    const x = rand() * width;
    const y = rand() * height;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
}
