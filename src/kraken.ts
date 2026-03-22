// Kraken tentacle easter egg — click the dino eye socket to summon a tentacle
// that grabs the biggest fish and drags it down

import type { Koi } from './koi.ts';
import type { PondBounds } from './pond.ts';
import { drawBowlPath } from './pond.ts';

export interface KrakenState {
  active: boolean;
  phase: 'rising' | 'grabbing' | 'pulling';
  startTime: number;
  baseX: number;        // where the tentacle emerges from
  baseY: number;        // bottom of pond
  targetFish: Koi | null;
  grabX: number;        // where the fish was grabbed
  grabY: number;
  tipX: number;         // current tentacle tip position
  tipY: number;
  floorY: number;       // visible pond floor (bowlBottom)
  cooldownUntil: number;
}

export function createKrakenState(): KrakenState {
  return {
    active: false,
    phase: 'rising',
    startTime: 0,
    baseX: 0,
    baseY: 0,
    targetFish: null,
    grabX: 0,
    grabY: 0,
    tipX: 0,
    tipY: 0,
    floorY: 0,
    cooldownUntil: 0,
  };
}

/** Returns the dino eye socket position for click detection */
export function getDinoEyePos(w: number, h: number): { x: number; y: number; radius: number } {
  const waterTop = h * 0.25;
  const groundTop = waterTop + 5;
  const groundH = h - groundTop;
  const dinoX = w * 0.15;
  const dinoY = groundTop + groundH * 0.75;
  const s = 2;
  return { x: dinoX - 19 * s, y: dinoY - 1.5 * s, radius: 5 };
}

export function handleDinoEyeClick(
  kraken: KrakenState, x: number, y: number, w: number, h: number,
  t: number, fish: Koi[], bounds: PondBounds
): boolean {
  if (kraken.active || t < kraken.cooldownUntil) return false;

  const eye = getDinoEyePos(w, h);
  if (Math.hypot(x - eye.x, y - eye.y) > eye.radius) return false;

  // Find the biggest alive fish
  let biggest: Koi | null = null;
  for (const f of fish) {
    if (!f.alive || f.dead) continue;
    if (!biggest || f.size > biggest.size) biggest = f;
  }
  if (!biggest) return false;

  kraken.active = true;
  kraken.phase = 'rising';
  kraken.startTime = t;
  kraken.targetFish = biggest;
  kraken.grabX = biggest.x;
  kraken.grabY = biggest.y;
  kraken.baseX = biggest.x;
  kraken.baseY = bounds.bowlBottom + 30;
  kraken.floorY = bounds.bowlBottom;
  kraken.tipX = biggest.x;
  kraken.tipY = bounds.bowlBottom + 30;

  return true;
}

export function updateKraken(kraken: KrakenState, t: number, _dt: number, _bounds: PondBounds) {
  if (!kraken.active || !kraken.targetFish) return;

  const elapsed = t - kraken.startTime;
  const fish = kraken.targetFish;

  switch (kraken.phase) {
    case 'rising': {
      // Tentacle rises from pond floor toward the fish over 800ms
      const dur = 800;
      const prog = Math.min(elapsed / dur, 1);
      const ease = prog * prog; // ease-in
      kraken.tipX = kraken.baseX + (fish.x - kraken.baseX) * ease;
      kraken.tipY = kraken.baseY + (fish.y - kraken.baseY) * ease;

      if (prog >= 1) {
        kraken.phase = 'grabbing';
        kraken.startTime = t;
        kraken.grabX = fish.x;
        kraken.grabY = fish.y;
      }
      break;
    }
    case 'grabbing': {
      // Brief pause while wrapping around the fish — 300ms
      const dur = 300;
      kraken.tipX = kraken.grabX;
      kraken.tipY = kraken.grabY;

      // Lock the fish in place
      fish.vx = 0;
      fish.vy = 0;
      fish.targetX = fish.x;
      fish.targetY = fish.y;

      if (elapsed >= dur) {
        kraken.phase = 'pulling';
        kraken.startTime = t;
      }
      break;
    }
    case 'pulling': {
      // Drag the fish down to the pond floor over 600ms
      const dur = 600;
      const prog = Math.min(elapsed / dur, 1);
      const ease = prog * (2 - prog); // ease-out

      kraken.tipX = kraken.grabX;
      kraken.tipY = kraken.grabY + (kraken.baseY - kraken.grabY) * ease;

      // Move the fish with the tentacle, but only while above the visible floor
      if (fish.alive) {
        fish.x = kraken.tipX;
        fish.y = Math.min(kraken.tipY, kraken.floorY - 5);
        fish.vx = 0;
        fish.vy = 0;

        // Kill the fish once it reaches the pond floor
        if (kraken.tipY >= kraken.floorY - 5) {
          fish.alive = false;
          fish.dead = true;
          fish.deadSince = t;
        }
      }

      if (prog >= 1) {
        // Tentacle fully retracted
        kraken.active = false;
        kraken.targetFish = null;
        kraken.cooldownUntil = t + 30000;
      }
      break;
    }
  }
}

export function drawKraken(ctx: CanvasRenderingContext2D, kraken: KrakenState, t: number, bounds: PondBounds) {
  if (!kraken.active) return;

  const { baseX, baseY, tipX, tipY, phase } = kraken;

  ctx.save();

  // Clip to the pond bowl so the tentacle is masked by the dirt
  drawBowlPath(ctx, bounds, 0);
  ctx.clip();

  // Draw the tentacle as a curved, tapered path with suckers
  const segments = 12;
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i <= segments; i++) {
    const frac = i / segments;
    // Interpolate from base to tip
    const px = baseX + (tipX - baseX) * frac;
    const py = baseY + (tipY - baseY) * frac;

    // Add sinusoidal wiggle that increases toward the tip
    const wiggleAmp = frac * 6;
    const wiggleFreq = 0.008;
    const wiggle = Math.sin(t * wiggleFreq + frac * Math.PI * 3) * wiggleAmp;

    points.push({ x: px + wiggle, y: py });
  }

  // Tentacle width: thick at base, thin at tip
  const baseWidth = 8;
  const tipWidth = 3;

  // Draw tentacle body (two passes: left edge and right edge to make a tapered shape)
  const leftEdge: { x: number; y: number }[] = [];
  const rightEdge: { x: number; y: number }[] = [];

  for (let i = 0; i <= segments; i++) {
    const frac = i / segments;
    const width = baseWidth + (tipWidth - baseWidth) * frac;
    const p = points[i];

    // Perpendicular direction
    let dx = 0, dy = 1;
    if (i < segments) {
      dx = points[i + 1].x - p.x;
      dy = points[i + 1].y - p.y;
    } else if (i > 0) {
      dx = p.x - points[i - 1].x;
      dy = p.y - points[i - 1].y;
    }
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    leftEdge.push({ x: p.x + nx * width / 2, y: p.y + ny * width / 2 });
    rightEdge.push({ x: p.x - nx * width / 2, y: p.y - ny * width / 2 });
  }

  // Fill tentacle body
  ctx.beginPath();
  ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
  for (let i = 1; i < leftEdge.length; i++) {
    ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
  }
  for (let i = rightEdge.length - 1; i >= 0; i--) {
    ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
  }
  ctx.closePath();

  // Pink gradient
  const grad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
  grad.addColorStop(0, '#CC4477');
  grad.addColorStop(0.5, '#E8668A');
  grad.addColorStop(1, '#F088A0');
  ctx.fillStyle = grad;
  ctx.fill();

  // Darker outline
  ctx.strokeStyle = '#AA3366';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Suckers — small circles along the inner edge
  ctx.fillStyle = '#F0AAC0';
  for (let i = 1; i < segments; i += 1) {
    const frac = i / segments;
    const p = points[i];
    const suckerSize = (baseWidth + (tipWidth - baseWidth) * frac) * 0.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, suckerSize, 0, Math.PI * 2);
    ctx.fill();
    // Sucker hole
    ctx.fillStyle = '#CC4477';
    ctx.beginPath();
    ctx.arc(p.x, p.y, suckerSize * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F0AAC0';
  }

  // Curling tip
  if (phase === 'grabbing' || phase === 'pulling') {
    const curl = Math.sin(t * 0.01) * 0.5;
    const tip = points[segments];
    ctx.strokeStyle = '#E8668A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.quadraticCurveTo(
      tip.x + 8 + curl * 3, tip.y - 4,
      tip.x + 5 + curl * 2, tip.y - 10
    );
    ctx.stroke();

    // Second wrap
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.quadraticCurveTo(
      tip.x - 6 - curl * 3, tip.y - 3,
      tip.x - 4 - curl * 2, tip.y - 8
    );
    ctx.stroke();
  }

  ctx.restore();
}
