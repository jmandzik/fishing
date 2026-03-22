// Great Blue Heron — predatory bird that flies in, dives for fish, can be scared off

import type { PondBounds } from './pond.ts';
import type { Koi } from './koi.ts';

type HeronState = 'waiting' | 'flying_in' | 'hovering' | 'diving' | 'grabbing' | 'flying_away' | 'scared';

export interface Heron {
  x: number;
  y: number;
  state: HeronState;
  stateStart: number;
  nextAppearAt: number;
  targetFish: Koi | null;
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  wingPhase: number;
  facingRight: boolean;
  warningAlpha: number;
  carriedFish: { color: string; accentColor: string; size: number } | null;
}

export function createHeron(): Heron {
  return {
    x: 0,
    y: -30,
    state: 'waiting',
    stateStart: 0,
    nextAppearAt: 10000 + Math.random() * 20000, // first appearance 10-30s in
    targetFish: null,
    targetX: 0,
    targetY: 0,
    startX: 0,
    startY: 0,
    wingPhase: 0,
    facingRight: true,
    carriedFish: null,
    warningAlpha: 0,
  };
}

function pickTargetFish(fish: Koi[]): Koi | null {
  const alive = fish.filter(f => f.alive && !f.dead && f.size < 18);
  if (alive.length === 0) return null;
  return alive[Math.floor(Math.random() * alive.length)];
}

export function scareHeron(heron: Heron, t: number) {
  if (heron.state === 'hovering' || heron.state === 'diving') {
    heron.state = 'scared';
    heron.stateStart = t;
    heron.targetFish = null;
  }
}

export function updateHeron(
  heron: Heron, bounds: PondBounds, t: number, dt: number, fish: Koi[],
) {
  heron.wingPhase += dt * 0.008;

  switch (heron.state) {
    case 'waiting': {
      if (t >= heron.nextAppearAt) {
        const target = pickTargetFish(fish);
        if (!target) {
          // No fish, try again later
          heron.nextAppearAt = t + 10000;
          return;
        }
        heron.targetFish = target;
        // Fly in from top, from left or right side
        heron.facingRight = target.x > bounds.centerX ? false : true;
        heron.startX = heron.facingRight ? bounds.left - 30 : bounds.right + 30;
        heron.startY = -20;
        heron.x = heron.startX;
        heron.y = heron.startY;
        // Hover position above the target fish
        heron.targetX = target.x;
        heron.targetY = bounds.waterTop - 18;
        heron.state = 'flying_in';
        heron.stateStart = t;
        heron.warningAlpha = 1;
      }
      return;
    }

    case 'flying_in': {
      const elapsed = t - heron.stateStart;
      const duration = 2000;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress * (2 - progress); // ease out

      heron.x = heron.startX + (heron.targetX - heron.startX) * ease;
      heron.y = heron.startY + (heron.targetY - heron.startY) * ease;

      // Warning fades in/out
      heron.warningAlpha = Math.abs(Math.sin(t * 0.005));

      if (progress >= 1) {
        heron.state = 'hovering';
        heron.stateStart = t;
      }
      return;
    }

    case 'hovering': {
      const elapsed = t - heron.stateStart;
      // Bob gently
      heron.y = heron.targetY + Math.sin(t * 0.004) * 2;

      // Track target fish horizontally (loosely)
      if (heron.targetFish && heron.targetFish.alive && !heron.targetFish.dead) {
        heron.targetX += (heron.targetFish.x - heron.targetX) * 0.02 * (dt / 16);
        heron.x += (heron.targetX - heron.x) * 0.05 * (dt / 16);
        heron.facingRight = heron.targetFish.x > heron.x;
      }

      heron.warningAlpha = Math.abs(Math.sin(t * 0.008));

      // After 2-3 seconds of hovering, dive
      if (elapsed > 2000 + Math.random() * 1000) {
        if (heron.targetFish && heron.targetFish.alive && !heron.targetFish.dead) {
          heron.state = 'diving';
          heron.stateStart = t;
          heron.startX = heron.x;
          heron.startY = heron.y;
          heron.targetX = heron.targetFish.x;
          heron.targetY = Math.min(heron.targetFish.y, bounds.waterTop + 3); // never go below surface
        } else {
          // Target died, fly away
          heron.state = 'scared';
          heron.stateStart = t;
        }
      }
      return;
    }

    case 'diving': {
      const elapsed = t - heron.stateStart;
      const duration = 400;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress * progress; // ease in — accelerating dive

      heron.x = heron.startX + (heron.targetX - heron.startX) * ease;
      heron.y = heron.startY + (heron.targetY - heron.startY) * ease;
      heron.warningAlpha = 1;

      if (progress >= 1) {
        heron.state = 'grabbing';
        heron.stateStart = t;
        // Kill the fish if it's still alive and close enough
        if (heron.targetFish && heron.targetFish.alive && !heron.targetFish.dead) {
          const dx = heron.targetFish.x - heron.x;
          const dy = heron.targetFish.y - heron.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 20) {
            heron.carriedFish = {
              color: heron.targetFish.color,
              accentColor: heron.targetFish.accentColor,
              size: heron.targetFish.size,
            };
            heron.targetFish.alive = false;
          } else {
            heron.targetFish = null; // missed
            heron.carriedFish = null;
          }
        }
      }
      return;
    }

    case 'grabbing': {
      const elapsed = t - heron.stateStart;
      // Brief pause at water then fly away
      if (elapsed > 300) {
        heron.state = 'flying_away';
        heron.stateStart = t;
        heron.startX = heron.x;
        heron.startY = heron.y;
        // Fly away upward and to the side
        heron.targetX = heron.facingRight ? bounds.right + 40 : bounds.left - 40;
        heron.targetY = -30;
      }
      return;
    }

    case 'scared': {
      const elapsed = t - heron.stateStart;
      const duration = 1500;
      const progress = Math.min(elapsed / duration, 1);

      // Fly away quickly upward
      heron.x = heron.x + (heron.facingRight ? -1 : 1) * 0.5 * (dt / 16);
      heron.y += -1.5 * (dt / 16);
      heron.warningAlpha = Math.max(0, 1 - progress);

      if (progress >= 1) {
        heron.state = 'waiting';
        heron.nextAppearAt = t + 45000 + Math.random() * 45000;
        heron.targetFish = null;
        heron.carriedFish = null;
        heron.warningAlpha = 0;
      }
      return;
    }

    case 'flying_away': {
      const elapsed = t - heron.stateStart;
      const duration = 2000;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress * (2 - progress);

      heron.x = heron.startX + (heron.targetX - heron.startX) * ease;
      heron.y = heron.startY + (heron.targetY - heron.startY) * ease;
      heron.warningAlpha = Math.max(0, 1 - progress * 2);

      if (progress >= 1) {
        heron.state = 'waiting';
        heron.nextAppearAt = t + 45000 + Math.random() * 45000;
        heron.targetFish = null;
        heron.carriedFish = null;
        heron.warningAlpha = 0;
      }
      return;
    }
  }
}

export function drawHeron(ctx: CanvasRenderingContext2D, heron: Heron, t: number) {
  if (heron.state === 'waiting') return;

  ctx.save();
  ctx.translate(heron.x, heron.y);
  ctx.scale(0.67, 0.67); // 33% smaller

  const dir = heron.facingRight ? 1 : -1;
  ctx.scale(dir, 1);

  const wingFlap = Math.sin(heron.wingPhase + t * 0.001) * 0.6;
  const isDiving = heron.state === 'diving' || heron.state === 'grabbing';

  // --- Body ---
  // Long neck
  ctx.strokeStyle = '#A0A8B0';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (isDiving) {
    // Neck extended straight down during dive
    ctx.moveTo(0, -2);
    ctx.lineTo(4, -10);
    ctx.lineTo(6, -16);
  } else {
    // S-curve neck
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(3, -8, 1, -14);
    ctx.quadraticCurveTo(-1, -18, 2, -22);
  }
  ctx.stroke();

  // Neck fill (thicker)
  ctx.strokeStyle = '#B8C0C8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (isDiving) {
    ctx.moveTo(0, -2);
    ctx.lineTo(4, -10);
    ctx.lineTo(6, -16);
  } else {
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(3, -8, 1, -14);
    ctx.quadraticCurveTo(-1, -18, 2, -22);
  }
  ctx.stroke();

  // Head
  const headX = isDiving ? 6 : 2;
  const headY = isDiving ? -17 : -23;

  ctx.fillStyle = '#B8C0C8';
  ctx.beginPath();
  ctx.ellipse(headX, headY, 3, 2.5, isDiving ? 0.5 : 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(headX + 1.5, headY - 0.5, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(headX + 1.8, headY - 0.5, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Beak — long, pointed
  ctx.fillStyle = '#D4A020';
  ctx.beginPath();
  if (isDiving) {
    ctx.moveTo(headX + 2.5, headY - 0.5);
    ctx.lineTo(headX + 10, headY + 2);
    ctx.lineTo(headX + 2.5, headY + 1.5);
  } else {
    ctx.moveTo(headX + 2.5, headY - 0.5);
    ctx.lineTo(headX + 9, headY);
    ctx.lineTo(headX + 2.5, headY + 1);
  }
  ctx.closePath();
  ctx.fill();

  // Fish in talons when grabbing/flying away
  if ((heron.state === 'grabbing' || heron.state === 'flying_away') && heron.carriedFish) {
    const cf = heron.carriedFish;
    const fs = Math.min(cf.size, 8); // cap visual size
    const fsx = 0;
    const fsy = 14 + Math.sin(t * 0.006) * 0.5; // dangle below body

    ctx.globalAlpha = 0.9;
    // Fish body
    ctx.fillStyle = cf.color;
    ctx.beginPath();
    ctx.ellipse(fsx, fsy, fs, fs * 0.35, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Fish tail
    ctx.fillStyle = cf.accentColor;
    ctx.beginPath();
    ctx.moveTo(fsx - fs * 0.6, fsy);
    ctx.lineTo(fsx - fs * 1.1, fsy - fs * 0.3);
    ctx.lineTo(fsx - fs * 1.1, fsy + fs * 0.3);
    ctx.closePath();
    ctx.fill();
    // Fish eye (x on dead fish)
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 0.5;
    const ex = fsx + fs * 0.5;
    const ey = fsy - fs * 0.08;
    ctx.beginPath(); ctx.moveTo(ex - 0.8, ey - 0.8); ctx.lineTo(ex + 0.8, ey + 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex + 0.8, ey - 0.8); ctx.lineTo(ex - 0.8, ey + 0.8); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Body
  ctx.fillStyle = '#8890A0';
  ctx.beginPath();
  ctx.ellipse(0, 3, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wings
  const wingAngle = isDiving ? -0.3 : wingFlap;
  ctx.fillStyle = '#6878A0';

  // Left wing (visible in side profile)
  ctx.save();
  ctx.translate(-3, 0);
  ctx.rotate(-wingAngle * 0.8);
  ctx.beginPath();
  ctx.ellipse(-6, -1, 9, 2.5, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // Wing tip
  ctx.fillStyle = '#384060';
  ctx.beginPath();
  ctx.ellipse(-12, -1.5, 4, 1.5, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Right wing (partially visible)
  ctx.fillStyle = '#7888B0';
  ctx.save();
  ctx.translate(2, 0);
  ctx.rotate(wingAngle * 0.6);
  ctx.beginPath();
  ctx.ellipse(4, -1, 7, 2, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#485878';
  ctx.beginPath();
  ctx.ellipse(9, -1, 3.5, 1.2, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Tail feathers
  ctx.fillStyle = '#4A5060';
  ctx.beginPath();
  ctx.moveTo(-4, 5);
  ctx.lineTo(-8, 9);
  ctx.lineTo(-3, 8);
  ctx.lineTo(-6, 11);
  ctx.lineTo(-1, 9);
  ctx.lineTo(0, 7);
  ctx.closePath();
  ctx.fill();

  // Thin legs (only show when hovering/diving near water)
  if (heron.state === 'hovering' || heron.state === 'grabbing') {
    ctx.strokeStyle = '#5A5040';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-1, 7);
    ctx.lineTo(-2, 16);
    ctx.lineTo(-4, 17);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1, 7);
    ctx.lineTo(2, 15);
    ctx.lineTo(0, 16);
    ctx.stroke();
  }

  ctx.restore();

  // No warning indicator — heron is a natural threat
}
