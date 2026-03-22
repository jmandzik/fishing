// Dragonflies — tiny insects darting above the water surface

import { getPondBounds } from './pond.ts';
import { isNighttime } from './daycycle.ts';

export interface Dragonfly {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  dartTimer: number;
  darting: boolean;
  hue: number;
  alive: boolean;
  respawnAt: number;
}

const flies: Dragonfly[] = [];
let initialized = false;

function spawnFly(w: number, h: number, fromEdge: boolean): Dragonfly {
  const bounds = getPondBounds(w, h);
  let x: number, y: number;
  if (fromEdge) {
    // Fly in from left or right edge
    const fromLeft = Math.random() > 0.5;
    x = fromLeft ? bounds.left - 15 : bounds.right + 15;
    y = bounds.waterTop - 10 - Math.random() * 15;
  } else {
    x = bounds.left + Math.random() * (bounds.right - bounds.left);
    y = bounds.waterTop - 10 - Math.random() * 15;
  }
  return {
    x, y,
    targetX: x,
    targetY: y,
    vx: 0,
    vy: 0,
    dartTimer: 2000 + Math.random() * 3000,
    darting: fromEdge, // dart inward if spawning from edge
    hue: Math.random() * 40 - 20,
    alive: true,
    respawnAt: 0,
  };
}

function init(w: number, h: number) {
  if (initialized) return;
  initialized = true;
  const count = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const fly = spawnFly(w, h, false);
    pickTarget(fly, w, h);
    flies.push(fly);
  }
}

function pickTarget(fly: Dragonfly, w: number, h: number) {
  const bounds = getPondBounds(w, h);
  const minY = bounds.waterTop - 25;
  const maxY = bounds.waterTop + 5;
  fly.targetX = bounds.left + 10 + Math.random() * (bounds.right - bounds.left - 20);
  fly.targetY = minY + Math.random() * (maxY - minY);
}

/** Get the positions of all alive dragonflies (used by frogs) */
export function getDragonflies(): readonly Dragonfly[] {
  return flies;
}

/** Called by frog when it eats a dragonfly */
export function eatDragonfly(fly: Dragonfly, t: number) {
  fly.alive = false;
  fly.respawnAt = t + 10000 + Math.random() * 15000; // respawn in 10-25s
}

export function updateDragonflies(dt: number, t: number, w: number, h: number) {
  if (isNighttime(t)) return;
  init(w, h);

  for (const fly of flies) {
    // Respawn dead dragonflies
    if (!fly.alive) {
      if (fly.respawnAt > 0 && t > fly.respawnAt) {
        const newFly = spawnFly(w, h, true);
        fly.x = newFly.x;
        fly.y = newFly.y;
        fly.vx = 0;
        fly.vy = 0;
        fly.alive = true;
        fly.respawnAt = 0;
        fly.dartTimer = 500; // dart inward quickly
        fly.darting = true;
        pickTarget(fly, w, h);
      }
      continue;
    }

    fly.dartTimer -= dt;

    if (fly.dartTimer <= 0) {
      pickTarget(fly, w, h);
      fly.darting = true;
      fly.dartTimer = 2000 + Math.random() * 4000;
    }

    const dx = fly.targetX - fly.x;
    const dy = fly.targetY - fly.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (fly.darting) {
      if (dist < 2) {
        fly.darting = false;
        fly.vx *= 0.3;
        fly.vy *= 0.3;
      } else {
        const speed = 0.25;
        fly.vx += (dx / dist) * speed * (dt / 16);
        fly.vy += (dy / dist) * speed * (dt / 16);
      }
    } else {
      fly.vx += (Math.random() - 0.5) * 0.02 * (dt / 16);
      fly.vy += (Math.random() - 0.5) * 0.015 * (dt / 16);
    }

    fly.vx *= 0.94;
    fly.vy *= 0.94;
    fly.x += fly.vx * (dt / 16);
    fly.y += fly.vy * (dt / 16);

    // Keep in bounds
    const bounds = getPondBounds(w, h);
    const minY = bounds.waterTop - 25;
    const maxY = bounds.waterTop + 5;
    if (fly.y < minY) { fly.y = minY; fly.vy = Math.abs(fly.vy) * 0.5; }
    if (fly.y > maxY) { fly.y = maxY; fly.vy = -Math.abs(fly.vy) * 0.5; }
    if (fly.x < bounds.left - 5) { fly.x = bounds.left - 5; fly.vx = Math.abs(fly.vx) * 0.5; }
    if (fly.x > bounds.right + 5) { fly.x = bounds.right + 5; fly.vx = -Math.abs(fly.vx) * 0.5; }
  }
}

export function drawDragonflies(ctx: CanvasRenderingContext2D, t: number) {
  if (isNighttime(t)) return;
  for (const fly of flies) {
    if (!fly.alive) continue;
    ctx.save();
    ctx.translate(fly.x, fly.y);

    const bodyColor = fly.hue > 0 ? '#4488AA' : '#3377BB';
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-1, 0, 3, 1);

    ctx.fillStyle = '#225566';
    ctx.fillRect(2, 0, 1, 1);

    const wingPhase = t * 0.03;
    const wingUp = Math.sin(wingPhase) * 0.7;
    const wingAlpha = 0.3 + Math.abs(Math.sin(wingPhase)) * 0.2;

    ctx.globalAlpha = wingAlpha;
    ctx.fillStyle = '#AAD4E8';

    ctx.beginPath();
    ctx.ellipse(1, -1 + wingUp, 2.5, 0.8, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-0.5, -1 + wingUp * 0.8, 2, 0.6, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(1, 1 - wingUp, 2.5, 0.8, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-0.5, 1 - wingUp * 0.8, 2, 0.6, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
