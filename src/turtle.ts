// A single turtle that swims slowly, hunts fish when hungry, and surfaces for air

import type { PondBounds } from './pond.ts';
import { isInWater, getBowlFloorY } from './pond.ts';
import type { Koi } from './koi.ts';
import { isNighttime } from './daycycle.ts';
import { spawnBubble } from './bubbles.ts';

export interface Turtle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  facingRight: boolean;
  hunger: number;
  lastAteAt: number;
  lastBreathedAt: number;
  surfacing: boolean;
  breathing: boolean;
  breathUntil: number;
  size: number;
  legPhase: number;
  // Eating animation
  eating: boolean;
  eatStart: number;
  eatingFish: { x: number; y: number; size: number; color: string; accentColor: string } | null;
  // Sleeping at night
  sleeping: boolean;
  lastSleepBubble: number;
  sleepTransition: number; // 0 = awake, 1 = fully asleep
}

// Bone particles that fly out when turtle eats
interface BoneParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  rot: number;
}

const boneParticles: BoneParticle[] = [];

function spawnBones(x: number, y: number) {
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1;
    boneParticles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.5,
      life: 1,
      size: 1 + Math.random() * 2,
      rot: Math.random() * Math.PI * 2,
    });
  }
}

export function updateBoneParticles(dt: number) {
  for (let i = boneParticles.length - 1; i >= 0; i--) {
    const p = boneParticles[i];
    p.x += p.vx * (dt / 16);
    p.y += p.vy * (dt / 16);
    p.vy += 0.02 * (dt / 16);
    p.rot += 0.05 * (dt / 16);
    p.life -= 0.015 * (dt / 16);
    if (p.life <= 0) boneParticles.splice(i, 1);
  }
}

export function drawBoneParticles(ctx: CanvasRenderingContext2D) {
  for (const p of boneParticles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    // Tiny bone shape
    ctx.fillStyle = '#F0E8D0';
    ctx.fillRect(-p.size, -0.5, p.size * 2, 1);
    ctx.beginPath();
    ctx.arc(-p.size, 0, 0.8, 0, Math.PI * 2);
    ctx.arc(p.size, 0, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function createTurtle(bounds: PondBounds): Turtle {
  const midY = (bounds.waterTop + bounds.bowlBottom) / 2;
  return {
    x: bounds.centerX,
    y: midY,
    vx: 0,
    vy: 0,
    targetX: bounds.centerX,
    targetY: midY,
    facingRight: true,
    hunger: 0.2,
    lastAteAt: 0,
    lastBreathedAt: 0,
    surfacing: false,
    breathing: false,
    breathUntil: 0,
    size: 27,
    legPhase: 0,
    eating: false,
    eatStart: 0,
    eatingFish: null,
    sleeping: false,
    lastSleepBubble: 0,
    sleepTransition: 0,
  };
}

function pickTarget(turtle: Turtle, bounds: PondBounds) {
  const midY = (bounds.waterTop + bounds.bowlBottom) / 2;
  for (let i = 0; i < 20; i++) {
    const tx = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.6;
    const ty = midY + (Math.random() - 0.5) * (bounds.bowlBottom - bounds.waterTop) * 0.4;
    if (isInWater(tx, ty, bounds)) {
      turtle.targetX = tx;
      turtle.targetY = ty;
      return;
    }
  }
  turtle.targetX = bounds.centerX;
  turtle.targetY = midY;
}

export function updateTurtle(turtle: Turtle, bounds: PondBounds, t: number, dt: number, fish: Koi[]) {
  const night = isNighttime(t);

  // --- Night sleeping behavior ---
  if (night && !turtle.sleeping && !turtle.eating) {
    // Cancel any surfacing/breathing — head to the floor
    turtle.surfacing = false;
    turtle.breathing = false;

    const floorY = getBowlFloorY(turtle.x, bounds) - turtle.size * 0.3;
    turtle.targetX = turtle.x;
    turtle.targetY = floorY;

    // Check if we've reached the floor
    if (Math.abs(turtle.y - floorY) < 3) {
      turtle.sleeping = true;
      turtle.vx = 0;
      turtle.vy = 0;
    }
    turtle.sleepTransition = Math.min(turtle.sleepTransition + 0.002 * (dt / 16), 1);
    // Fall through to movement code below, but skip hunting/breathing
  }

  if (turtle.sleeping) {
    // Stay on the floor, don't move
    turtle.vx = 0;
    turtle.vy = 0;
    turtle.sleepTransition = Math.min(turtle.sleepTransition + 0.005 * (dt / 16), 1);

    // Occasional sleep bubbles (every 5-8 seconds)
    if (t - turtle.lastSleepBubble > 5000 + Math.random() * 3000) {
      const bx = turtle.x + (turtle.facingRight ? turtle.size * 0.5 : -turtle.size * 0.5);
      spawnBubble(bx, turtle.y - turtle.size * 0.1);
      turtle.lastSleepBubble = t;
    }

    // Wake up at dawn
    if (!night) {
      turtle.sleeping = false;
      turtle.sleepTransition = 0;
      turtle.lastBreathedAt = t; // reset so it doesn't immediately surface
      pickTarget(turtle, bounds);
    }
    return;
  }

  // Wake transition: fade back to normal
  if (!night && turtle.sleepTransition > 0) {
    turtle.sleepTransition = Math.max(turtle.sleepTransition - 0.005 * (dt / 16), 0);
  }

  // Hunger increases over time (paused while sleeping)
  turtle.hunger = Math.min(turtle.hunger + 0.0003 * (dt / 16), 1);

  // --- Eating animation: pause and gulp for 600ms ---
  if (turtle.eating) {
    const elapsed = t - turtle.eatStart;
    // Stop moving while eating
    turtle.vx *= 0.9;
    turtle.vy *= 0.9;
    if (elapsed > 600) {
      turtle.eating = false;
      turtle.eatingFish = null;
    }
    return;
  }

  // Leg phase driven by actual movement speed
  const speed = Math.sqrt(turtle.vx * turtle.vx + turtle.vy * turtle.vy);
  turtle.legPhase += speed * 0.15 * (dt / 16);

  // --- Breathing: surface every 60 seconds (skip at night) ---
  const timeSinceBreath = t - turtle.lastBreathedAt;

  if (night) {
    // Skip breathing/surfacing/hunting at night — just drift to floor
    // Movement still runs below
  } else if (turtle.breathing) {
    // Stay at surface until breathUntil
    turtle.targetY = bounds.waterTop + 4;
    turtle.vy *= 0.9;
    if (t > turtle.breathUntil) {
      turtle.breathing = false;
      turtle.lastBreathedAt = t;
      pickTarget(turtle, bounds);
    }
    // Still move horizontally gently
    const dx = turtle.targetX - turtle.x;
    if (Math.abs(dx) > 2) {
      turtle.vx += (dx > 0 ? 0.01 : -0.01) * (dt / 16);
    }
    turtle.vx *= 0.96;
    turtle.x += turtle.vx * (dt / 16);
    turtle.y += (bounds.waterTop + 4 - turtle.y) * 0.05 * (dt / 16);

    if (Math.abs(turtle.vx) > 0.03) turtle.facingRight = turtle.vx > 0;
    return;
  }

  if (!night && !turtle.surfacing && timeSinceBreath > 60000) {
    turtle.surfacing = true;
    turtle.targetX = turtle.x + (Math.random() - 0.5) * 20;
    turtle.targetY = bounds.waterTop + 4;
  }

  // --- Hunt fish when hungry (not at night) ---
  let hunting = false;
  if (!night && !turtle.surfacing && turtle.hunger > 0.3) {
    const huntRange = 50 + turtle.hunger * 80; // more aggressive when hungrier
    let closestDist = Infinity;
    let closestFish: Koi | null = null;

    for (const f of fish) {
      if (!f.alive || f.dead) continue;
      if (f.size >= turtle.size) continue; // only eat fish smaller than itself
      const dx = f.x - turtle.x;
      const dy = f.y - turtle.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < huntRange && d < closestDist) {
        closestDist = d;
        closestFish = f;
      }
    }

    if (closestFish) {
      turtle.targetX = closestFish.x;
      turtle.targetY = closestFish.y;
      hunting = true;

      // Lunge burst when close to prey
      if (closestDist < turtle.size * 0.8 && closestDist > turtle.size * 0.3) {
        const lx = closestFish.x - turtle.x;
        const ly = closestFish.y - turtle.y;
        const ld = Math.sqrt(lx * lx + ly * ly);
        if (ld > 0) {
          turtle.vx += (lx / ld) * 0.8 * (dt / 16);
          turtle.vy += (ly / ld) * 0.8 * (dt / 16);
        }
      }

      // Start eating the fish
      if (closestDist < turtle.size * 0.5 && t - turtle.lastAteAt > 3000 && !turtle.eating) {
        turtle.eating = true;
        turtle.eatStart = t;
        turtle.eatingFish = {
          x: closestFish.x, y: closestFish.y,
          size: closestFish.size,
          color: closestFish.color,
          accentColor: closestFish.accentColor,
        };
        closestFish.alive = false;
        turtle.hunger = Math.max(turtle.hunger - 0.4, 0);
        turtle.lastAteAt = t;
        turtle.size = Math.min(turtle.size + closestFish.size * 0.3, 40);
        spawnBones(turtle.x + (turtle.facingRight ? turtle.size * 0.5 : -turtle.size * 0.5), turtle.y);

        // Scatter nearby fish away from the turtle
        for (const f of fish) {
          if (!f.alive || f.dead || f === closestFish) continue;
          const fdx = f.x - turtle.x;
          const fdy = f.y - turtle.y;
          const fd = Math.sqrt(fdx * fdx + fdy * fdy);
          if (fd < 80 && fd > 0) {
            const force = (1 - fd / 80) * 6;
            f.vx += (fdx / fd) * force;
            f.vy += (fdy / fd) * force;
            // Also set their target away so AI doesn't steer them back
            f.targetX = f.x + (fdx / fd) * 40;
            f.targetY = f.y + (fdy / fd) * 30;
            f.nextTargetTime = t + 2000; // don't pick a new target for 2s
          }
        }
      }
    }
  }

  // --- Idle wandering ---
  if (!hunting && !turtle.surfacing && Math.random() < 0.005) {
    pickTarget(turtle, bounds);
  }

  // --- Movement ---
  const dx = turtle.targetX - turtle.x;
  const dy = turtle.targetY - turtle.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 2) {
    // Turtles are slow; faster when surfacing or hungry-hunting
    const baseSpeed = turtle.surfacing ? 0.6 : (hunting ? 0.3 + turtle.hunger * 0.4 : 0.2);
    const speed = Math.min(dist * 0.01, baseSpeed);
    turtle.vx += (dx / dist) * speed * 0.06 * (dt / 16);
    turtle.vy += (dy / dist) * speed * 0.06 * (dt / 16);
  }

  if (Math.abs(turtle.vx) > 0.03) {
    turtle.facingRight = turtle.vx > 0;
  }

  turtle.vx *= 0.97;
  turtle.vy *= 0.97;
  turtle.x += turtle.vx * (dt / 16);
  turtle.y += turtle.vy * (dt / 16);

  // Check if reached surface for breathing
  if (turtle.surfacing && turtle.y < bounds.waterTop + 8) {
    turtle.surfacing = false;
    turtle.breathing = true;
    turtle.breathUntil = t + 2000 + Math.random() * 1000; // breathe for 2-3s
  }

  // Keep in water
  if (!isInWater(turtle.x, turtle.y, bounds)) {
    const midY = (bounds.waterTop + bounds.bowlBottom) / 2;
    const toCenterX = bounds.centerX - turtle.x;
    const toCenterY = midY - turtle.y;
    const d = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
    if (d > 0) {
      turtle.vx += (toCenterX / d) * 0.3;
      turtle.vy += (toCenterY / d) * 0.3;
    }
    turtle.x += turtle.vx;
    turtle.y += turtle.vy;
  }
}

export function drawTurtle(ctx: CanvasRenderingContext2D, turtle: Turtle, t: number) {
  ctx.save();
  ctx.translate(turtle.x, turtle.y);

  const dir = turtle.facingRight ? 1 : -1;
  ctx.scale(dir, 1);

  const s = turtle.size;
  const sleepAmt = turtle.sleepTransition;
  const kick = turtle.sleeping ? 0 : Math.sin(turtle.legPhase);
  const skinColor = '#5A8850';
  const skinLight = '#6A9A5A';
  const skinDark = '#3A6A30';

  // Side-profile view: shell is a dome on top, flat belly underneath

  // Shadow below
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.32, s * 0.45, s * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Tail (small, pointing back-up — retracts when sleeping) ---
  const tailScale = 1 - sleepAmt * 0.6;
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.moveTo(-s * 0.38, s * 0.05);
  ctx.quadraticCurveTo(-s * (0.38 + 0.17 * tailScale), -s * 0.02 + kick * s * 0.03, -s * (0.38 + 0.22 * tailScale), s * 0.0 + kick * s * 0.02);
  ctx.quadraticCurveTo(-s * (0.38 + 0.17 * tailScale), s * 0.08 + kick * s * 0.02, -s * 0.38, s * 0.1);
  ctx.fill();

  // --- Back leg (anchored well into the body, spread apart from front) ---
  // When sleeping, legs retract (shrink toward shell)
  const legScale = 1 - sleepAmt * 0.8; // shrinks to 20% when asleep
  ctx.fillStyle = skinColor;
  ctx.save();
  ctx.translate(-s * 0.2, s * 0.04);
  ctx.rotate(0.3 + kick * 0.4);
  ctx.scale(legScale, legScale);
  // Upper leg
  ctx.beginPath();
  ctx.ellipse(0, s * 0.1, s * 0.07, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  // Webbed foot
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(s * 0.02, s * 0.22, s * 0.09, s * 0.04, 0.3 + kick * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- Front leg (further forward, anchored into the body) ---
  ctx.fillStyle = skinColor;
  ctx.save();
  ctx.translate(s * 0.2, s * 0.04);
  ctx.rotate(-0.2 - kick * 0.35);
  ctx.scale(legScale, legScale);
  // Upper leg
  ctx.beginPath();
  ctx.ellipse(0, s * 0.12, s * 0.08, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  // Webbed foot / flipper
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(s * 0.02, s * 0.26, s * 0.1, s * 0.045, -0.2 - kick * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- Shell (dome seen from side) ---
  // Shell rim
  ctx.fillStyle = '#6B5030';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.02, s * 0.42, s * 0.26, 0, Math.PI, Math.PI * 2); // top dome
  ctx.ellipse(0, s * 0.02, s * 0.42, s * 0.08, 0, 0, Math.PI);           // flat bottom
  ctx.fill();

  // Belly (plastron - sits flush as the bottom of the shell)
  ctx.fillStyle = '#C8B870';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.08, s * 0.40, s * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shell main - dome
  ctx.fillStyle = '#7A9A3A';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.04, s * 0.38, s * 0.22, 0, Math.PI, Math.PI * 2);
  ctx.ellipse(0, s * 0.04, s * 0.38, s * 0.04, 0, 0, Math.PI);
  ctx.fill();

  // Shell scute lines (vertical divisions on the dome)
  ctx.strokeStyle = '#5A7A2A';
  ctx.lineWidth = 0.7;
  for (let i = -2; i <= 2; i++) {
    const x = i * s * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, s * 0.04);
    ctx.quadraticCurveTo(x, -s * 0.14, x + i * s * 0.01, -s * 0.16);
    ctx.stroke();
  }
  // Horizontal band across middle of shell
  ctx.beginPath();
  ctx.moveTo(-s * 0.36, -s * 0.04);
  ctx.quadraticCurveTo(0, -s * 0.08, s * 0.36, -s * 0.04);
  ctx.stroke();

  // Shell highlight
  ctx.fillStyle = 'rgba(140, 180, 80, 0.3)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.05, -s * 0.1, s * 0.18, s * 0.08, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // --- Neck (extends forward from shell, retracts when sleeping) ---
  const headRetract = sleepAmt * 0.35; // head pulls back into shell
  const neckExtend = 1 - headRetract;

  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.moveTo(s * 0.35, -s * 0.02);
  ctx.quadraticCurveTo(s * (0.35 + 0.15 * neckExtend), -s * 0.06, s * (0.35 + 0.2 * neckExtend), -s * 0.04);
  ctx.quadraticCurveTo(s * (0.35 + 0.15 * neckExtend), s * 0.06, s * 0.35, s * 0.1);
  ctx.fill();

  // --- Head (larger, rounder — pulls back when sleeping) ---
  const headX = s * (0.35 + 0.27 * neckExtend);
  ctx.fillStyle = skinLight;
  ctx.beginPath();
  ctx.ellipse(headX, 0, s * 0.12, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Jaw / chin slightly darker
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(headX + s * 0.02, s * 0.04, s * 0.09, s * 0.05, 0, 0, Math.PI);
  ctx.fill();

  // Eye — closed line when sleeping, open eye when awake
  if (sleepAmt > 0.5) {
    // Closed eye — horizontal line
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(headX + s * 0.01, -s * 0.03);
    ctx.lineTo(headX + s * 0.07, -s * 0.03);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(headX + s * 0.03, -s * 0.03, s * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(headX + s * 0.05, -s * 0.03, s * 0.02, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nostril
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.arc(headX + s * 0.11, -s * 0.01, s * 0.01, 0, Math.PI * 2);
  ctx.fill();

  // Mouth — chomping animation when eating
  if (turtle.eating) {
    const elapsed = t - turtle.eatStart;
    const chompOpen = Math.sin(elapsed * 0.03) > 0;
    const mouthX = headX + s * 0.11;

    if (chompOpen) {
      // Open mouth
      ctx.fillStyle = '#2A1A0A';
      ctx.beginPath();
      ctx.moveTo(mouthX, -s * 0.02);
      ctx.lineTo(mouthX + s * 0.05, -s * 0.04);
      ctx.lineTo(mouthX + s * 0.05, s * 0.04);
      ctx.lineTo(mouthX, s * 0.04);
      ctx.closePath();
      ctx.fill();
    } else {
      // Closed mouth line (gulp)
      ctx.strokeStyle = skinDark;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(headX + s * 0.06, s * 0.02);
      ctx.lineTo(mouthX + s * 0.03, s * 0.01);
      ctx.stroke();
    }

    // Head bobs forward during gulp
    const headBob = Math.sin(elapsed * 0.015) * s * 0.03;
    ctx.translate(headBob, 0);

    // Draw the fish shrinking into the mouth
    if (turtle.eatingFish) {
      const prog = Math.min(elapsed / 500, 1); // fish shrinks over 500ms
      const fishScale = 1 - prog;
      if (fishScale > 0.05) {
        const fishSize = turtle.eatingFish.size * fishScale;
        const fishDrawX = mouthX + s * 0.02 - prog * s * 0.1;
        ctx.fillStyle = turtle.eatingFish.color;
        ctx.globalAlpha = fishScale;
        ctx.beginPath();
        ctx.ellipse(fishDrawX, 0, fishSize, fishSize * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        // Tail
        ctx.fillStyle = turtle.eatingFish.accentColor;
        ctx.beginPath();
        ctx.moveTo(fishDrawX - fishSize * 0.5, 0);
        ctx.lineTo(fishDrawX - fishSize, -fishSize * 0.3);
        ctx.lineTo(fishDrawX - fishSize, fishSize * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.translate(-headBob, 0); // undo bob
  } else if (sleepAmt < 0.3) {
    // Normal mouth line (hidden when mostly asleep)
    ctx.strokeStyle = skinDark;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(headX + s * 0.06, s * 0.03);
    ctx.lineTo(headX + s * 0.11, s * 0.02);
    ctx.stroke();
  }

  // --- Breathing bubbles ---
  if (turtle.breathing) {
    ctx.fillStyle = 'rgba(200, 230, 255, 0.5)';
    const bub = Math.sin(t * 0.01) * 2;
    ctx.beginPath();
    ctx.arc(headX + s * 0.13, -s * 0.15 + bub, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headX + s * 0.08, -s * 0.25 + bub * 0.7, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Sleeping "zzz" ---
  if (turtle.sleeping) {
    const zBob = Math.sin(t * 0.003) * 2;
    ctx.fillStyle = 'rgba(200, 220, 255, 0.6)';
    ctx.font = '4px monospace';
    ctx.fillText('z', headX + s * 0.05, -s * 0.18 + zBob);
    ctx.font = '3px monospace';
    ctx.fillText('z', headX + s * 0.12, -s * 0.28 + zBob * 0.7);
    ctx.font = '2px monospace';
    ctx.fillText('z', headX + s * 0.17, -s * 0.35 + zBob * 0.5);
  }

  ctx.restore();
}
