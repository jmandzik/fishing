// Side cross-section view of a koi pond: organic bowl shape, flat water surface

import { getSkyColors, getSunPosition, getMoonPosition, drawStars, getCloudTint, getDarkness, isNighttime } from './daycycle.ts';
import { hasEffect } from './shop.ts';

export interface PondBounds {
  left: number;
  right: number;
  waterTop: number;
  bowlBottom: number;
  centerX: number;
}

export function getPondBounds(w: number, h: number): PondBounds {
  return {
    left: w * 0.08,
    right: w * 0.92,
    waterTop: h * 0.25,
    bowlBottom: h * 0.88,
    centerX: w / 2,
  };
}

// Organic bowl outline defined as a series of points with bumps
// Returns points along the bowl curve (excluding the flat water surface top)
function getBowlPoints(b: PondBounds, inset: number): { x: number; y: number }[] {
  const left = b.left + inset;
  const right = b.right - inset;
  const top = b.waterTop + inset;
  const bottom = b.bowlBottom - inset;
  const cx = b.centerX;
  const w = right - left;

  // Define the bowl as a series of hand-placed points going clockwise
  // from top-right, down the right wall, across the bottom, up the left wall
  const rawPoints: { x: number; y: number }[] = [
    // Right wall - goes down with bumps
    { x: right, y: top },
    { x: right + 3, y: top + (bottom - top) * 0.1 },
    { x: right - 2, y: top + (bottom - top) * 0.2 },
    { x: right + 1, y: top + (bottom - top) * 0.32 },
    { x: right - 4, y: top + (bottom - top) * 0.45 },
    { x: right - 10, y: top + (bottom - top) * 0.58 },
    { x: right - 20, y: top + (bottom - top) * 0.7 },
    { x: right - 35, y: top + (bottom - top) * 0.82 },
    // Bottom curve - organic with bumps
    { x: cx + w * 0.25, y: bottom - 5 },
    { x: cx + w * 0.12, y: bottom + 2 },
    { x: cx, y: bottom - 1 },
    { x: cx - w * 0.1, y: bottom + 3 },
    { x: cx - w * 0.22, y: bottom - 2 },
    // Left wall going up
    { x: left + 35, y: top + (bottom - top) * 0.82 },
    { x: left + 20, y: top + (bottom - top) * 0.7 },
    { x: left + 10, y: top + (bottom - top) * 0.58 },
    { x: left + 4, y: top + (bottom - top) * 0.45 },
    { x: left - 1, y: top + (bottom - top) * 0.32 },
    { x: left + 2, y: top + (bottom - top) * 0.2 },
    { x: left - 3, y: top + (bottom - top) * 0.1 },
    { x: left, y: top },
  ];

  return rawPoints;
}

function drawBowlPath(ctx: CanvasRenderingContext2D, b: PondBounds, inset: number) {
  const points = getBowlPoints(b, inset);
  const left = b.left + inset;
  const right = b.right + inset;
  const top = b.waterTop + inset;

  ctx.beginPath();
  // Flat water surface
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);

  // Smooth curve through the bowl points using cardinal spline-ish approach
  if (points.length > 0) {
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];

      // Catmull-Rom to cubic bezier control points
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  ctx.closePath();
}

// Rasterize the bowl spline into a per-row left/right edge lookup
// so isInWater and getBowlFloorY match the visual exactly.
let edgeLUT: { left: number; right: number }[] = [];
let lutBounds: PondBounds | null = null;

function buildEdgeLUT(b: PondBounds) {
  // Use an offscreen canvas to rasterize the bowl path
  const canvas = document.createElement('canvas');
  const h = Math.ceil(b.bowlBottom + 10);
  const w = Math.ceil(b.right + 20);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Draw the bowl fill (inset=0, same as water)
  ctx.fillStyle = '#fff';
  drawBowlPath(ctx, b, 0);
  ctx.fill();

  // Read pixel data to find left/right edges per row
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  edgeLUT = [];
  for (let y = 0; y < h; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx] > 128) { // white pixel = inside bowl
        if (left === -1) left = x;
        right = x;
      }
    }
    edgeLUT[y] = { left, right };
  }

  lutBounds = { ...b };
}

function ensureLUT(b: PondBounds) {
  if (!lutBounds || lutBounds.left !== b.left || lutBounds.right !== b.right ||
      lutBounds.waterTop !== b.waterTop || lutBounds.bowlBottom !== b.bowlBottom) {
    buildEdgeLUT(b);
  }
}

/** Get the bowl floor Y at a given x position (for anchoring decorations) */
export function getBowlFloorY(x: number, b: PondBounds): number {
  ensureLUT(b);
  const ix = Math.round(x);
  let lastY = Math.round(b.waterTop);
  for (let y = Math.round(b.waterTop); y < edgeLUT.length; y++) {
    const row = edgeLUT[y];
    if (row && ix >= row.left && ix <= row.right) {
      lastY = y;
    }
  }
  return lastY;
}

export function isInWater(x: number, y: number, bounds: PondBounds): boolean {
  ensureLUT(bounds);
  const iy = Math.round(y);
  const ix = Math.round(x);
  if (iy < 0 || iy >= edgeLUT.length) return false;
  const row = edgeLUT[iy];
  if (!row || row.left === -1) return false;
  return ix > row.left + 2 && ix < row.right - 2;
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, tint?: string) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.arc(x + 10, y - 3, 10, 0, Math.PI * 2);
  ctx.arc(x + 22, y - 1, 8, 0, Math.PI * 2);
  ctx.arc(x + 14, y + 2, 7, 0, Math.PI * 2);
  ctx.fill();
  // Night tint overlay
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fill();
  }
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number, sway: number) {
  // Trunk
  const trunkW = size * 0.15;
  const trunkH = size * 0.5;
  ctx.fillStyle = '#5A3A1A';
  ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);

  // Trunk highlight
  ctx.fillStyle = '#6B4A2A';
  ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW * 0.4, trunkH);

  // Foliage layers (bottom to top, getting smaller)
  const layers = [
    { yOff: -trunkH * 0.5, rx: size * 0.45, ry: size * 0.25, color: '#3A7A2A' },
    { yOff: -trunkH * 0.75, rx: size * 0.38, ry: size * 0.22, color: '#4A8A3A' },
    { yOff: -trunkH * 1.0, rx: size * 0.3, ry: size * 0.2, color: '#5A9A4A' },
    { yOff: -trunkH * 1.2, rx: size * 0.2, ry: size * 0.15, color: '#5AA04A' },
  ];

  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.ellipse(x + sway * 0.5, groundY + layer.yOff, layer.rx, layer.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGrassClump(ctx: CanvasRenderingContext2D, x: number, groundY: number, t: number, seed: number) {
  const bladeCount = 5 + (seed % 3);
  for (let i = 0; i < bladeCount; i++) {
    const offset = (i - bladeCount / 2) * 2;
    const height = 6 + (seed + i) % 5 * 2;
    const sway = Math.sin(t * 0.002 + seed + i * 0.8) * 2;

    ctx.strokeStyle = i % 2 === 0 ? '#5A8A3A' : '#6A9A4A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + offset, groundY);
    ctx.quadraticCurveTo(x + offset + sway, groundY - height * 0.6, x + offset + sway * 1.5, groundY - height);
    ctx.stroke();
  }
}

// --- Persistent moving worms ---
interface GroundWorm {
  x: number;
  y: number;
  angle: number;        // current direction of travel
  targetAngle: number;  // direction we're turning toward
  speed: number;
  turnTimer: number;    // when to pick a new direction
  seed: number;
}

let groundWorms: GroundWorm[] = [];
let wormsInitialized = false;

function initWorms(w: number, h: number) {
  const b = getPondBounds(w, h);
  const groundTop = b.waterTop + 8;
  const groundBottom = h - 5;
  groundWorms = [];

  // Spawn 8 worms in random dirt positions (avoiding the pond area)
  for (let i = 0; i < 8; i++) {
    let wx: number, wy: number;
    // Pick positions on left side, right side, or below pond
    const zone = i % 3;
    if (zone === 0) {
      wx = Math.random() * (b.left - 5);
      wy = groundTop + Math.random() * (groundBottom - groundTop) * 0.5;
    } else if (zone === 1) {
      wx = b.right + 5 + Math.random() * (w - b.right - 10);
      wy = groundTop + Math.random() * (groundBottom - groundTop) * 0.5;
    } else {
      wx = b.left + Math.random() * (b.right - b.left);
      wy = groundTop + (groundBottom - groundTop) * (0.7 + Math.random() * 0.25);
    }
    const a = Math.random() * Math.PI * 2;
    groundWorms.push({
      x: wx, y: wy,
      angle: a,
      targetAngle: a,
      speed: 0.001 + Math.random() * 0.0015,
      turnTimer: Math.random() * 5000,
      seed: i * 7,
    });
  }
  wormsInitialized = true;
}

function updateGroundWorms(w: number, h: number, t: number, dt: number) {
  if (!wormsInitialized) initWorms(w, h);

  const b = getPondBounds(w, h);
  for (const wm of groundWorms) {
    // Smoothly turn toward target angle
    let angleDiff = wm.targetAngle - wm.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    wm.angle += angleDiff * 0.02 * (dt / 16);

    // Move in current direction
    wm.x += Math.cos(wm.angle) * wm.speed * dt;
    wm.y += Math.sin(wm.angle) * wm.speed * dt;

    // Pick new random target direction periodically
    if (t > wm.turnTimer) {
      wm.targetAngle += (Math.random() - 0.5) * 2;
      wm.turnTimer = t + 2000 + Math.random() * 4000;
    }

    // Keep in bounds (stay in dirt, avoid pond water area)
    const groundTop = b.waterTop + 6;
    const margin = 4;
    if (wm.x < margin) { wm.x = margin; wm.targetAngle = Math.random() * Math.PI - Math.PI / 2; }
    if (wm.x > w - margin) { wm.x = w - margin; wm.targetAngle = Math.PI + (Math.random() * Math.PI - Math.PI / 2); }
    if (wm.y < groundTop) { wm.y = groundTop; wm.targetAngle = Math.abs(wm.targetAngle); }
    if (wm.y > h - margin) { wm.y = h - margin; wm.targetAngle = -Math.abs(wm.targetAngle); }

    // If worm wandered into pond water, push it out
    if (isInWater(wm.x, wm.y, b)) {
      const toCenterDist = wm.x < b.centerX ? -1 : 1;
      wm.x += toCenterDist * 2;
      wm.targetAngle = toCenterDist > 0 ? 0 : Math.PI;
    }
  }
}

function drawWorm(ctx: CanvasRenderingContext2D, wm: GroundWorm, t: number) {
  const wiggle = Math.sin(t * 0.002 + wm.seed * 2) * 2;
  const wiggle2 = Math.sin(t * 0.003 + wm.seed * 3) * 1.5;

  // Draw along the worm's travel direction
  const cos = Math.cos(wm.angle);
  const sin = Math.sin(wm.angle);
  const perpX = -sin;
  const perpY = cos;

  ctx.strokeStyle = '#E08090';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(wm.x, wm.y);
  ctx.quadraticCurveTo(
    wm.x + cos * 4 + perpX * wiggle,
    wm.y + sin * 4 + perpY * wiggle,
    wm.x + cos * 7 + perpX * wiggle2,
    wm.y + sin * 7 + perpY * wiggle2,
  );
  ctx.quadraticCurveTo(
    wm.x + cos * 9 - perpX * wiggle * 0.5,
    wm.y + sin * 9 - perpY * wiggle * 0.5,
    wm.x + cos * 11 + perpX * wiggle * 0.3,
    wm.y + sin * 11 + perpY * wiggle * 0.3,
  );
  ctx.stroke();

  // Head
  ctx.fillStyle = '#D07080';
  ctx.beginPath();
  ctx.arc(
    wm.x + cos * 11 + perpX * wiggle * 0.3,
    wm.y + sin * 11 + perpY * wiggle * 0.3,
    1, 0, Math.PI * 2,
  );
  ctx.fill();
}

function drawDirtRock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, shade: number) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(x + 0.5, y + 0.5, size, size * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const r = 80 + shade * 30;
  const g = 70 + shade * 25;
  const b = 55 + shade * 20;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.beginPath();
  ctx.ellipse(x, y, size, size * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = `rgba(255,255,255,0.15)`;
  ctx.beginPath();
  ctx.ellipse(x - size * 0.2, y - size * 0.15, size * 0.4, size * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDinoBone(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const bone = '#F0E8D8';
  const boneDark = '#D0C0A0';
  const boneOutline = '#A89878';
  const s = 2; // scale factor

  // Spine — horizontal backbone
  ctx.strokeStyle = boneOutline;
  ctx.lineWidth = 3.5 * s;
  ctx.beginPath();
  ctx.moveTo(x - 15 * s, y);
  ctx.lineTo(x + 15 * s, y);
  ctx.stroke();
  ctx.strokeStyle = bone;
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(x - 15 * s, y);
  ctx.lineTo(x + 15 * s, y);
  ctx.stroke();

  // Ribs curving down from spine
  for (let i = -2; i <= 2; i++) {
    const rx = x + i * 5 * s;
    ctx.strokeStyle = boneOutline;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(rx, y);
    ctx.quadraticCurveTo(rx + 1 * s, y + 5 * s, rx - 1 * s, y + 9 * s);
    ctx.stroke();
    ctx.strokeStyle = boneDark;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(rx, y);
    ctx.quadraticCurveTo(rx + 1 * s, y + 5 * s, rx - 1 * s, y + 9 * s);
    ctx.stroke();
  }

  // Skull (left end)
  ctx.fillStyle = boneOutline;
  ctx.beginPath();
  ctx.ellipse(x - 18 * s, y, 5 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.ellipse(x - 18 * s, y, 4.5 * s, 3.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.ellipse(x - 24 * s, y + 0.5 * s, 3 * s, 2 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye socket
  ctx.fillStyle = '#5A4A30';
  ctx.beginPath();
  ctx.arc(x - 19 * s, y - 1.5 * s, 1.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // Jaw
  ctx.strokeStyle = bone;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(x - 22 * s, y + 2 * s);
  ctx.lineTo(x - 27 * s, y + 3 * s);
  ctx.stroke();
  // Teeth
  ctx.fillStyle = bone;
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x - 26 * s + i * 2 * s, y + 3 * s, 1.2 * s, 2 * s);
  }

  // Tail (right end)
  ctx.strokeStyle = boneOutline;
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(x + 15 * s, y);
  ctx.quadraticCurveTo(x + 22 * s, y - 2 * s, x + 28 * s, y + 1 * s);
  ctx.stroke();
  ctx.strokeStyle = bone;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(x + 15 * s, y);
  ctx.quadraticCurveTo(x + 22 * s, y - 2 * s, x + 28 * s, y + 1 * s);
  ctx.stroke();
  // Tail tip
  ctx.strokeStyle = boneDark;
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(x + 28 * s, y + 1 * s);
  ctx.lineTo(x + 32 * s, y);
  ctx.stroke();

  // Hip bone
  ctx.fillStyle = boneOutline;
  ctx.beginPath();
  ctx.ellipse(x + 12 * s, y - 3 * s, 4 * s, 2.5 * s, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.ellipse(x + 12 * s, y - 3 * s, 3.5 * s, 2 * s, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Back legs
  ctx.strokeStyle = boneDark;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(x + 12 * s, y);
  ctx.quadraticCurveTo(x + 15 * s, y + 6 * s, x + 12 * s, y + 10 * s);
  ctx.stroke();
  // Back foot
  ctx.strokeStyle = boneDark;
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(x + 12 * s, y + 10 * s);
  ctx.lineTo(x + 10 * s, y + 11 * s);
  ctx.stroke();

  // Shoulder
  ctx.fillStyle = boneOutline;
  ctx.beginPath();
  ctx.ellipse(x - 10 * s, y - 3 * s, 3.5 * s, 2.5 * s, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.ellipse(x - 10 * s, y - 3 * s, 3 * s, 2 * s, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Front leg
  ctx.strokeStyle = boneDark;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y);
  ctx.quadraticCurveTo(x - 12 * s, y + 6 * s, x - 10 * s, y + 10 * s);
  ctx.stroke();
}

function drawGroundDecorations(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const bnd = getPondBounds(w, h);
  const groundTop = bnd.waterTop + 5;
  const groundH = h - groundTop;

  // Scattered dirt rocks — left side, right side, below pond
  const rocks = [
    { x: bnd.left * 0.2, yFrac: 0.2, size: 3, shade: 0 },
    { x: bnd.left * 0.6, yFrac: 0.15, size: 2, shade: 1 },
    { x: bnd.left * 0.4, yFrac: 0.5, size: 2.5, shade: 2 },
    { x: bnd.right + 18, yFrac: 0.18, size: 2.5, shade: 0 },
    { x: bnd.right + 30, yFrac: 0.3, size: 3, shade: 1 },
    { x: w - 12, yFrac: 0.25, size: 2, shade: 2 },
    { x: w * 0.35, yFrac: 0.85, size: 3.5, shade: 0 },
    { x: w * 0.55, yFrac: 0.9, size: 2, shade: 1 },
    { x: w * 0.7, yFrac: 0.88, size: 2.5, shade: 2 },
    { x: w * 0.2, yFrac: 0.92, size: 2, shade: 0 },
  ];

  for (const r of rocks) {
    drawDirtRock(ctx, r.x, groundTop + groundH * r.yFrac, r.size, r.shade);
  }

  // Worms — crawling around in the dirt
  updateGroundWorms(w, h, t, 16); // approximate dt
  for (const wm of groundWorms) {
    drawWorm(ctx, wm, t);
  }

  // Dino bone — partially buried in the lower dirt
  drawDinoBone(ctx, w * 0.15, groundTop + groundH * 0.75);
}

function drawScenery(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const b = getPondBounds(w, h);
  const groundY = b.waterTop - 1;

  const treeSway = Math.sin(t * 0.001) * 1.5;

  // --- Left side trees (tall, canopy above ground line) ---
  drawTree(ctx, b.left * 0.15, groundY, 45, treeSway * 1.1);
  drawTree(ctx, b.left * 0.5, groundY, 38, treeSway);
  drawTree(ctx, b.left * 0.75, groundY, 30, treeSway * 0.8);

  // --- Right side trees (behind fisherman, tall) ---
  drawTree(ctx, w - 10, groundY, 42, treeSway * 0.7);
  drawTree(ctx, w - 30, groundY, 35, treeSway * 0.9);

  // --- Grass clumps on the ground surface ---
  // Left side
  drawGrassClump(ctx, b.left * 0.05, groundY, t, 1);
  drawGrassClump(ctx, b.left * 0.3, groundY, t, 7);
  drawGrassClump(ctx, b.left * 0.6, groundY, t, 13);
  drawGrassClump(ctx, b.left * 0.85, groundY, t, 19);
  drawGrassClump(ctx, b.left - 3, groundY, t, 25);

  // Right side
  drawGrassClump(ctx, b.right + 8, groundY, t, 3);
  drawGrassClump(ctx, b.right + 22, groundY, t, 9);
  drawGrassClump(ctx, w - 20, groundY, t, 15);
  drawGrassClump(ctx, w - 6, groundY, t, 21);
  drawGrassClump(ctx, w - 40, groundY, t, 27);
}

function drawBird(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number, seed: number) {
  const wingFlap = Math.sin(t * 0.008 + seed * 3) * 0.4;
  const wingUp = Math.abs(wingFlap);

  ctx.strokeStyle = 'rgba(40, 40, 50, 0.6)';
  ctx.lineWidth = size * 0.3;
  ctx.lineCap = 'round';

  // Left wing
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - size * 0.6, y - size * wingUp, x - size, y - size * 0.2 + wingFlap * size);
  ctx.stroke();

  // Right wing
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + size * 0.6, y - size * wingUp, x + size, y - size * 0.2 + wingFlap * size);
  ctx.stroke();

  ctx.lineCap = 'butt';
}

function drawBirds(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, night: boolean) {
  if (night) return;
  const b = getPondBounds(w, h);
  const skyH = b.waterTop;

  // Several birds at different speeds, heights, and sizes
  const birds = [
    { speed: 0.012, offset: 0, yFrac: 0.15, size: 3, seed: 1 },
    { speed: 0.009, offset: 80, yFrac: 0.35, size: 2.5, seed: 4 },
    { speed: 0.015, offset: 160, yFrac: 0.1, size: 2, seed: 7 },
    { speed: 0.007, offset: 50, yFrac: 0.45, size: 3.5, seed: 10 },
    { speed: 0.011, offset: 220, yFrac: 0.25, size: 2, seed: 13 },
    // A little flock of 3 close together
    { speed: 0.010, offset: 130, yFrac: 0.2, size: 2, seed: 16 },
    { speed: 0.010, offset: 138, yFrac: 0.17, size: 1.8, seed: 18 },
    { speed: 0.010, offset: 125, yFrac: 0.23, size: 1.8, seed: 20 },
  ];

  for (const bird of birds) {
    const bx = ((t * bird.speed + bird.offset) % (w + 40)) - 20;
    const by = skyH * bird.yFrac;
    // Gentle vertical bob
    const bob = Math.sin(t * 0.002 + bird.seed) * 1.5;
    drawBird(ctx, bx, by + bob, bird.size, t, bird.seed);
  }
}

export function drawPond(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const b = getPondBounds(w, h);
  const night = isNighttime(t);
  const darkness = getDarkness(t);
  const skyColors = getSkyColors(t);
  const cloudTint = getCloudTint(t);

  // Sky gradient from day/night cycle
  const skyGrd = ctx.createLinearGradient(0, 0, 0, b.waterTop);
  skyGrd.addColorStop(0, skyColors.top);
  skyGrd.addColorStop(1, skyColors.bottom);
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, w, b.waterTop);

  // Stars at night
  drawStars(ctx, w, b.waterTop, t);

  // Sun — arcs across sky during dawn/day/dusk
  const sun = getSunPosition(t, w, b.waterTop);
  if (sun.visible) {
    ctx.fillStyle = 'rgba(255, 241, 118, 0.2)';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF176';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Moon at night
  const moon = getMoonPosition(t, w, b.waterTop);
  if (moon.visible) {
    // Soft glow
    ctx.fillStyle = 'rgba(200, 210, 230, 0.15)';
    ctx.beginPath();
    ctx.arc(moon.x, moon.y, 12, 0, Math.PI * 2);
    ctx.fill();
    // Moon body
    ctx.fillStyle = '#D8D8E8';
    ctx.beginPath();
    ctx.arc(moon.x, moon.y, 6, 0, Math.PI * 2);
    ctx.fill();
    // Darker crescent shadow
    ctx.fillStyle = '#A0A0B8';
    ctx.beginPath();
    ctx.arc(moon.x + 2, moon.y - 1, 5, 0, Math.PI * 2);
    ctx.fill();
    // Bright face
    ctx.fillStyle = '#E8E8F4';
    ctx.beginPath();
    ctx.arc(moon.x - 1, moon.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Clouds — scroll slowly, tinted at night
  drawCloud(ctx, ((t * 0.008 + 30) % (w + 60)) - 30, b.waterTop * 0.3, cloudTint);
  drawCloud(ctx, ((t * 0.005 + 120) % (w + 60)) - 30, b.waterTop * 0.55, cloudTint);
  drawCloud(ctx, ((t * 0.006 + 200) % (w + 60)) - 30, b.waterTop * 0.2, cloudTint);

  // Birds drifting across the sky — not at night
  drawBirds(ctx, w, h, t, night);

  // Earthy ground below sky — fills the full area, water bowl draws over it
  const groundGrd = ctx.createLinearGradient(0, b.waterTop - 5, 0, h);
  groundGrd.addColorStop(0, '#7A6A4E');
  groundGrd.addColorStop(0.3, '#6B5B3E');
  groundGrd.addColorStop(1, '#5A4A30');
  ctx.fillStyle = groundGrd;
  ctx.fillRect(0, b.waterTop, w, h - b.waterTop);

  // Dirt color patches
  const dirtColors = ['rgba(90, 75, 50, 0.3)', 'rgba(110, 85, 55, 0.25)', 'rgba(70, 60, 40, 0.3)', 'rgba(100, 80, 60, 0.2)'];
  for (let i = 0; i < 25; i++) {
    const dx = ((i * 37 + 13) % w);
    const dy = b.waterTop + 10 + ((i * 53 + 7) % (h - b.waterTop - 15));
    ctx.fillStyle = dirtColors[i % dirtColors.length];
    ctx.beginPath();
    ctx.ellipse(dx, dy, 3 + (i % 4) * 2, 1.5 + (i % 3), (i * 0.5) % Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Darkness overlay on ground
  if (darkness > 0) {
    ctx.fillStyle = `rgba(0, 0, 15, ${darkness})`;
    ctx.fillRect(0, b.waterTop, w, h - b.waterTop);
  }

  // Ground decorations
  drawGroundDecorations(ctx, w, h, t);

  // Grass strip — only draw on the left and right of the pond opening
  ctx.fillStyle = '#7B9971';
  ctx.fillRect(0, b.waterTop - 5, b.left, 8);
  ctx.fillRect(b.right, b.waterTop - 5, w - b.right, 8);
  ctx.fillStyle = '#6A8860';
  ctx.fillRect(0, b.waterTop + 1, b.left, 2);
  ctx.fillRect(b.right, b.waterTop + 1, w - b.right, 2);

  // Trees and scenery behind the pond
  drawScenery(ctx, w, h, t);

  // Rocks along the rim
  drawRocks(ctx, b);

  // Sand rim — only at the very bottom of the bowl
  ctx.save();
  const sandTop = b.waterTop + (b.bowlBottom - b.waterTop) * 0.65;
  ctx.beginPath();
  ctx.rect(0, sandTop, w, h - sandTop);
  ctx.clip();
  ctx.fillStyle = '#E8D5B7';
  drawBowlPath(ctx, b, -5);
  ctx.fill();
  ctx.restore();

  // Water — fills the whole bowl, covers the sand interior (sand peeks out as rim)
  ctx.fillStyle = '#3B7DD8';
  drawBowlPath(ctx, b, 0);
  ctx.fill();

  // Depth gradient — darker at the bottom
  const grd = ctx.createLinearGradient(0, b.waterTop, 0, b.bowlBottom);
  grd.addColorStop(0, 'rgba(20, 60, 140, 0)');
  grd.addColorStop(0.7, 'rgba(15, 45, 110, 0.15)');
  grd.addColorStop(1, 'rgba(10, 30, 80, 0.5)');
  ctx.fillStyle = grd;
  drawBowlPath(ctx, b, 0);
  ctx.fill();

  // Darkness overlay on water at night
  if (darkness > 0) {
    ctx.fillStyle = `rgba(0, 0, 20, ${darkness})`;
    drawBowlPath(ctx, b, 0);
    ctx.fill();
  }

  // Water surface — gentle animated ripples
  const surfaceY = b.waterTop;
  ctx.strokeStyle = 'rgba(150, 220, 255, 0.5)';
  ctx.lineWidth = 1;
  for (let rx = b.left; rx < b.right; rx += 1) {
    const wave = Math.sin(rx * 0.08 + t * 0.003) * 0.6
               + Math.sin(rx * 0.15 - t * 0.002) * 0.3;
    ctx.beginPath();
    ctx.moveTo(rx, surfaceY + wave);
    ctx.lineTo(rx + 1, surfaceY + Math.sin((rx + 1) * 0.08 + t * 0.003) * 0.6
               + Math.sin((rx + 1) * 0.15 - t * 0.002) * 0.3);
    ctx.stroke();
  }

  // Removed caustic ovals — too distracting
}

function drawRocks(ctx: CanvasRenderingContext2D, b: PondBounds) {
  const rocks = [
    // Left side — small, sitting on the ground beside the pond
    { x: b.left - 6, y: b.waterTop - 2, w: 12, h: 8 },
    { x: b.left + 2, y: b.waterTop - 6, w: 10, h: 7 },
    { x: b.left - 10, y: b.waterTop - 1, w: 9, h: 6 },
    // Right side
    { x: b.right + 2, y: b.waterTop - 2, w: 12, h: 8 },
    { x: b.right - 4, y: b.waterTop - 5, w: 10, h: 7 },
    { x: b.right + 8, y: b.waterTop - 1, w: 9, h: 6 },
  ];

  for (const rock of rocks) {
    ctx.fillStyle = '#5A5A5A';
    ctx.beginPath();
    ctx.ellipse(rock.x + 1, rock.y + 1, rock.w / 2, rock.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7A7A7A';
    ctx.beginPath();
    ctx.ellipse(rock.x, rock.y, rock.w / 2, rock.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#9A9A9A';
    ctx.beginPath();
    ctx.ellipse(rock.x - 2, rock.y - 2, rock.w / 3.5, rock.h / 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Returns positions near underwater rocks and the log where fish can hide */
export function getHidingSpots(w: number, h: number): { x: number; y: number }[] {
  const b = getPondBounds(w, h);
  const pondW = b.right - b.left;

  const rockOffsets = [-0.36, -0.41, -0.28, 0.38, 0.42, 0.30, 0.02, -0.12, 0.18];
  const spots: { x: number; y: number }[] = [];

  for (const xOff of rockOffsets) {
    const rx = b.centerX + pondW * xOff;
    const ry = getBowlFloorY(rx, b);
    spots.push({ x: rx, y: ry - 6 });
  }

  // Log position
  const logX = b.centerX + pondW * 0.05;
  const logY = getBowlFloorY(logX, b);
  spots.push({ x: logX, y: logY - 5 });

  return spots;
}

export function drawDecorations(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const b = getPondBounds(w, h);
  const pondW = b.right - b.left;

  // --- Pebbles scattered on the floor ---
  const pebbles = [
    // Left wall
    { xOff: -0.38, size: 2.5, color: '#8A7A6A' },
    { xOff: -0.36, size: 1.8, color: '#9A8A7A' },
    { xOff: -0.33, size: 2.2, color: '#7A6A5A' },
    { xOff: -0.42, size: 2, color: '#8A8070' },
    // Right wall
    { xOff: 0.37, size: 3, color: '#7A6A5A' },
    { xOff: 0.35, size: 2, color: '#8A8070' },
    { xOff: 0.32, size: 1.5, color: '#9A9080' },
    { xOff: 0.40, size: 2.2, color: '#7A7060' },
    // Bottom scatter
    { xOff: -0.03, size: 2.8, color: '#8A7A6A' },
    { xOff: 0.04, size: 2, color: '#9A8A7A' },
    { xOff: -0.08, size: 1.6, color: '#8A8070' },
    { xOff: 0.10, size: 2.4, color: '#7A6A5A' },
    { xOff: -0.18, size: 2, color: '#9A8A7A' },
    { xOff: 0.20, size: 1.8, color: '#8A7A6A' },
    { xOff: 0.15, size: 2.2, color: '#7A7060' },
  ];

  for (const peb of pebbles) {
    const px = b.centerX + pondW * peb.xOff;
    const py = getBowlFloorY(px, b);
    ctx.fillStyle = peb.color;
    ctx.beginPath();
    ctx.ellipse(px, py - 1, peb.size, peb.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Underwater rocks --- along the walls and floor
  const uwRocks = [
    // Left wall
    { xOff: -0.36, w: 16, h: 12 },
    { xOff: -0.41, w: 12, h: 9 },
    { xOff: -0.28, w: 10, h: 8 },
    // Right wall
    { xOff: 0.38, w: 14, h: 11 },
    { xOff: 0.42, w: 10, h: 8 },
    { xOff: 0.30, w: 12, h: 9 },
    // Bottom
    { xOff: 0.02, w: 12, h: 9 },
    { xOff: -0.12, w: 10, h: 7 },
    { xOff: 0.18, w: 8, h: 6 },
  ];

  for (const rock of uwRocks) {
    const rx = b.centerX + pondW * rock.xOff;
    const ry = getBowlFloorY(rx, b);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(rx + 1, ry - rock.h * 0.3 + 1, rock.w / 2, rock.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#5A6A5A';
    ctx.beginPath();
    ctx.ellipse(rx, ry - rock.h * 0.3, rock.w / 2, rock.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#7A8A7A';
    ctx.beginPath();
    ctx.ellipse(rx - 1, ry - rock.h * 0.45, rock.w / 3, rock.h / 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Moss patch
    ctx.fillStyle = '#4A7A3A';
    ctx.beginPath();
    ctx.ellipse(rx + 2, ry - rock.h * 0.5, rock.w / 5, rock.h / 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Log resting on the floor --- bigger, near bottom center
  const logX = b.centerX + pondW * 0.05;
  const logHalf = 25;
  const logLeftFloor = getBowlFloorY(logX - logHalf, b);
  const logRightFloor = getBowlFloorY(logX + logHalf, b);
  const logY = Math.min(logLeftFloor, logRightFloor);
  const logAngle = Math.atan2(logRightFloor - logLeftFloor, logHalf * 2);

  ctx.save();
  ctx.translate(logX, logY - 4);
  ctx.rotate(logAngle);

  // Log shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(1, 3, logHalf + 2, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Log body
  ctx.fillStyle = '#5A3A1A';
  ctx.fillRect(-logHalf, -5, logHalf * 2, 10);
  // Rounded ends
  ctx.beginPath();
  ctx.arc(-logHalf, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(logHalf, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  // Lighter bark layer
  ctx.fillStyle = '#6B4A2A';
  ctx.fillRect(-logHalf, -4, logHalf * 2, 8);

  // Bark texture lines
  ctx.strokeStyle = '#4A2A0A';
  ctx.lineWidth = 0.6;
  for (let i = -logHalf + 3; i < logHalf; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, -4);
    ctx.lineTo(i + 1, 4);
    ctx.stroke();
  }

  // Highlight
  ctx.fillStyle = '#7B5A3A';
  ctx.fillRect(-logHalf + 2, -4, logHalf * 2 - 4, 2);

  // Knot
  ctx.fillStyle = '#4A2A0A';
  ctx.beginPath();
  ctx.ellipse(logHalf * 0.3, 0, 2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // End ring (cross-section visible on right end)
  ctx.fillStyle = '#8B6A3A';
  ctx.beginPath();
  ctx.ellipse(logHalf, 0, 4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5A3A1A';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(logHalf, 0, 2, 2, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // --- Seaweed anchored to the bowl floor ---
  const seaweedPositions = [
    // Left wall — dense vegetation
    { xOff: -0.43, height: 14, strands: 2 },
    { xOff: -0.40, height: 18, strands: 3 },
    { xOff: -0.37, height: 22, strands: 3 },
    { xOff: -0.33, height: 16, strands: 2 },
    { xOff: -0.30, height: 20, strands: 2 },
    { xOff: -0.25, height: 14, strands: 2 },
    // Right wall — dense vegetation
    { xOff: 0.42, height: 15, strands: 2 },
    { xOff: 0.39, height: 20, strands: 3 },
    { xOff: 0.35, height: 24, strands: 3 },
    { xOff: 0.31, height: 18, strands: 2 },
    { xOff: 0.28, height: 16, strands: 2 },
    { xOff: 0.24, height: 14, strands: 2 },
    // Bottom center
    { xOff: -0.05, height: 26, strands: 3 },
    { xOff: 0.08, height: 22, strands: 2 },
    { xOff: -0.15, height: 20, strands: 3 },
    { xOff: 0.14, height: 18, strands: 2 },
    { xOff: -0.22, height: 16, strands: 2 },
    { xOff: 0.22, height: 15, strands: 2 },
  ];

  for (let i = 0; i < seaweedPositions.length; i++) {
    const sw = seaweedPositions[i];
    const sx = b.centerX + pondW * sw.xOff;
    const floorY = getBowlFloorY(sx, b);
    const sway = Math.sin(t * 0.002 + i * 1.7) * 3;

    const colors = ['#2D8B2D', '#38A038', '#1E7A1E'];

    for (let s = 0; s < sw.strands; s++) {
      const offset = (s - (sw.strands - 1) / 2) * 3;
      const h = sw.height * (0.7 + s * 0.15);
      const strandSway = sway * (0.8 + s * 0.2) * (s % 2 === 0 ? 1 : -0.7);

      ctx.strokeStyle = colors[s % colors.length];
      ctx.lineWidth = 2 - s * 0.3;
      ctx.beginPath();
      ctx.moveTo(sx + offset, floorY);
      ctx.bezierCurveTo(
        sx + offset + strandSway * 0.5, floorY - h * 0.33,
        sx + offset + strandSway, floorY - h * 0.66,
        sx + offset + strandSway * 1.3, floorY - h,
      );
      ctx.stroke();

      // Leaf blobs along the strand
      if (h > 14) {
        ctx.fillStyle = colors[s % colors.length];
        ctx.beginPath();
        ctx.ellipse(
          sx + offset + strandSway * 0.6, floorY - h * 0.5,
          2, 1.2, strandSway * 0.1, 0, Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  // --- Lily pads (if upgrade purchased) ---
  if (hasEffect('lily_pads')) {
    const lilyPads = [
      { xOff: -0.18, size: 7 },
      { xOff: 0.05, size: 6 },
      { xOff: 0.22, size: 8 },
      { xOff: -0.08, size: 5 },
    ];

    for (let i = 0; i < lilyPads.length; i++) {
      const lp = lilyPads[i];
      const lx = b.centerX + pondW * lp.xOff;
      const ly = b.waterTop + Math.sin(t * 0.0015 + i * 2.1) * 1;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.beginPath();
      ctx.ellipse(lx + 0.5, ly + 1, lp.size, lp.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pad body
      ctx.fillStyle = '#2D7A2D';
      ctx.beginPath();
      ctx.ellipse(lx, ly, lp.size, lp.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Notch (pie slice cut)
      ctx.fillStyle = '#3A8A4A';
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + lp.size * 0.8, ly - lp.size * 0.15);
      ctx.lineTo(lx + lp.size * 0.8, ly + lp.size * 0.15);
      ctx.closePath();
      ctx.fill();

      // Vein lines
      ctx.strokeStyle = '#1E6B1E';
      ctx.lineWidth = 0.4;
      for (let v = 0; v < 4; v++) {
        const angle = (v / 4) * Math.PI * 2 + 0.3;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + Math.cos(angle) * lp.size * 0.7, ly + Math.sin(angle) * lp.size * 0.3);
        ctx.stroke();
      }

      // Small flower on one pad
      if (i === 2) {
        ctx.fillStyle = '#FF88AA';
        ctx.beginPath();
        ctx.arc(lx - 2, ly - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFDD66';
        ctx.beginPath();
        ctx.arc(lx - 2, ly - 2, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
