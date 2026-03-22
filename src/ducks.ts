// Ducks — mother duck with ducklings swimming on the water surface

import { getPondBounds } from './pond.ts';
import { isNighttime } from './daycycle.ts';
import { spawnRipple } from './ripples.ts';

interface Duckling {
  offsetX: number;    // offset behind mother (negative = behind)
  bobPhase: number;
}

interface DuckState {
  x: number;
  y: number;
  facingRight: boolean;
  speed: number;
  dirTimer: number;       // time until next direction change
  ducklings: Duckling[];
  ducklingPositions: { x: number; y: number }[];
  bobPhase: number;
  // Head bob animation
  headDipping: boolean;
  headDipTimer: number;
  headDipStart: number;
  // Honk visual
  honkUntil: number;
  honkTimer: number;
  // Ripple timer
  lastRipple: number;
}

let duck: DuckState | null = null;
let initialized = false;

function init(w: number, h: number) {
  if (initialized) return;
  initialized = true;
  const b = getPondBounds(w, h);

  const ducklingCount = 2 + Math.floor(Math.random() * 2); // 2-3
  const ducklings: Duckling[] = [];
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < ducklingCount; i++) {
    ducklings.push({
      offsetX: -(8 + i * 6),
      bobPhase: Math.random() * Math.PI * 2,
    });
    positions.push({ x: b.centerX - 8 - i * 6, y: b.waterTop });
  }

  duck = {
    x: b.centerX,
    y: b.waterTop,
    facingRight: true,
    speed: 0.15,
    dirTimer: 10000 + Math.random() * 10000,
    ducklings,
    ducklingPositions: positions,
    bobPhase: 0,
    headDipping: false,
    headDipTimer: 15000 + Math.random() * 10000,
    headDipStart: 0,
    honkUntil: 0,
    honkTimer: 20000 + Math.random() * 15000,
    lastRipple: 0,
  };
}

export function updateDucks(dt: number, t: number, w: number, h: number) {
  init(w, h);
  if (!duck) return;

  const b = getPondBounds(w, h);
  const night = isNighttime(t);

  duck.y = b.waterTop;
  duck.bobPhase += dt * 0.003;

  if (night) {
    // Sleeping: slow to a stop, cluster together
    duck.speed *= 0.98;
    if (duck.speed < 0.01) duck.speed = 0;
  } else {
    duck.speed = 0.15;

    // Direction change timer
    duck.dirTimer -= dt;
    if (duck.dirTimer <= 0) {
      duck.facingRight = !duck.facingRight;
      duck.dirTimer = 10000 + Math.random() * 10000;
    }

    // Head dip timer
    duck.headDipTimer -= dt;
    if (duck.headDipTimer <= 0 && !duck.headDipping) {
      duck.headDipping = true;
      duck.headDipStart = t;
      duck.headDipTimer = 15000 + Math.random() * 10000;
    }
    if (duck.headDipping && t - duck.headDipStart > 600) {
      duck.headDipping = false;
    }

    // Honk timer
    duck.honkTimer -= dt;
    if (duck.honkTimer <= 0) {
      duck.honkUntil = t + 800;
      duck.honkTimer = 20000 + Math.random() * 15000;
    }
  }

  // Move
  const dir = duck.facingRight ? 1 : -1;
  duck.x += dir * duck.speed * (dt / 16);

  // Bounce at bounds
  const minX = b.left + 20;
  const maxX = b.right - 20;
  if (duck.x < minX) { duck.x = minX; duck.facingRight = true; }
  if (duck.x > maxX) { duck.x = maxX; duck.facingRight = false; }

  // Ripples while moving
  if (!night && duck.speed > 0.05 && t - duck.lastRipple > 2000) {
    spawnRipple(duck.x, duck.y);
    duck.lastRipple = t;
  }

  // Update duckling positions — follow with delay
  for (let i = 0; i < duck.ducklings.length; i++) {
    const dl = duck.ducklings[i];
    dl.bobPhase += dt * 0.004;
    const targetX = duck.x + dl.offsetX * dir;
    const targetY = b.waterTop;
    // Smooth follow
    const pos = duck.ducklingPositions[i];
    pos.x += (targetX - pos.x) * 0.02 * (dt / 16);
    pos.y = targetY;
  }
}

/** Returns the mother duck's x position (or null if not initialized) */
export function getDuckX(): number | null {
  return duck ? duck.x : null;
}

export function drawDucks(ctx: CanvasRenderingContext2D, t: number) {
  if (!duck) return;

  const night = isNighttime(t);
  const bob = Math.sin(duck.bobPhase) * 0.5;
  const dir = duck.facingRight ? 1 : -1;

  // --- Mother duck ---
  ctx.save();
  ctx.translate(duck.x, duck.y + bob);
  ctx.scale(dir, 1);

  // Body — oval sitting on water
  ctx.fillStyle = '#6B5030';
  ctx.beginPath();
  ctx.ellipse(0, -2, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lighter belly
  ctx.fillStyle = '#8A7050';
  ctx.beginPath();
  ctx.ellipse(0, -0.5, 4, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Green-ish head sheen
  ctx.fillStyle = '#3A6A3A';
  ctx.beginPath();
  ctx.ellipse(4, -3.5, 2.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head dip animation
  let headOffY = 0;
  if (duck.headDipping) {
    const dipProgress = (t - duck.headDipStart) / 600;
    headOffY = Math.sin(dipProgress * Math.PI) * 3;
  }

  // Head
  ctx.fillStyle = '#3A7A3A';
  ctx.beginPath();
  ctx.ellipse(4, -3.5 + headOffY, 2.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = '#E89030';
  ctx.fillRect(6, -3.5 + headOffY, 2, 1);

  // Eye
  if (!night) {
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(5, -4 + headOffY, 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Sleeping — closed eye line
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(4.5, -4 + headOffY);
    ctx.lineTo(5.5, -4 + headOffY);
    ctx.stroke();
  }

  // Tail feathers
  ctx.fillStyle = '#5A4020';
  ctx.beginPath();
  ctx.moveTo(-4, -2);
  ctx.lineTo(-6, -4);
  ctx.lineTo(-5, -1);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Honk bubble
  if (t < duck.honkUntil) {
    const honkAlpha = Math.max(0, 1 - (t - (duck.honkUntil - 800)) / 800);
    ctx.save();
    ctx.globalAlpha = honkAlpha;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(duck.x + dir * 10, duck.y - 10 + bob, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333333';
    ctx.font = '4px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!', duck.x + dir * 10, duck.y - 9 + bob);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // --- Ducklings ---
  for (let i = 0; i < duck.ducklings.length; i++) {
    const dl = duck.ducklings[i];
    const pos = duck.ducklingPositions[i];
    const dlBob = Math.sin(dl.bobPhase) * 0.4;

    ctx.save();
    ctx.translate(pos.x, pos.y + dlBob);
    ctx.scale(dir, 1);

    // Body — tiny yellow puff
    ctx.fillStyle = '#EEDD44';
    ctx.beginPath();
    ctx.ellipse(0, -1.5, 2.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lighter front
    ctx.fillStyle = '#FFEE66';
    ctx.beginPath();
    ctx.ellipse(0.5, -1, 1.5, 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#EEDD44';
    ctx.beginPath();
    ctx.arc(2, -2.5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#E89030';
    ctx.fillRect(3, -2.5, 1, 0.7);

    // Eye
    if (!night) {
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(2.5, -3, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
