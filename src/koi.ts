// Koi fish — side-view with three temperaments, hunger, breeding, death, hiding, chomp

import type { PondBounds } from './pond.ts';
import { isInWater } from './pond.ts';
import type { Pellet } from './food.ts';
import { isNighttime } from './daycycle.ts';
import { playChomp, playHeartbeat } from './sounds.ts';

export type Temperament = 'aggressive' | 'neutral' | 'shy' | 'golden';

export interface Koi {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  facingRight: boolean;
  color: string;
  accentColor: string;
  size: number;
  tailPhase: number;
  nextTargetTime: number;
  alive: boolean;
  temperament: Temperament;
  hunger: number;        // 0 = full, increases over time, max 1
  lastAteAt: number;     // timestamp of last meal
  chompUntil: number;    // timestamp when chomp animation ends
  hidingUntil: number;   // timestamp when hiding ends
  lastBredAt: number;    // breeding cooldown
  starvingSince: number; // timestamp when hunger first hit 1 (0 = not starving)
  dead: boolean;         // dying/floating phase
  deadSince: number;     // when they started floating
  bornAt: number;        // timestamp of creation (newborns get grace period)
  id: number;            // unique id
  parentIds: number[];   // ids of parents (empty for non-babies)
}

// Each temperament has its own color palette
const PALETTES: Record<Temperament, { color: string; accent: string }[]> = {
  aggressive: [
    { color: '#C02020', accent: '#FF4444' },
    { color: '#8B0000', accent: '#E84030' },
  ],
  neutral: [
    { color: '#FF8C00', accent: '#FFB347' },
    { color: '#FFFFFF', accent: '#FFD700' },
    { color: '#E84030', accent: '#FFFFFF' },
  ],
  shy: [
    { color: '#5B8FB9', accent: '#8EC8E8' },
    { color: '#B088C0', accent: '#D4B0E0' },
    { color: '#7DB87D', accent: '#A8D8A8' },
  ],
  golden: [
    { color: '#FFD700', accent: '#FFF8A0' },
  ],
};

const BEHAVIOR: Record<Temperament, {
  huntRange: number;
  fleeRange: number;
  huntSizeRatio: number;
  fleeSizeRatio: number;
  foodRange: number;
  speed: number;
}> = {
  aggressive: {
    huntRange: 90, fleeRange: 30, huntSizeRatio: 1.5,
    fleeSizeRatio: 2.5, foodRange: 100, speed: 1.2,
  },
  neutral: {
    huntRange: 70, fleeRange: 60, huntSizeRatio: 2.0,
    fleeSizeRatio: 2.0, foodRange: 80, speed: 1.0,
  },
  shy: {
    huntRange: 40, fleeRange: 90, huntSizeRatio: 2.5,
    fleeSizeRatio: 1.5, foodRange: 60, speed: 1.3,
  },
  golden: {
    huntRange: 40, fleeRange: 100, huntSizeRatio: 2.5,
    fleeSizeRatio: 1.3, foodRange: 120, speed: 1.6,
  },
};

let nextId = 1;

export function createKoi(bounds: PondBounds, temperament?: Temperament, parentPos?: { x: number; y: number }): Koi {
  const temp: Temperament = temperament ?? (['aggressive', 'neutral', 'shy'] as const)[Math.floor(Math.random() * 3)];
  const palette = PALETTES[temp];
  const chosen = palette[Math.floor(Math.random() * palette.length)];
  const size = parentPos ? 3.3 : 5.3 + Math.random() * 3.3;
  const midY = (bounds.waterTop + bounds.bowlBottom) / 2;

  return {
    x: parentPos?.x ?? bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.4,
    y: parentPos?.y ?? midY + (Math.random() - 0.5) * (bounds.bowlBottom - bounds.waterTop) * 0.3,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.2,
    targetX: bounds.centerX,
    targetY: midY,
    facingRight: Math.random() > 0.5,
    color: chosen.color,
    accentColor: chosen.accent,
    size,
    tailPhase: Math.random() * Math.PI * 2,
    nextTargetTime: 0,
    alive: true,
    temperament: temp,
    hunger: parentPos ? 0.5 : 0.3 + Math.random() * 0.2,
    lastAteAt: 0,
    chompUntil: 0,
    hidingUntil: 0,
    lastBredAt: 0,
    starvingSince: 0,
    dead: false,
    deadSince: 0,
    bornAt: 0,
    id: nextId++,
    parentIds: [],
  };
}

function pickTarget(koi: Koi, bounds: PondBounds) {
  const midY = (bounds.waterTop + bounds.bowlBottom) / 2;
  for (let i = 0; i < 20; i++) {
    const tx = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.7;
    const ty = midY + (Math.random() - 0.5) * (bounds.bowlBottom - bounds.waterTop) * 0.5;
    if (isInWater(tx, ty, bounds)) {
      koi.targetX = tx;
      koi.targetY = ty;
      return;
    }
  }
  koi.targetX = bounds.centerX;
  koi.targetY = midY;
}

export function updateKoi(
  koi: Koi, bounds: PondBounds, t: number, dt: number,
  pellets: readonly Pellet[], allFish: Koi[],
  hidingSpots: { x: number; y: number }[],
) {
  if (!koi.alive) return;

  // --- Death: float to surface belly-up ---
  if (koi.dead) {
    // Float upward
    const surfaceY = bounds.waterTop + 3;
    if (koi.y > surfaceY) {
      koi.vy = -0.3;
      koi.vx *= 0.95;
    } else {
      koi.y = surfaceY;
      koi.vy = 0;
      koi.vx *= 0.99;
      // Bob gently
      koi.y += Math.sin(t * 0.003) * 0.3;
    }
    koi.x += koi.vx * (dt / 16);
    koi.y += koi.vy * (dt / 16);
    // Remove after 4 seconds at surface
    if (koi.deadSince > 0 && t - koi.deadSince > 4000) {
      koi.alive = false;
    }
    return;
  }

  // --- Hunger ---
  koi.hunger = Math.min(koi.hunger + 0.0002 * (dt / 16), 1);

  // Starvation timer
  if (koi.hunger >= 1) {
    if (koi.starvingSince === 0) koi.starvingSince = t;
    if (t - koi.starvingSince > 15000) {
      koi.dead = true;
      koi.deadSince = t;
      return;
    }
  } else {
    koi.starvingSince = 0;
  }

  const beh = BEHAVIOR[koi.temperament];
  const hungerFactor = 1 + koi.hunger * 1.5;
  let chasing = false;
  let fleeing = false;

  // --- If hiding, stay put until timer expires ---
  if (t < koi.hidingUntil) {
    koi.vx *= 0.9;
    koi.vy *= 0.9;
    koi.x += koi.vx * (dt / 16);
    koi.y += koi.vy * (dt / 16);
    koi.tailPhase += 0.002 * (dt / 16); // slow idle wag while hiding
    return;
  }

  // --- Flee from predators ---
  let nearestThreatDist = Infinity;
  let threatX = 0;
  let threatY = 0;
  for (const other of allFish) {
    if (other === koi || !other.alive || other.dead) continue;
    if (other.size >= koi.size * beh.fleeSizeRatio) {
      const dx = other.x - koi.x;
      const dy = other.y - koi.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < beh.fleeRange && d < nearestThreatDist) {
        nearestThreatDist = d;
        threatX = dx;
        threatY = dy;
      }
    }
  }

  if (nearestThreatDist < beh.fleeRange) {
    fleeing = true;

    // Shy fish hide behind decorations
    if (koi.temperament === 'shy' && hidingSpots.length > 0) {
      let bestDist = Infinity;
      let bestSpot = hidingSpots[0];
      for (const spot of hidingSpots) {
        const d = Math.hypot(spot.x - koi.x, spot.y - koi.y);
        if (d < bestDist) {
          bestDist = d;
          bestSpot = spot;
        }
      }
      koi.targetX = bestSpot.x;
      koi.targetY = bestSpot.y;
      // Start hiding once we reach the spot
      if (bestDist < 8) {
        koi.hidingUntil = t + 3000 + Math.random() * 2000;
      }
    } else {
      const fleeD = Math.sqrt(threatX * threatX + threatY * threatY);
      if (fleeD > 0) {
        let fleeX = koi.x - (threatX / fleeD) * 50;
        let fleeY = koi.y - (threatY / fleeD) * 50;
        // Clamp flee target inside the pond so fish don't oscillate against walls
        fleeX = Math.max(bounds.left + 15, Math.min(bounds.right - 15, fleeX));
        fleeY = Math.max(bounds.waterTop + 10, Math.min(bounds.bowlBottom - 10, fleeY));
        // If target is still outside water, flee toward center instead
        if (!isInWater(fleeX, fleeY, bounds)) {
          fleeX = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.3;
          fleeY = (bounds.waterTop + bounds.bowlBottom) / 2;
        }
        koi.targetX = fleeX;
        koi.targetY = fleeY;
      }
    }
  }

  // --- Hunt prey ---
  if (!fleeing && t - koi.lastAteAt > 24000) {
    const effectiveHuntRange = beh.huntRange * hungerFactor;
    const effectiveHuntRatio = Math.max(beh.huntSizeRatio - koi.hunger * 0.5, 1.3);
    let nearestPreyDist = Infinity;
    let nearestPrey: Koi | null = null;
    for (const other of allFish) {
      if (other === koi || !other.alive || other.dead) continue;
      if (other.bornAt > 0 && t - other.bornAt < 5000) continue; // newborn grace period
      if (other.parentIds.includes(koi.id)) continue; // never eat your own children
      if (koi.size >= other.size * effectiveHuntRatio) {
        const dx = other.x - koi.x;
        const dy = other.y - koi.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < effectiveHuntRange && d < nearestPreyDist) {
          nearestPreyDist = d;
          nearestPrey = other;
        }
      }
    }

    if (nearestPrey && koi.hunger > 0.3) {
      koi.targetX = nearestPrey.x;
      koi.targetY = nearestPrey.y;
      chasing = true;

      if (nearestPreyDist < koi.size * 0.6 && t - koi.lastAteAt > 24000) {
        nearestPrey.alive = false;
        const preyGrow = koi.size < 5.3 ? nearestPrey.size * 0.8 : nearestPrey.size * 0.5;
        koi.size = Math.min(koi.size + preyGrow, 17);
        koi.hunger = Math.max(koi.hunger - 0.6, 0);
        koi.lastAteAt = t;
        koi.chompUntil = t + 400;
        koi.starvingSince = 0;
        playChomp();
      }
    }
  }

  // --- Chase food pellets ---
  const canEat = t - koi.lastAteAt > 15000;

  if (!fleeing && !chasing && canEat) {
    const effectiveFoodRange = beh.foodRange * hungerFactor;
    let closestDist = Infinity;
    let closestPellet: Pellet | null = null;
    for (const p of pellets) {
      if (!p.alive || !p.inWater) continue;
      const pdx = p.x - koi.x;
      const pdy = p.y - koi.y;
      const pd = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pd < closestDist) {
        closestDist = pd;
        closestPellet = p;
      }
    }

    if (closestPellet && closestDist < effectiveFoodRange) {
      koi.targetX = closestPellet.x;
      koi.targetY = closestPellet.y;
      chasing = true;

      if (closestDist < 5) {
        closestPellet.alive = false;
        const growAmount = koi.size < 5.3 ? 0.8 : 0.3; // babies grow faster
        koi.size = Math.min(koi.size + growAmount, 17);
        koi.hunger = Math.max(koi.hunger - 0.3, 0);
        koi.lastAteAt = t;
        koi.chompUntil = t + 300;
        koi.starvingSince = 0;
        playChomp();
      }
    }
  }

  // --- Idle behavior ---
  const night = isNighttime(t);
  const idleMultiplier = night ? 2.5 : 1; // longer idle times at night

  if (!chasing && !fleeing && koi.hunger > 0.5 && t > koi.nextTargetTime && !night) {
    // Hungry surface seeking — disabled at night
    const surfaceY = bounds.waterTop + 10 + Math.random() * 15;
    const tx = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.6;
    if (isInWater(tx, surfaceY, bounds)) {
      koi.targetX = tx;
      koi.targetY = surfaceY;
    } else {
      pickTarget(koi, bounds);
    }
    koi.nextTargetTime = t + 1000 + Math.random() * 2000;
  } else if (!chasing && !fleeing && t > koi.nextTargetTime) {
    if (night) {
      // At night, drift toward the bottom of the pond
      const bottomY = bounds.bowlBottom - (bounds.bowlBottom - bounds.waterTop) * 0.2;
      const tx = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.4;
      const ty = bottomY - Math.random() * (bounds.bowlBottom - bounds.waterTop) * 0.2;
      if (isInWater(tx, ty, bounds)) {
        koi.targetX = tx;
        koi.targetY = ty;
      } else {
        pickTarget(koi, bounds);
      }
    } else {
      pickTarget(koi, bounds);
    }
    koi.nextTargetTime = t + (2000 + Math.random() * 4000) * idleMultiplier;
  }

  // --- Movement ---
  const dx = koi.targetX - koi.x;
  const dy = koi.targetY - koi.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nightSpeedFactor = night ? 0.5 : 1;

  if (dist > 2) {
    const speed = ((chasing || fleeing)
      ? Math.min(dist * 0.03, 2.5) * beh.speed
      : Math.min(dist * 0.008, 0.8)) * nightSpeedFactor;
    const accel = (chasing || fleeing) ? 0.15 : 0.05;
    koi.vx += (dx / dist) * speed * accel * (dt / 16);
    koi.vy += (dy / dist) * speed * accel * (dt / 16);
  }

  if (Math.abs(koi.vx) > 0.05) {
    koi.facingRight = koi.vx > 0;
  }

  koi.vx *= 0.98;
  koi.vy *= 0.98;
  koi.x += koi.vx * (dt / 16);
  koi.y += koi.vy * (dt / 16);

  if (!isInWater(koi.x, koi.y, bounds)) {
    // Allow jumping above the surface (looks cool) but not into dirt/walls
    const aboveSurface = koi.y < bounds.waterTop && koi.x > bounds.left + 5 && koi.x < bounds.right - 5;

    if (aboveSurface) {
      // Gravity pulls them back into the water
      koi.vy += 0.08 * (dt / 16);
      // Hard cap: don't fly too high above surface
      if (koi.y < bounds.waterTop - 20) {
        koi.y = bounds.waterTop - 20;
        koi.vy = Math.abs(koi.vy) * 0.5;
      }
    } else {
      // In the dirt/walls — push back hard toward center
      const midY = (bounds.waterTop + bounds.bowlBottom) / 2;
      const toCenterX = bounds.centerX - koi.x;
      const toCenterY = midY - koi.y;
      const toCenterDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
      if (toCenterDist > 0) {
        koi.vx = (toCenterX / toCenterDist) * 1.5;
        koi.vy = (toCenterY / toCenterDist) * 1.5;
      }
      koi.x += koi.vx * 2;
      koi.y += koi.vy * 2;
    }
  }

  // Tail wag driven by speed — slow idle wag + faster when moving
  const fishSpeed = Math.sqrt(koi.vx * koi.vx + koi.vy * koi.vy);
  koi.tailPhase += (0.003 + fishSpeed * 0.08) * (dt / 16);
}

// --- Breeding ---
export interface BreedResult {
  babies: Koi[];
  x: number;
  y: number;
}

export function tryBreed(allFish: Koi[], bounds: PondBounds, t: number): BreedResult | null {
  if (allFish.length >= 20) return null;

  for (let i = 0; i < allFish.length; i++) {
    const a = allFish[i];
    if (!a.alive || a.dead || a.hunger > 0.5 || a.size < 5.3) continue;
    if (t - a.lastBredAt < 20000) continue;

    for (let j = i + 1; j < allFish.length; j++) {
      const b = allFish[j];
      if (!b.alive || b.dead || b.hunger > 0.5 || b.size < 5.3) continue;
      if (b.temperament !== a.temperament) continue;
      if (t - b.lastBredAt < 20000) continue;

      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 15) {
        a.lastBredAt = t;
        b.lastBredAt = t;
        // Face each other
        a.facingRight = a.x < b.x;
        b.facingRight = b.x < a.x;
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;

        const babies: Koi[] = [];
        for (let k = 0; k < 3; k++) {
          const baby = createKoi(bounds, a.temperament, {
            x: midX + (k - 1) * 5,
            y: midY + (Math.random() - 0.5) * 4,
          });
          baby.bornAt = t;
          baby.parentIds = [a.id, b.id];
          babies.push(baby);
        }
        playHeartbeat();
        return { babies, x: midX, y: midY };
      }
    }
  }
  return null;
}

// --- Hearts ---
interface Heart {
  x: number;
  y: number;
  vy: number;
  life: number;
  size: number;
}

const hearts: Heart[] = [];

export function spawnHearts(x: number, y: number) {
  for (let i = 0; i < 3; i++) {
    hearts.push({
      x: x + (Math.random() - 0.5) * 8,
      y,
      vy: -0.3 - Math.random() * 0.4,
      life: 1,
      size: 2 + Math.random() * 2,
    });
  }
}

export function updateHearts(dt: number) {
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.y += h.vy * (dt / 16);
    h.x += Math.sin(h.y * 0.15) * 0.2;
    h.life -= 0.012 * (dt / 16);
    if (h.life <= 0) hearts.splice(i, 1);
  }
}

export function drawHearts(ctx: CanvasRenderingContext2D) {
  for (const h of hearts) {
    ctx.save();
    ctx.globalAlpha = h.life;
    ctx.translate(h.x, h.y);
    ctx.fillStyle = '#FF4060';
    // Draw a tiny pixel heart
    const s = h.size;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.3);
    ctx.bezierCurveTo(-s * 0.5, -s, -s, -s * 0.2, 0, s * 0.5);
    ctx.bezierCurveTo(s, -s * 0.2, s * 0.5, -s, 0, -s * 0.3);
    ctx.fill();
    ctx.restore();
  }
}

// --- Drawing ---
export function drawKoi(ctx: CanvasRenderingContext2D, koi: Koi, t: number) {
  ctx.save();
  ctx.translate(koi.x, koi.y);

  const dir = koi.facingRight ? 1 : -1;
  ctx.scale(dir, 1);

  // Dead fish: belly-up and faded
  if (koi.dead) {
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.5;
  }

  const s = koi.size;
  const tailWag = Math.sin(koi.tailPhase) * 0.35;

  // Shadow (skip for dead/floating fish)
  if (!koi.dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.3, s * 0.9, s * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tail
  ctx.fillStyle = koi.accentColor;
  ctx.beginPath();
  ctx.moveTo(-s * 0.7, 0);
  ctx.lineTo(-s * 1.3, -s * 0.4 + tailWag * s);
  ctx.lineTo(-s * 1.3, s * 0.4 + tailWag * s);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.fillStyle = koi.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // Accent patches
  ctx.fillStyle = koi.accentColor;
  ctx.beginPath();
  ctx.ellipse(s * 0.15, -s * 0.08, s * 0.22, s * 0.12, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-s * 0.2, s * 0.06, s * 0.18, s * 0.1, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = koi.color;
  ctx.beginPath();
  ctx.ellipse(s * 0.55, 0, s * 0.35, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye
  if (koi.dead) {
    // X eyes
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    const ex = s * 0.65, ey = -s * 0.1, er = s * 0.06;
    ctx.beginPath(); ctx.moveTo(ex - er, ey - er); ctx.lineTo(ex + er, ey + er); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex + er, ey - er); ctx.lineTo(ex - er, ey + er); ctx.stroke();
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(s * 0.65, -s * 0.1, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(s * 0.68, -s * 0.1, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chomp animation
  if (t < koi.chompUntil && !koi.dead) {
    const chompOpen = Math.sin((t - (koi.chompUntil - 400)) * 0.04) > 0;
    if (chompOpen) {
      ctx.fillStyle = '#2A1A0A';
      ctx.beginPath();
      ctx.moveTo(s * 0.85, 0);
      ctx.lineTo(s * 0.95, -s * 0.12);
      ctx.lineTo(s * 0.95, s * 0.12);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Dorsal fin
  ctx.fillStyle = koi.color;
  ctx.globalAlpha = koi.dead ? 0.35 : 0.7;
  if (koi.temperament === 'aggressive') {
    ctx.beginPath();
    ctx.moveTo(s * 0.15, -s * 0.3);
    ctx.lineTo(s * 0.05, -s * 0.7);
    ctx.lineTo(-s * 0.1, -s * 0.5);
    ctx.lineTo(-s * 0.25, -s * 0.6);
    ctx.lineTo(-s * 0.35, -s * 0.3);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.3);
    ctx.lineTo(-s * 0.1, -s * 0.55);
    ctx.lineTo(-s * 0.3, -s * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  // Pectoral fin
  const finFlap = Math.sin(t * 0.005) * 0.15;
  ctx.beginPath();
  ctx.ellipse(s * 0.15, s * 0.3, s * 0.2, s * 0.08, 0.3 + finFlap, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Golden koi sparkle/shimmer effect
  if (koi.temperament === 'golden' && !koi.dead) {
    ctx.fillStyle = '#FFFFFF';
    const sparkleCount = 4;
    for (let i = 0; i < sparkleCount; i++) {
      const phase = t * 0.005 + i * 1.7;
      const alpha = Math.max(0, Math.sin(phase));
      if (alpha > 0.3) {
        ctx.globalAlpha = alpha * 0.8;
        const sx = (Math.sin(i * 2.3) * s * 0.7);
        const sy = (Math.cos(i * 3.1) * s * 0.25);
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
