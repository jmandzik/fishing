// Food pellets that fall from above and sink into the water

import type { PondBounds } from './pond.ts';
import { isInWater } from './pond.ts';
import { spawnSplash } from './splash.ts';

export interface Pellet {
  x: number;
  y: number;
  vy: number;
  alive: boolean;
  inWater: boolean;
}

const pellets: Pellet[] = [];

export function getPellets(): readonly Pellet[] {
  return pellets;
}

export function dropPellet(x: number, _y: number, bounds: PondBounds) {
  // Pellet always starts at the water surface and sinks down
  pellets.push({
    x,
    y: bounds.waterTop - 2,
    vy: 0,
    alive: true,
    inWater: false,
  });
}

export function updatePellets(dt: number, bounds: PondBounds) {
  for (let i = pellets.length - 1; i >= 0; i--) {
    const p = pellets[i];
    if (!p.alive) {
      pellets.splice(i, 1);
      continue;
    }

    const inWater = isInWater(p.x, p.y, bounds);

    if (!p.inWater && !inWater) {
      // Falling through air - gravity
      p.vy += 0.04 * (dt / 16);
    } else if (!p.inWater && inWater) {
      // Just entered water — splash!
      p.inWater = true;
      spawnSplash(p.x, p.y);
    }

    if (p.inWater) {
      p.vy += 0.006 * (dt / 16);  // gentle gravity
      p.vy *= 0.92;               // water drag
    }

    p.y += p.vy * (dt / 16);

    // Remove if it sinks past the bottom of the bowl
    if (p.y > bounds.bowlBottom || !isInWater(p.x, p.y, bounds) && p.inWater) {
      pellets.splice(i, 1);
    }
  }
}

export function drawPellets(ctx: CanvasRenderingContext2D) {
  for (const p of pellets) {
    // Pellet shadow in water
    if (p.inWater) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.beginPath();
      ctx.arc(p.x + 0.5, p.y + 1, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pellet body
    ctx.fillStyle = '#C8842A';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#E8B44A';
    ctx.beginPath();
    ctx.arc(p.x - 0.5, p.y - 0.5, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}
