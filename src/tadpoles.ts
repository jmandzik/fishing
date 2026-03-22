// Tadpoles — tiny creatures swimming near the pond floor that eventually evolve

import { getPondBounds, isInWater, getBowlFloorY } from './pond.ts';
import { spawnSplash } from './splash.ts';

type TadpoleState = 'swimming' | 'evolving';

interface Tadpole {
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: TadpoleState;
  // Dart-pause behavior
  dartTimer: number;      // ms until next dart
  darting: boolean;
  dartDuration: number;   // ms remaining in current dart
  targetX: number;
  targetY: number;
  // Evolution
  evolveAt: number;       // timestamp when this tadpole evolves
  // Rendering
  tailPhase: number;
  seed: number;
}

const tadpoles: Tadpole[] = [];
let initialized = false;
let nextSpawnAt = 0;

function spawnTadpole(w: number, h: number, t: number): Tadpole {
  const b = getPondBounds(w, h);
  const midY = (b.waterTop + b.bowlBottom) / 2;
  // Bottom half of the pond
  const minY = midY;
  const maxY = b.bowlBottom - 10;

  let x = b.centerX + (Math.random() - 0.5) * (b.right - b.left) * 0.5;
  let y = minY + Math.random() * (maxY - minY);

  // Make sure it's in water
  for (let attempt = 0; attempt < 10; attempt++) {
    if (isInWater(x, y, b)) break;
    x = b.centerX + (Math.random() - 0.5) * (b.right - b.left) * 0.4;
    y = minY + Math.random() * (maxY - minY);
  }

  return {
    x, y,
    vx: 0,
    vy: 0,
    state: 'swimming',
    dartTimer: 500 + Math.random() * 1500,
    darting: false,
    dartDuration: 0,
    targetX: x,
    targetY: y,
    evolveAt: t + 90000 + Math.random() * 30000, // 90-120s
    tailPhase: Math.random() * Math.PI * 2,
    seed: Math.random() * 1000,
  };
}

function init(w: number, h: number, t: number) {
  if (initialized) return;
  initialized = true;
  const count = 5 + Math.floor(Math.random() * 4); // 5-8
  for (let i = 0; i < count; i++) {
    tadpoles.push(spawnTadpole(w, h, t));
  }
  nextSpawnAt = t + 30000 + Math.random() * 30000;
}

function pickSwimTarget(tp: Tadpole, w: number, h: number) {
  const b = getPondBounds(w, h);
  const midY = (b.waterTop + b.bowlBottom) / 2;
  // Stay in bottom half
  for (let attempt = 0; attempt < 10; attempt++) {
    const tx = tp.x + (Math.random() - 0.5) * 40;
    const ty = midY + Math.random() * (b.bowlBottom - midY - 10);
    if (isInWater(tx, ty, b)) {
      tp.targetX = tx;
      tp.targetY = ty;
      return;
    }
  }
  // Fallback: toward center bottom
  tp.targetX = b.centerX + (Math.random() - 0.5) * 20;
  const floorY = getBowlFloorY(b.centerX, b);
  tp.targetY = floorY - 10 - Math.random() * 10;
}

export function updateTadpoles(dt: number, t: number, w: number, h: number) {
  init(w, h, t);

  const b = getPondBounds(w, h);

  // Spawn replacements periodically
  if (t > nextSpawnAt && tadpoles.length < 8) {
    tadpoles.push(spawnTadpole(w, h, t));
    nextSpawnAt = t + 30000 + Math.random() * 30000;
  }

  for (let i = tadpoles.length - 1; i >= 0; i--) {
    const tp = tadpoles[i];

    tp.tailPhase += (0.01 + Math.abs(tp.vx) * 0.1 + Math.abs(tp.vy) * 0.1) * (dt / 16);

    if (tp.state === 'swimming') {
      // Check evolution time
      if (t >= tp.evolveAt) {
        tp.state = 'evolving';
        tp.targetX = tp.x;
        tp.targetY = b.waterTop - 2;
        continue;
      }

      // Dart-pause behavior
      if (tp.darting) {
        tp.dartDuration -= dt;
        if (tp.dartDuration <= 0) {
          tp.darting = false;
          tp.dartTimer = 800 + Math.random() * 2000;
          tp.vx *= 0.3;
          tp.vy *= 0.3;
        } else {
          // Move toward target
          const dx = tp.targetX - tp.x;
          const dy = tp.targetY - tp.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 1) {
            tp.vx += (dx / dist) * 0.15 * (dt / 16);
            tp.vy += (dy / dist) * 0.15 * (dt / 16);
          }
        }
      } else {
        tp.dartTimer -= dt;
        if (tp.dartTimer <= 0) {
          tp.darting = true;
          tp.dartDuration = 300 + Math.random() * 400;
          pickSwimTarget(tp, w, h);
        }
        // Gentle idle drift
        tp.vx += (Math.random() - 0.5) * 0.01 * (dt / 16);
        tp.vy += (Math.random() - 0.5) * 0.01 * (dt / 16);
      }
    } else if (tp.state === 'evolving') {
      // Swim upward to the surface
      const dx = tp.targetX - tp.x;
      const dy = tp.targetY - tp.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        tp.vx += (dx / dist) * 0.08 * (dt / 16);
        tp.vy += (dy / dist) * 0.12 * (dt / 16);
      }

      // Reached surface — splash and remove
      if (tp.y <= b.waterTop + 2) {
        spawnSplash(tp.x, b.waterTop);
        tadpoles.splice(i, 1);
        continue;
      }
    }

    tp.vx *= 0.95;
    tp.vy *= 0.95;
    tp.x += tp.vx * (dt / 16);
    tp.y += tp.vy * (dt / 16);

    // Keep in water
    if (!isInWater(tp.x, tp.y, b)) {
      const toCX = b.centerX - tp.x;
      const midY = (b.waterTop + b.bowlBottom) / 2;
      const toCY = midY - tp.y;
      const d = Math.sqrt(toCX * toCX + toCY * toCY);
      if (d > 0) {
        tp.vx = (toCX / d) * 0.5;
        tp.vy = (toCY / d) * 0.5;
      }
    }
  }
}

export function drawTadpoles(ctx: CanvasRenderingContext2D, _t: number) {
  for (const tp of tadpoles) {
    ctx.save();
    ctx.translate(tp.x, tp.y);

    // Face movement direction
    const dir = tp.vx >= 0 ? 1 : -1;
    ctx.scale(dir, 1);

    // Head — small dark circle
    ctx.fillStyle = '#2A2A30';
    ctx.beginPath();
    ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Tail — wiggly sine wave line
    const tailLen = 3;
    ctx.strokeStyle = '#2A2A30';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    const segments = 6;
    for (let s = 1; s <= segments; s++) {
      const frac = s / segments;
      const sx = -1 - frac * tailLen;
      const sy = Math.sin(tp.tailPhase + frac * Math.PI * 2) * (0.8 * frac);
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Tiny eye
    ctx.fillStyle = '#666666';
    ctx.beginPath();
    ctx.arc(0.5, -0.4, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
