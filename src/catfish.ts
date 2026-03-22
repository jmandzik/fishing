// Bottom-dwelling catfish — large, dark, eats floor pellets

import type { PondBounds } from './pond.ts';
import { isInWater, getBowlFloorY } from './pond.ts';
import type { Pellet } from './food.ts';

export interface Catfish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  facingRight: boolean;
  size: number;
  hunger: number;        // 0 = full, increases over time, max 1
  lastAteAt: number;
  chompUntil: number;
  tailPhase: number;
  alive: boolean;
}

export function createCatfish(bounds: PondBounds): Catfish {
  const floorY = getBowlFloorY(bounds.centerX, bounds);
  return {
    x: bounds.centerX + (Math.random() - 0.5) * 40,
    y: floorY - 8,
    vx: 0,
    vy: 0,
    targetX: bounds.centerX,
    targetY: floorY - 8,
    facingRight: Math.random() > 0.5,
    size: 11,
    hunger: 0.3,
    lastAteAt: 0,
    chompUntil: 0,
    tailPhase: Math.random() * Math.PI * 2,
    alive: true,
  };
}

export function updateCatfish(
  cf: Catfish, bounds: PondBounds, t: number, dt: number,
  pellets: readonly Pellet[],
  hookX?: number, hookY?: number, hookActive?: boolean,
) {
  if (!cf.alive) return;

  // Hunger
  cf.hunger = Math.min(cf.hunger + 0.00015 * (dt / 16), 1);

  // Stay near the floor
  const floorY = getBowlFloorY(cf.x, bounds);
  const desiredY = floorY - 6;

  // Look for pellets near the bottom
  let chasing = false;
  let closestDist = Infinity;
  let closestPellet: Pellet | null = null;

  const foodRange = 80 + cf.hunger * 40;
  for (const p of pellets) {
    if (!p.alive || !p.inWater) continue;
    // Only interested in pellets near the floor
    const pelletFloor = getBowlFloorY(p.x, bounds);
    if (p.y < pelletFloor - 20) continue;
    const dx = p.x - cf.x;
    const dy = p.y - cf.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < foodRange && d < closestDist) {
      closestDist = d;
      closestPellet = p;
    }
  }

  if (closestPellet) {
    cf.targetX = closestPellet.x;
    cf.targetY = closestPellet.y;
    chasing = true;

    if (closestDist < 6 && t - cf.lastAteAt > 800) {
      closestPellet.alive = false;
      cf.size = Math.min(cf.size + 0.4, 16);
      cf.hunger = Math.max(cf.hunger - 0.25, 0);
      cf.lastAteAt = t;
      cf.chompUntil = t + 300;
    }
  }

  // Go for the fishing hook if it's near the bottom
  if (!chasing && hookActive && hookX !== undefined && hookY !== undefined) {
    const hookFloor = getBowlFloorY(hookX, bounds);
    if (hookY > hookFloor - 25) {
      const hd = Math.hypot(hookX - cf.x, hookY - cf.y);
      if (hd < 60 + cf.hunger * 40) {
        cf.targetX = hookX;
        cf.targetY = hookY;
        chasing = true;
      }
    }
  }

  // Idle: slow patrol along bottom
  if (!chasing && Math.random() < 0.003) {
    const tx = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.5;
    const tFloorY = getBowlFloorY(tx, bounds);
    cf.targetX = tx;
    cf.targetY = tFloorY - 6;
  }

  // Gently pulled to floor
  if (!chasing) {
    cf.targetY = desiredY;
  }

  // Movement (slow)
  const dx = cf.targetX - cf.x;
  const dy = cf.targetY - cf.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 2) {
    const speed = chasing ? Math.min(dist * 0.015, 1.0) : Math.min(dist * 0.006, 0.4);
    const accel = chasing ? 0.08 : 0.03;
    cf.vx += (dx / dist) * speed * accel * (dt / 16);
    cf.vy += (dy / dist) * speed * accel * (dt / 16);
  }

  if (Math.abs(cf.vx) > 0.02) {
    cf.facingRight = cf.vx > 0;
  }

  cf.vx *= 0.97;
  cf.vy *= 0.97;
  cf.x += cf.vx * (dt / 16);
  cf.y += cf.vy * (dt / 16);

  // Keep in water
  if (!isInWater(cf.x, cf.y, bounds)) {
    const midY = (bounds.waterTop + bounds.bowlBottom) / 2;
    const toCenterX = bounds.centerX - cf.x;
    const toCenterY = midY - cf.y;
    const d = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
    if (d > 0) {
      cf.vx += (toCenterX / d) * 0.3;
      cf.vy += (toCenterY / d) * 0.3;
    }
    cf.x += cf.vx;
    cf.y += cf.vy;
  }

  cf.tailPhase = t * 0.004;
}

export function drawCatfish(ctx: CanvasRenderingContext2D, cf: Catfish, t: number) {
  if (!cf.alive) return;

  ctx.save();
  ctx.translate(cf.x, cf.y);

  const dir = cf.facingRight ? 1 : -1;
  ctx.scale(dir, 1);

  const s = cf.size;
  const tailWag = Math.sin(cf.tailPhase + t * 0.005) * 0.25;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.25, s * 0.9, s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail fin
  ctx.fillStyle = '#4A3A2A';
  ctx.beginPath();
  ctx.moveTo(-s * 0.8, 0);
  ctx.lineTo(-s * 1.2, -s * 0.35 + tailWag * s);
  ctx.lineTo(-s * 1.2, s * 0.35 + tailWag * s);
  ctx.closePath();
  ctx.fill();

  // Body — elongated, flattened
  ctx.fillStyle = '#5A4A3A';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 1.0, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly (lighter)
  ctx.fillStyle = '#8A7A6A';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.1, s * 0.8, s * 0.12, 0, 0, Math.PI);
  ctx.fill();

  // Flat head
  ctx.fillStyle = '#5A4A3A';
  ctx.beginPath();
  ctx.ellipse(s * 0.65, 0, s * 0.45, s * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head top (darker)
  ctx.fillStyle = '#4A3A2A';
  ctx.beginPath();
  ctx.ellipse(s * 0.65, -s * 0.08, s * 0.4, s * 0.18, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // Barbels (whiskers) — 3 pairs
  ctx.strokeStyle = '#6A5A4A';
  ctx.lineWidth = 0.6;
  // Top barbels
  ctx.beginPath();
  ctx.moveTo(s * 0.9, -s * 0.05);
  ctx.quadraticCurveTo(s * 1.3, -s * 0.2, s * 1.4, -s * 0.15 + Math.sin(t * 0.003) * s * 0.03);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.9, -s * 0.02);
  ctx.quadraticCurveTo(s * 1.2, -s * 0.12, s * 1.3, -s * 0.08 + Math.sin(t * 0.004) * s * 0.02);
  ctx.stroke();
  // Bottom barbels (shorter)
  ctx.beginPath();
  ctx.moveTo(s * 0.85, s * 0.1);
  ctx.quadraticCurveTo(s * 1.1, s * 0.2, s * 1.15, s * 0.18 + Math.sin(t * 0.003 + 1) * s * 0.02);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.85, s * 0.12);
  ctx.quadraticCurveTo(s * 1.05, s * 0.25, s * 1.1, s * 0.22 + Math.sin(t * 0.004 + 1) * s * 0.02);
  ctx.stroke();

  // Small eyes
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(s * 0.75, -s * 0.1, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(s * 0.77, -s * 0.1, s * 0.025, 0, Math.PI * 2);
  ctx.fill();

  // Bottom-facing mouth
  if (t < cf.chompUntil) {
    const chompOpen = Math.sin((t - (cf.chompUntil - 300)) * 0.04) > 0;
    if (chompOpen) {
      ctx.fillStyle = '#2A1A0A';
      ctx.beginPath();
      ctx.ellipse(s * 0.9, s * 0.12, s * 0.08, s * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = '#3A2A1A';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(s * 0.82, s * 0.12);
    ctx.lineTo(s * 0.95, s * 0.1);
    ctx.stroke();
  }

  // Dorsal fin
  ctx.fillStyle = '#4A3A2A';
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(s * 0.1, -s * 0.28);
  ctx.lineTo(-s * 0.05, -s * 0.5);
  ctx.lineTo(-s * 0.3, -s * 0.28);
  ctx.closePath();
  ctx.fill();

  // Pectoral fin
  const finFlap = Math.sin(t * 0.004) * 0.12;
  ctx.beginPath();
  ctx.ellipse(s * 0.3, s * 0.25, s * 0.2, s * 0.06, 0.2 + finFlap, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}
