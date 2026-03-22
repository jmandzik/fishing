// Frogs — sit on pond rim rocks, occasionally jump in and swim, then climb back

import { getPondBounds, isInWater } from './pond.ts';
import { spawnSplash } from './splash.ts';
import { spawnRipple } from './ripples.ts';
import { getDragonflies, eatDragonfly } from './dragonflies.ts';
import { isNighttime } from './daycycle.ts';

type FrogState = 'sitting' | 'jumping' | 'swimming' | 'climbing';

interface Frog {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  side: 'left' | 'right';
  state: FrogState;
  vx: number;
  vy: number;
  jumpTimer: number;
  swimTimer: number;
  blinkUntil: number;
  nextBlink: number;
  bobPhase: number;
  targetX: number;
  targetY: number;
  // Tongue attack
  tongueOut: boolean;
  tongueStart: number;
  tongueTargetX: number;
  tongueTargetY: number;
  tongueTimer: number; // ms until next tongue attempt
}

const frogs: Frog[] = [];
let initialized = false;

function init(w: number, h: number) {
  if (initialized) return;
  initialized = true;
  const bounds = getPondBounds(w, h);

  // Left frog sits on the left rim rocks
  frogs.push({
    x: bounds.left + 2,
    y: bounds.waterTop - 12,
    homeX: bounds.left + 2,
    homeY: bounds.waterTop - 12,
    side: 'left',
    state: 'sitting',
    vx: 0,
    vy: 0,
    jumpTimer: 20000 + Math.random() * 20000,
    swimTimer: 0,
    blinkUntil: 0,
    nextBlink: 2000 + Math.random() * 3000,
    bobPhase: Math.random() * Math.PI * 2,
    targetX: 0,
    targetY: 0,
    tongueOut: false,
    tongueStart: 0,
    tongueTargetX: 0,
    tongueTargetY: 0,
    tongueTimer: 8000 + Math.random() * 10000,
  });

  // Right frog
  frogs.push({
    x: bounds.right - 10,
    y: bounds.waterTop - 8,
    homeX: bounds.right - 10,
    homeY: bounds.waterTop - 8,
    side: 'right',
    state: 'sitting',
    vx: 0,
    vy: 0,
    jumpTimer: 25000 + Math.random() * 15000,
    swimTimer: 0,
    blinkUntil: 0,
    nextBlink: 3000 + Math.random() * 2000,
    bobPhase: Math.random() * Math.PI * 2,
    targetX: 0,
    targetY: 0,
    tongueOut: false,
    tongueStart: 0,
    tongueTargetX: 0,
    tongueTargetY: 0,
    tongueTimer: 8000 + Math.random() * 10000,
  });
}

/** Click a sitting frog to make it jump in. Returns true if a frog was clicked. */
export function clickFrog(x: number, y: number, w: number, h: number, t: number): boolean {
  if (isNighttime(t)) return false; // frogs are sleeping
  init(w, h);
  const bounds = getPondBounds(w, h);
  for (const frog of frogs) {
    if (frog.state !== 'sitting') continue;
    const d = Math.hypot(frog.x - x, frog.y - y);
    if (d < 8) {
      frog.state = 'jumping';
      const waterTargetX = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.3;
      frog.vx = (waterTargetX - frog.x) * 0.02;
      frog.vy = -1.5;
      return true;
    }
  }
  return false;
}

export function updateFrogs(dt: number, t: number, w: number, h: number) {
  init(w, h);
  const bounds = getPondBounds(w, h);

  for (const frog of frogs) {
    frog.bobPhase += dt * 0.002;

    const night = isNighttime(t);

    switch (frog.state) {
      case 'sitting': {
        // At night: sleep — eyes closed, no jumping, no tongue
        if (night) {
          frog.blinkUntil = t + 1000; // keep eyes closed
          break;
        }

        // Blink logic
        frog.nextBlink -= dt;
        if (frog.nextBlink <= 0) {
          frog.blinkUntil = t + 150;
          frog.nextBlink = 2000 + Math.random() * 4000;
        }

        // Tongue retract after 200ms
        if (frog.tongueOut && t - frog.tongueStart > 200) {
          frog.tongueOut = false;
        }

        // Tongue attack — look for nearby dragonflies
        frog.tongueTimer -= dt;
        if (frog.tongueTimer <= 0 && !frog.tongueOut) {
          frog.tongueTimer = 8000 + Math.random() * 12000;
          const flies = getDragonflies();
          let closest = Infinity;
          let target: typeof flies[number] | null = null;
          for (const fly of flies) {
            if (!fly.alive) continue;
            const d = Math.hypot(fly.x - frog.x, fly.y - frog.y);
            if (d < 30 && d < closest) {
              closest = d;
              target = fly;
            }
          }
          if (target) {
            frog.tongueOut = true;
            frog.tongueStart = t;
            frog.tongueTargetX = target.x;
            frog.tongueTargetY = target.y;
            eatDragonfly(target, t);
          }
        }

        // Jump timer
        frog.jumpTimer -= dt;
        if (frog.jumpTimer <= 0) {
          frog.state = 'jumping';
          // Jump into the water — arc toward center
          const waterTargetX = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.3;
          frog.vx = (waterTargetX - frog.x) * 0.02;
          frog.vy = -1.5; // jump up first
          frog.jumpTimer = 20000 + Math.random() * 20000;
        }
        break;
      }

      case 'jumping': {
        // Parabolic jump arc
        frog.vy += 0.06 * (dt / 16); // gravity
        frog.x += frog.vx * (dt / 16);
        frog.y += frog.vy * (dt / 16);

        // Check if entered water
        if (isInWater(frog.x, frog.y, bounds)) {
          frog.state = 'swimming';
          frog.swimTimer = 3000 + Math.random() * 2000;
          frog.vx *= 0.3;
          frog.vy *= 0.3;
          spawnSplash(frog.x, frog.y);
          spawnRipple(frog.x, frog.y);
          // Pick a swim target
          frog.targetX = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.3;
          frog.targetY = bounds.waterTop + 10 + Math.random() * 20;
        }
        break;
      }

      case 'swimming': {
        frog.swimTimer -= dt;

        // Swim toward target
        const dx = frog.targetX - frog.x;
        const dy = frog.targetY - frog.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 3) {
          frog.vx += (dx / dist) * 0.04 * (dt / 16);
          frog.vy += (dy / dist) * 0.04 * (dt / 16);
        }

        // Pick new target occasionally
        if (dist < 5 && frog.swimTimer > 1000) {
          frog.targetX = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.3;
          frog.targetY = bounds.waterTop + 8 + Math.random() * 25;
        }

        frog.vx *= 0.96;
        frog.vy *= 0.96;
        frog.x += frog.vx * (dt / 16);
        frog.y += frog.vy * (dt / 16);

        // Time to climb back — pick a random rock (could be the other frog's rock)
        if (frog.swimTimer <= 0) {
          frog.state = 'climbing';
          const otherFrog = frogs.find(f => f !== frog);
          const goToOther = otherFrog && Math.random() > 0.5;
          if (goToOther && otherFrog) {
            frog.homeX = otherFrog.homeX;
            frog.homeY = otherFrog.homeY;
            frog.side = otherFrog.side;
          }
          frog.targetX = frog.homeX;
          frog.targetY = frog.homeY;
        }
        break;
      }

      case 'climbing': {
        // Move toward home rock
        const dx = frog.homeX - frog.x;
        const dy = frog.homeY - frog.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2) {
          frog.state = 'sitting';
          frog.x = frog.homeX;
          frog.y = frog.homeY;
          frog.vx = 0;
          frog.vy = 0;
        } else {
          const speed = 0.06;
          frog.vx += (dx / dist) * speed * (dt / 16);
          frog.vy += (dy / dist) * speed * (dt / 16);
          frog.vx *= 0.95;
          frog.vy *= 0.95;
          frog.x += frog.vx * (dt / 16);
          frog.y += frog.vy * (dt / 16);
        }
        break;
      }
    }
  }
}

// Draw frogs that are sitting or climbing onto rocks — called BEFORE water is drawn
export function drawFrogsSitting(ctx: CanvasRenderingContext2D, t: number) {
  for (const frog of frogs) {
    if (frog.state !== 'sitting') continue;
    drawFrog(ctx, frog, t, false);
  }
}

// Draw frogs that are in the water — called AFTER water is drawn
export function drawFrogsSwimming(ctx: CanvasRenderingContext2D, t: number) {
  for (const frog of frogs) {
    if (frog.state === 'sitting') continue;
    drawFrog(ctx, frog, t, frog.state === 'swimming' || frog.state === 'climbing');
  }
}

function drawFrog(ctx: CanvasRenderingContext2D, frog: Frog, t: number, inWater: boolean) {
  ctx.save();
  ctx.translate(frog.x, frog.y);

  // Face movement direction when swimming/climbing, face inward when sitting
  let dir: number;
  if (frog.state === 'sitting') {
    dir = frog.side === 'left' ? 1 : -1;
  } else if (Math.abs(frog.vx) > 0.02) {
    dir = frog.vx > 0 ? 1 : -1;
  } else {
    dir = frog.side === 'left' ? 1 : -1;
  }
  ctx.scale(dir, 1);

  // Body bob when sitting
  const bob = frog.state === 'sitting' ? Math.sin(frog.bobPhase) * 0.3 : 0;

  // Swimming kick animation
  const kick = (frog.state === 'swimming' || frog.state === 'climbing') ? Math.sin(t * 0.008) * 2 : 0;

  if (inWater) {
    ctx.globalAlpha = 0.85; // slightly transparent in water
  }

  // Back leg (bent when sitting, extended when swimming)
  ctx.fillStyle = '#3A7A3A';
  if (frog.state === 'sitting') {
    // Bent back leg — thigh
    ctx.fillRect(-4, 1 + bob, 3, 2);
    // Lower leg tucked
    ctx.fillRect(-5, 2 + bob, 2, 2);
    // Foot
    ctx.fillStyle = '#2A6A2A';
    ctx.fillRect(-6, 3 + bob, 2, 1);
  } else {
    // Extended swimming legs
    ctx.fillRect(-3, 1 + kick, 2, 2);
    ctx.fillRect(-5, 2 + kick, 2, 1);
    ctx.fillStyle = '#2A6A2A';
    ctx.fillRect(-6, 2 + kick, 2, 1);
  }

  // Body — round green blob
  ctx.fillStyle = '#4A9A4A';
  ctx.beginPath();
  ctx.ellipse(0, 0 + bob, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly — lighter
  ctx.fillStyle = '#6ABA5A';
  ctx.beginPath();
  ctx.ellipse(0, 0.8 + bob, 3, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head — slightly forward
  ctx.fillStyle = '#4A9A4A';
  ctx.beginPath();
  ctx.ellipse(3, -0.5 + bob, 2.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tongue — shoots out toward dragonfly
  if (frog.tongueOut) {
    const tongueProgress = Math.min((t - frog.tongueStart) / 100, 1); // extend in 100ms
    const retract = t - frog.tongueStart > 100 ? Math.min((t - frog.tongueStart - 100) / 100, 1) : 0;
    const extend = tongueProgress * (1 - retract);
    // Tongue target in local space (dir already flipped by ctx.scale)
    const localTX = (frog.tongueTargetX - frog.x) * dir;
    const localTY = frog.tongueTargetY - frog.y;
    const tipX = 5 + (localTX - 5) * extend;
    const tipY = -0.5 + bob + (localTY + 0.5 - bob) * extend;

    ctx.strokeStyle = '#CC3355';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(5, -0.5 + bob); // mouth position
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    // Tongue tip blob
    ctx.fillStyle = '#CC3355';
    ctx.beginPath();
    ctx.arc(tipX, tipY, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eye — big and prominent
  const blinking = t < frog.blinkUntil;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(4, -1.5 + bob, 1.5, 0, Math.PI * 2);
  ctx.fill();

  if (blinking) {
    // Closed eye — line
    ctx.strokeStyle = '#2A5A2A';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(3, -1.5 + bob);
    ctx.lineTo(5, -1.5 + bob);
    ctx.stroke();
  } else {
    // Pupil
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(4.3, -1.5 + bob, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Front leg
  ctx.fillStyle = '#3A7A3A';
  ctx.fillRect(2, 1.5 + bob, 1, 2);
  ctx.fillStyle = '#2A6A2A';
  ctx.fillRect(2, 3 + bob, 2, 1);

  ctx.restore();
}
