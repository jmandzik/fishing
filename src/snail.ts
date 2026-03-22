// Decorative snail that crawls along the pond floor very slowly

import type { PondBounds } from './pond.ts';
import { getBowlFloorY } from './pond.ts';

export interface Snail {
  x: number;
  y: number;
  facingRight: boolean;
  speed: number;
  nextDirChange: number;
  eyePhase: number;
}

export function createSnail(bounds: PondBounds): Snail {
  const x = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.4;
  return {
    x,
    y: getBowlFloorY(x, bounds),
    facingRight: Math.random() > 0.5,
    speed: 0.02 + Math.random() * 0.01,
    nextDirChange: 5000 + Math.random() * 10000,
    eyePhase: Math.random() * Math.PI * 2,
  };
}

export function updateSnail(snail: Snail, bounds: PondBounds, dt: number, t: number) {
  // Occasionally change direction
  if (t > snail.nextDirChange) {
    if (Math.random() < 0.4) {
      snail.facingRight = !snail.facingRight;
    }
    snail.nextDirChange = t + 8000 + Math.random() * 15000;
  }

  // Move very slowly
  const dir = snail.facingRight ? 1 : -1;
  snail.x += dir * snail.speed * (dt / 16);

  // Stay on the bowl floor
  snail.y = getBowlFloorY(snail.x, bounds);

  // Turn around at pond edges (with some margin)
  const margin = (bounds.right - bounds.left) * 0.08;
  if (snail.x < bounds.left + margin) {
    snail.facingRight = true;
  } else if (snail.x > bounds.right - margin) {
    snail.facingRight = false;
  }

  // Eye stalk wobble
  snail.eyePhase += 0.002 * (dt / 16);
}

export function drawSnail(ctx: CanvasRenderingContext2D, snail: Snail, _t: number) {
  ctx.save();
  ctx.translate(snail.x, snail.y);

  const dir = snail.facingRight ? 1 : -1;
  ctx.scale(dir, 1);

  // Soft body (yellow-gray slug part)
  ctx.fillStyle = '#B0A878';
  ctx.beginPath();
  ctx.ellipse(0, -1, 2.5, 1, 0, Math.PI, Math.PI * 2);
  ctx.fillRect(-2.5, -1, 5, 1);
  ctx.fill();

  // Body underside
  ctx.fillStyle = '#C8C098';
  ctx.beginPath();
  ctx.ellipse(0, -0.5, 2, 0.5, 0, 0, Math.PI);
  ctx.fill();

  // Shell (spiral on top)
  ctx.fillStyle = '#8B6B3A';
  ctx.beginPath();
  ctx.arc(-0.5, -2.5, 2, 0, Math.PI * 2);
  ctx.fill();

  // Shell lighter inner
  ctx.fillStyle = '#A88550';
  ctx.beginPath();
  ctx.arc(-0.3, -2.7, 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Shell spiral line
  ctx.strokeStyle = '#6B4A28';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.arc(-0.5, -2.5, 1.5, Math.PI * 0.3, Math.PI * 1.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-0.3, -2.7, 0.7, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();

  // Shell highlight
  ctx.fillStyle = 'rgba(200, 180, 140, 0.3)';
  ctx.beginPath();
  ctx.arc(-0.8, -3.2, 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Eye stalks
  const wobble = Math.sin(snail.eyePhase) * 0.3;

  // Left stalk
  ctx.strokeStyle = '#B0A878';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(1.5, -1.5);
  ctx.lineTo(2.2, -3.2 + wobble);
  ctx.stroke();

  // Right stalk
  ctx.beginPath();
  ctx.moveTo(2, -1.3);
  ctx.lineTo(2.8, -2.8 + wobble * 0.8);
  ctx.stroke();

  // Eye dots
  ctx.fillStyle = '#222222';
  ctx.beginPath();
  ctx.arc(2.2, -3.2 + wobble, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(2.8, -2.8 + wobble * 0.8, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
