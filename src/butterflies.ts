// Butterflies and flowers — decorative day creatures and plants near the trees

import { getPondBounds } from './pond.ts';
import { isNighttime } from './daycycle.ts';

// --- Flowers ---

interface Flower {
  x: number;
  y: number;
  petalColor: string;
  stemHeight: number;
  seed: number;
}

const flowers: Flower[] = [];
let flowersInitialized = false;

const PETAL_COLORS = ['#FF88AA', '#AA66DD', '#FFDD44', '#EEEEFF'];

function initFlowers(w: number, h: number) {
  if (flowersInitialized) return;
  flowersInitialized = true;
  const b = getPondBounds(w, h);
  const groundY = b.waterTop - 1;

  // Left side flowers near trees
  flowers.push({
    x: b.left * 0.25, y: groundY,
    petalColor: PETAL_COLORS[0], stemHeight: 8, seed: 1,
  });
  flowers.push({
    x: b.left * 0.55, y: groundY,
    petalColor: PETAL_COLORS[1], stemHeight: 6, seed: 5,
  });

  // Right side flowers near trees
  flowers.push({
    x: w - 20, y: groundY,
    petalColor: PETAL_COLORS[2], stemHeight: 7, seed: 9,
  });
  flowers.push({
    x: w - 42, y: groundY,
    petalColor: PETAL_COLORS[3], stemHeight: 9, seed: 13,
  });
}

export function drawFlowers(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  initFlowers(w, h);

  for (const fl of flowers) {
    const sway = Math.sin(t * 0.002 + fl.seed) * 1.5;

    // Stem
    ctx.strokeStyle = '#3A7A2A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y);
    ctx.quadraticCurveTo(fl.x + sway, fl.y - fl.stemHeight * 0.6, fl.x + sway * 1.2, fl.y - fl.stemHeight);
    ctx.stroke();

    const tipX = fl.x + sway * 1.2;
    const tipY = fl.y - fl.stemHeight;

    // Petals — 4 tiny circles around center
    ctx.fillStyle = fl.petalColor;
    const petalR = 1.5;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + t * 0.0005;
      const px = tipX + Math.cos(angle) * 1.5;
      const py = tipY + Math.sin(angle) * 1.5;
      ctx.beginPath();
      ctx.arc(px, py, petalR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Yellow center
    ctx.fillStyle = '#FFDD44';
    ctx.beginPath();
    ctx.arc(tipX, tipY, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Butterflies ---

interface Butterfly {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  wingColor: string;
  dartTimer: number;
  seed: number;
  active: boolean;
  enterDelay: number; // staggered appearance delay in ms
  homeX: number;      // where it lives (left or right side)
}

const butterflies: Butterfly[] = [];
let butterfliesInitialized = false;

const WING_COLORS = ['#FF8844', '#4488DD', '#DDCC44'];

function initButterflies(w: number, h: number) {
  if (butterfliesInitialized) return;
  butterfliesInitialized = true;
  const b = getPondBounds(w, h);
  const groundY = b.waterTop - 1;

  const count = 2 + Math.floor(Math.random() * 2); // 2-3
  for (let i = 0; i < count; i++) {
    const onLeft = i % 2 === 0;
    const homeX = onLeft
      ? b.left * 0.2 + Math.random() * b.left * 0.6
      : b.right + 10 + Math.random() * (w - b.right - 15);

    // Start off-screen, fly in with staggered delay
    const offScreenX = onLeft ? -15 : w + 15;

    butterflies.push({
      x: offScreenX,
      y: groundY - 10 - Math.random() * 15,
      targetX: homeX,
      targetY: groundY - 12,
      vx: 0,
      vy: 0,
      wingColor: WING_COLORS[i % WING_COLORS.length],
      dartTimer: 2000 + Math.random() * 3000,
      seed: i * 7,
      active: false,
      enterDelay: 3000 + i * 5000 + Math.random() * 4000, // stagger 3-12s apart
      homeX,
    });
  }
}

function pickButterflyTarget(bf: Butterfly, w: number, h: number) {
  const b = getPondBounds(w, h);
  const groundY = b.waterTop - 1;

  // Pick a target on either the left or right ground area, never over water
  const goLeft = Math.random() > 0.5;
  if (goLeft) {
    bf.targetX = b.left * 0.1 + Math.random() * b.left * 0.8;
  } else {
    bf.targetX = b.right + 5 + Math.random() * (w - b.right - 10);
  }
  bf.targetY = groundY - 5 - Math.random() * 20;
}

let dayStartTime = 0;
let wasDaytime = false;

export function updateButterflies(dt: number, t: number, w: number, h: number) {
  const night = isNighttime(t);

  // Track when day starts for staggered entry
  if (!night && !wasDaytime) {
    dayStartTime = t;
    // Reset all butterflies to off-screen for re-entry
    for (const bf of butterflies) {
      bf.active = false;
      const onLeft = bf.homeX < getPondBounds(w, h).centerX;
      bf.x = onLeft ? -15 : w + 15;
    }
  }
  wasDaytime = !night;

  if (night) {
    // Fly off screen at night
    for (const bf of butterflies) {
      if (!bf.active) continue;
      const onLeft = bf.homeX < getPondBounds(w, h).centerX;
      bf.targetX = onLeft ? -20 : w + 20;
      bf.targetY = bf.y;
      const dx = bf.targetX - bf.x;
      bf.vx += (dx > 0 ? 0.1 : -0.1) * (dt / 16);
      bf.vx *= 0.95;
      bf.x += bf.vx * (dt / 16);
      if (bf.x < -20 || bf.x > w + 20) {
        bf.active = false;
      }
    }
    return;
  }

  initButterflies(w, h);
  const b = getPondBounds(w, h);
  const dayElapsed = t - dayStartTime;

  for (const bf of butterflies) {
    // Staggered activation
    if (!bf.active) {
      if (dayElapsed > bf.enterDelay) {
        bf.active = true;
        bf.targetX = bf.homeX;
      }
      continue;
    }

    bf.dartTimer -= dt;

    if (bf.dartTimer <= 0) {
      pickButterflyTarget(bf, w, h);
      bf.dartTimer = 3000 + Math.random() * 5000;
    }

    const dx = bf.targetX - bf.x;
    const dy = bf.targetY - bf.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      // Slow fluttery approach
      bf.vx += (dx / dist) * 0.08 * (dt / 16);
      bf.vy += (dy / dist) * 0.06 * (dt / 16);
    }

    // Gentle random wobble for flutter effect
    bf.vx += (Math.random() - 0.5) * 0.04 * (dt / 16);
    bf.vy += (Math.random() - 0.5) * 0.03 * (dt / 16);

    bf.vx *= 0.92;
    bf.vy *= 0.92;
    bf.x += bf.vx * (dt / 16);
    bf.y += bf.vy * (dt / 16);

    // Keep out of pond area and in bounds
    const minY = b.waterTop - 30;
    const maxY = b.waterTop - 3;
    if (bf.y < minY) { bf.y = minY; bf.vy = Math.abs(bf.vy) * 0.5; }
    if (bf.y > maxY) { bf.y = maxY; bf.vy = -Math.abs(bf.vy) * 0.5; }
    if (bf.x < 2) { bf.x = 2; bf.vx = Math.abs(bf.vx); }
    if (bf.x > w - 2) { bf.x = w - 2; bf.vx = -Math.abs(bf.vx); }

    // Push away from water area
    if (bf.x > b.left - 5 && bf.x < b.right + 5) {
      const mid = b.centerX;
      if (bf.x < mid) {
        bf.vx -= 0.1 * (dt / 16);
      } else {
        bf.vx += 0.1 * (dt / 16);
      }
    }
  }
}

export function drawButterflies(ctx: CanvasRenderingContext2D, t: number) {
  for (const bf of butterflies) {
    if (!bf.active) continue;
    ctx.save();
    ctx.translate(bf.x, bf.y);

    // Wing flap — slow open/close
    const wingPhase = Math.sin(t * 0.012 + bf.seed);
    const wingSpread = 0.3 + Math.abs(wingPhase) * 0.7; // 0.3 to 1.0

    // Body — tiny 1px dark line
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, -1, 1, 2);

    // Wings — translucent colored ovals
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = bf.wingColor;

    // Upper wings
    ctx.beginPath();
    ctx.ellipse(-1.5 * wingSpread, -1, 2 * wingSpread, 1.5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(1.5 * wingSpread + 1, -1, 2 * wingSpread, 1.5, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Lower wings (slightly smaller)
    ctx.beginPath();
    ctx.ellipse(-1.2 * wingSpread, 0.5, 1.5 * wingSpread, 1, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(1.2 * wingSpread + 1, 0.5, 1.5 * wingSpread, 1, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
