// Crayfish/crawdad that walks along the pond bottom, scavenges dead fish

import type { PondBounds } from './pond.ts';
import { getBowlFloorY } from './pond.ts';
import type { Koi } from './koi.ts';
import type { Turtle } from './turtle.ts';

export interface Crayfish {
  x: number;
  y: number;
  facingRight: boolean;
  speed: number;
  legPhase: number;
  clawPhase: number;
  nextDirChange: number;
  scavenging: boolean;
  targetX: number;
  fleeing: boolean;
  fleeUntil: number;
  eating: boolean;
  eatUntil: number;
}

export function createCrayfish(bounds: PondBounds): Crayfish {
  const x = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.3;
  return {
    x,
    y: getBowlFloorY(x, bounds),
    facingRight: Math.random() > 0.5,
    speed: 0.06,
    legPhase: 0,
    clawPhase: Math.random() * Math.PI * 2,
    nextDirChange: 3000 + Math.random() * 6000,
    scavenging: false,
    targetX: x,
    fleeing: false,
    fleeUntil: 0,
    eating: false,
    eatUntil: 0,
  };
}

export function updateCrayfish(
  cf: Crayfish, bounds: PondBounds, dt: number, t: number,
  fish: Koi[], turtle: Turtle,
) {
  // Claw idle animation
  cf.clawPhase += 0.003 * (dt / 16);

  // Eating pause
  if (cf.eating) {
    if (t > cf.eatUntil) {
      cf.eating = false;
    }
    return;
  }

  // Flee from turtle if it gets close
  const tdx = turtle.x - cf.x;
  const tdy = turtle.y - cf.y;
  const tDist = Math.sqrt(tdx * tdx + tdy * tdy);

  if (tDist < 30 && !cf.fleeing) {
    cf.fleeing = true;
    cf.fleeUntil = t + 1500 + Math.random() * 1000;
    cf.facingRight = tdx > 0; // face toward turtle (walks backwards away)
    cf.scavenging = false;
  }

  if (cf.fleeing) {
    if (t > cf.fleeUntil) {
      cf.fleeing = false;
    } else {
      // Scuttle backwards fast (opposite of facing direction)
      const fleeDir = cf.facingRight ? -1 : 1;
      cf.x += fleeDir * 0.25 * (dt / 16);
      cf.legPhase += 0.3 * (dt / 16);
      cf.y = getBowlFloorY(cf.x, bounds);

      // Clamp to pond
      const margin = (bounds.right - bounds.left) * 0.08;
      if (cf.x < bounds.left + margin) cf.x = bounds.left + margin;
      if (cf.x > bounds.right - margin) cf.x = bounds.right - margin;
      return;
    }
  }

  // Look for dead fish to scavenge
  let closestDeadDist = Infinity;
  let closestDead: Koi | null = null;
  for (const f of fish) {
    if (!f.dead || !f.alive) continue;
    const dx = f.x - cf.x;
    const dy = f.y - cf.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 100 && d < closestDeadDist) {
      closestDeadDist = d;
      closestDead = f;
    }
  }

  if (closestDead) {
    cf.scavenging = true;
    cf.targetX = closestDead.x;
    cf.facingRight = closestDead.x > cf.x;

    // Walk toward dead fish
    const dir = cf.targetX > cf.x ? 1 : -1;
    cf.x += dir * cf.speed * 1.5 * (dt / 16);
    cf.legPhase += 0.15 * (dt / 16);

    // Reached the dead fish — eat it
    if (Math.abs(cf.x - closestDead.x) < 5) {
      closestDead.alive = false; // remove the corpse
      cf.eating = true;
      cf.eatUntil = t + 1500;
      cf.scavenging = false;
    }
  } else {
    cf.scavenging = false;

    // Idle walking
    if (t > cf.nextDirChange) {
      if (Math.random() < 0.4) {
        cf.facingRight = !cf.facingRight;
      }
      cf.nextDirChange = t + 4000 + Math.random() * 8000;
    }

    const dir = cf.facingRight ? 1 : -1;
    cf.x += dir * cf.speed * (dt / 16);
    cf.legPhase += 0.08 * (dt / 16);
  }

  // Stay on floor
  cf.y = getBowlFloorY(cf.x, bounds);

  // Turn around at edges
  const margin = (bounds.right - bounds.left) * 0.08;
  if (cf.x < bounds.left + margin) {
    cf.facingRight = true;
  } else if (cf.x > bounds.right - margin) {
    cf.facingRight = false;
  }
}

export function drawCrayfish(ctx: CanvasRenderingContext2D, cf: Crayfish, t: number) {
  ctx.save();
  ctx.translate(cf.x, cf.y);

  const dir = cf.facingRight ? 1 : -1;
  ctx.scale(dir, 1);

  const legKick = Math.sin(cf.legPhase);
  const clawOpen = Math.sin(cf.clawPhase) * 0.3 + 0.3;
  const bodyColor = '#8B3A1A';
  const bodyLight = '#A04A28';
  const bodyDark = '#6B2A10';

  // Eating chomp animation
  const chompOffset = cf.eating ? Math.sin(t * 0.02) * 0.5 : 0;

  // --- Fan tail ---
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(-4, -1);
  ctx.lineTo(-5.5, -2.5);
  ctx.lineTo(-4.5, -1);
  ctx.lineTo(-6, -1);
  ctx.lineTo(-4.5, 0);
  ctx.lineTo(-5.5, 1);
  ctx.lineTo(-4, 0);
  ctx.closePath();
  ctx.fill();

  // --- Segmented body ---
  // Tail segment
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(-2.5, -0.5, 2, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Middle segment
  ctx.fillStyle = bodyLight;
  ctx.beginPath();
  ctx.ellipse(0, -0.5, 2, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head/front segment
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(2.5, -0.5, 2, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Segment lines
  ctx.strokeStyle = bodyDark;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(-1, -1.7);
  ctx.lineTo(-1, 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1, -1.8);
  ctx.lineTo(1, 0.8);
  ctx.stroke();

  // --- Walking legs (4 pairs, small) ---
  ctx.strokeStyle = bodyDark;
  ctx.lineWidth = 0.4;
  for (let i = 0; i < 4; i++) {
    const lx = -1.5 + i * 1.2;
    const phase = legKick * (i % 2 === 0 ? 1 : -1);

    // Left leg (below body)
    ctx.beginPath();
    ctx.moveTo(lx, 0.5);
    ctx.lineTo(lx - 0.5 + phase * 0.3, 1.8);
    ctx.stroke();

    // Right leg (above body, but visually below in side view)
    ctx.beginPath();
    ctx.moveTo(lx, 0.5);
    ctx.lineTo(lx + 0.3 - phase * 0.3, 1.6);
    ctx.stroke();
  }

  // --- Claws ---
  // Right claw (top)
  ctx.save();
  ctx.translate(4 + chompOffset, -1);
  ctx.fillStyle = bodyLight;

  // Claw arm
  ctx.beginPath();
  ctx.ellipse(0, 0, 1.5, 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Upper pincer
  ctx.fillStyle = bodyColor;
  ctx.save();
  ctx.translate(1.5, 0);
  ctx.rotate(-clawOpen);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(2, -0.3);
  ctx.lineTo(1.5, 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Lower pincer
  ctx.fillStyle = bodyColor;
  ctx.save();
  ctx.translate(1.5, 0);
  ctx.rotate(clawOpen);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(2, 0.3);
  ctx.lineTo(1.5, -0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // Left claw (bottom)
  ctx.save();
  ctx.translate(3.5 + chompOffset, 0.5);
  ctx.fillStyle = bodyLight;

  // Claw arm
  ctx.beginPath();
  ctx.ellipse(0, 0, 1.3, 0.4, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Upper pincer
  ctx.fillStyle = bodyColor;
  ctx.save();
  ctx.translate(1.3, 0);
  ctx.rotate(-clawOpen * 0.8);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(1.8, -0.2);
  ctx.lineTo(1.3, 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Lower pincer
  ctx.fillStyle = bodyColor;
  ctx.save();
  ctx.translate(1.3, 0);
  ctx.rotate(clawOpen * 0.8);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(1.8, 0.2);
  ctx.lineTo(1.3, -0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // --- Eyes ---
  // Antennae
  ctx.strokeStyle = bodyDark;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(4, -1.2);
  ctx.lineTo(5.5, -2.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, -0.5);
  ctx.lineTo(5.5, -1.8);
  ctx.stroke();

  // Eye stalks + eyes
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(4, -1.5, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(3.8, -0.8, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Highlight on body
  ctx.fillStyle = 'rgba(180, 120, 80, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, -1.2, 3, 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
