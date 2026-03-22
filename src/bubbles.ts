// Bubble particles that rise from fish and pond floor

import type { PondBounds } from './pond.ts';
import { isInWater } from './pond.ts';

export interface Bubble {
  x: number;
  y: number;
  size: number;
  speed: number;
  wobblePhase: number;
  opacity: number;
}

const bubbles: Bubble[] = [];

export function spawnBubble(x: number, y: number) {
  bubbles.push({
    x,
    y,
    size: 1 + Math.random() * 3,
    speed: 0.3 + Math.random() * 0.5,
    wobblePhase: Math.random() * Math.PI * 2,
    opacity: 0.5 + Math.random() * 0.3,
  });
}

export function spawnBubblesRandomly(bounds: PondBounds, _t: number) {
  if (Math.random() < 0.02) {
    const x = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.6;
    const y = bounds.waterTop + Math.random() * (bounds.bowlBottom - bounds.waterTop) * 0.7;
    if (isInWater(x, y, bounds)) {
      spawnBubble(x, y);
    }
  }
}

export function updateBubbles(dt: number, bounds: PondBounds) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y -= b.speed * (dt / 16);
    b.x += Math.sin(b.wobblePhase + b.y * 0.05) * 0.3;
    b.opacity -= 0.002 * (dt / 16);

    if (b.opacity <= 0 || !isInWater(b.x, b.y, bounds)) {
      bubbles.splice(i, 1);
    }
  }
}

export function drawBubbles(ctx: CanvasRenderingContext2D) {
  for (const b of bubbles) {
    ctx.globalAlpha = b.opacity;
    ctx.strokeStyle = 'rgba(200, 230, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.stroke();

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(b.x - b.size * 0.3, b.y - b.size * 0.3, b.size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
