// Bubble particles — tiny, rising from plant tips at the pond floor

import type { PondBounds } from './pond.ts';
import { isInWater, getBowlFloorY } from './pond.ts';

export interface Bubble {
  x: number;
  y: number;
  size: number;
  speed: number;
  wobblePhase: number;
  wobbleAmp: number;
  opacity: number;
}

const bubbles: Bubble[] = [];

export function spawnBubble(x: number, y: number) {
  bubbles.push({
    x,
    y,
    size: 0.5 + Math.random() * 1.2,   // much smaller
    speed: 0.15 + Math.random() * 0.25, // slower
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp: 0.3 + Math.random() * 0.5, // random jitter amount
    opacity: 0.3 + Math.random() * 0.25,
  });
}

// Seaweed x offsets — must match the ones in pond.ts drawDecorations
const seaweedXOffsets = [
  -0.43, -0.40, -0.37, -0.33, -0.30, -0.25,
  0.42, 0.39, 0.35, 0.31, 0.28, 0.24,
  -0.05, 0.08, -0.15, 0.14, -0.22, 0.22,
];

export function spawnBubblesRandomly(bounds: PondBounds, _t: number) {
  // Much lower spawn rate
  if (Math.random() < 0.004) {
    // Pick a random seaweed position
    const pondW = bounds.right - bounds.left;
    const xOff = seaweedXOffsets[Math.floor(Math.random() * seaweedXOffsets.length)];
    const sx = bounds.centerX + pondW * xOff;
    const floorY = getBowlFloorY(sx, bounds);
    // Spawn from the tip of the plant (above the floor)
    const height = 14 + Math.random() * 12;
    const bx = sx + (Math.random() - 0.5) * 3;
    const by = floorY - height;
    if (isInWater(bx, by, bounds)) {
      spawnBubble(bx, by);
    }
  }
}

export function updateBubbles(dt: number, bounds: PondBounds) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y -= b.speed * (dt / 16);
    // More jittery wobble
    b.wobblePhase += (0.03 + Math.random() * 0.02) * (dt / 16);
    b.x += Math.sin(b.wobblePhase) * b.wobbleAmp * (dt / 16);
    // Random micro-jitter
    b.x += (Math.random() - 0.5) * 0.15;
    b.opacity -= 0.001 * (dt / 16);

    if (b.opacity <= 0 || !isInWater(b.x, b.y, bounds)) {
      bubbles.splice(i, 1);
    }
  }
}

export function drawBubbles(ctx: CanvasRenderingContext2D) {
  for (const b of bubbles) {
    ctx.globalAlpha = b.opacity;
    ctx.strokeStyle = 'rgba(200, 230, 255, 0.6)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.stroke();

    // Tiny highlight
    if (b.size > 0.8) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(b.x - b.size * 0.25, b.y - b.size * 0.25, b.size * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
