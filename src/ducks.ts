// Ducks — mother duck with ducklings swimming on the water surface
// Periodically walks onto land on the left side, wanders off-screen, then returns

import { getPondBounds } from './pond.ts';
import { isNighttime } from './daycycle.ts';
import { spawnRipple } from './ripples.ts';
import { spawnSplash } from './splash.ts';

interface Duckling {
  offsetX: number;    // offset behind mother (negative = behind)
  bobPhase: number;
}

type DuckPhase =
  | 'swimming'          // normal water behavior
  | 'walking_to_shore'  // swimming toward left edge
  | 'climbing_out'      // short transition climbing onto land
  | 'walking_offscreen' // walking left on land until off-screen
  | 'offscreen'         // gone for a while
  | 'walking_back'      // walking right on land from off-screen
  | 'jumping_in';       // arc into water with splash

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
  // Land walking state machine
  phase: DuckPhase;
  phaseTimer: number;     // general-purpose timer for current phase
  landY: number;          // y position when on land
  walkCycle: number;      // leg animation phase
  jumpProgress: number;   // 0..1 for jump arc
  jumpStartX: number;
  jumpStartY: number;
  jumpTargetX: number;
  jumpTargetY: number;
  shoreTimer: number;     // time until next shore trip
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
    phase: 'swimming',
    phaseTimer: 0,
    landY: b.waterTop,
    walkCycle: 0,
    jumpProgress: 0,
    jumpStartX: 0,
    jumpStartY: 0,
    jumpTargetX: 0,
    jumpTargetY: 0,
    shoreTimer: 40000 + Math.random() * 30000, // first trip in 40-70s
  };
}

export function updateDucks(dt: number, t: number, w: number, h: number) {
  init(w, h);
  if (!duck) return;

  const b = getPondBounds(w, h);
  const night = isNighttime(t);

  const shoreX = b.left + 8; // where land meets water on the left

  switch (duck.phase) {
    case 'swimming': {
      duck.y = b.waterTop;
      duck.bobPhase += dt * 0.003;

      if (night) {
        duck.speed *= 0.98;
        if (duck.speed < 0.01) duck.speed = 0;
      } else {
        duck.speed = 0.15;

        // Shore trip timer
        duck.shoreTimer -= dt;
        if (duck.shoreTimer <= 0) {
          duck.phase = 'walking_to_shore';
          duck.facingRight = false; // face left toward shore
          duck.speed = 0.2;
          break;
        }

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
      updateDucklingPositions(dt, b.waterTop);
      break;
    }

    case 'walking_to_shore': {
      duck.y = b.waterTop;
      duck.bobPhase += dt * 0.003;
      duck.facingRight = false;
      duck.x -= 0.2 * (dt / 16);

      // Ripples while swimming to shore
      if (t - duck.lastRipple > 1500) {
        spawnRipple(duck.x, duck.y);
        duck.lastRipple = t;
      }

      // Reached the shore
      if (duck.x <= shoreX + 5) {
        duck.x = shoreX + 5;
        duck.phase = 'climbing_out';
        duck.phaseTimer = 500; // half second climb
        duck.landY = b.waterTop;
      }

      updateDucklingPositions(dt, b.waterTop);
      break;
    }

    case 'climbing_out': {
      // Short transition: rise from water level to land level
      duck.phaseTimer -= dt;
      const climbProgress = 1 - Math.max(0, duck.phaseTimer / 500);
      // Rise up a few pixels above waterTop (standing on shore)
      duck.landY = b.waterTop - climbProgress * 4;
      duck.y = duck.landY;
      duck.x -= 0.05 * (dt / 16); // slight leftward drift

      if (duck.phaseTimer <= 0) {
        duck.phase = 'walking_offscreen';
        duck.facingRight = false;
        duck.landY = b.waterTop - 4;
        duck.y = duck.landY;
        duck.walkCycle = 0;
      }

      // Ducklings climb too
      for (let i = 0; i < duck.ducklings.length; i++) {
        const pos = duck.ducklingPositions[i];
        const targetX = duck.x + (8 + i * 6); // behind mother (she's facing left)
        pos.x += (targetX - pos.x) * 0.03 * (dt / 16);
        pos.y += (duck.y - pos.y) * 0.03 * (dt / 16);
      }
      break;
    }

    case 'walking_offscreen': {
      duck.y = duck.landY;
      duck.facingRight = false;
      duck.walkCycle += dt * 0.008;
      duck.x -= 0.25 * (dt / 16);

      // Ducklings follow on land
      for (let i = 0; i < duck.ducklings.length; i++) {
        const pos = duck.ducklingPositions[i];
        const targetX = duck.x + (8 + i * 6);
        pos.x += (targetX - pos.x) * 0.025 * (dt / 16);
        pos.y += (duck.landY - pos.y) * 0.05 * (dt / 16);
      }

      // All off-screen? (mother + last duckling)
      const lastDucklingPos = duck.ducklingPositions[duck.ducklings.length - 1];
      if (duck.x < -10 && lastDucklingPos.x < -5) {
        duck.phase = 'offscreen';
        duck.phaseTimer = 15000 + Math.random() * 20000; // gone 15-35s
      }
      break;
    }

    case 'offscreen': {
      duck.phaseTimer -= dt;
      if (duck.phaseTimer <= 0) {
        // Time to come back
        duck.phase = 'walking_back';
        duck.x = -10;
        duck.landY = b.waterTop - 4;
        duck.y = duck.landY;
        duck.facingRight = true;
        duck.walkCycle = 0;
        // Reset duckling positions off-screen
        for (let i = 0; i < duck.ducklings.length; i++) {
          duck.ducklingPositions[i].x = -10 - (8 + i * 6);
          duck.ducklingPositions[i].y = duck.landY;
        }
      }
      break;
    }

    case 'walking_back': {
      duck.y = duck.landY;
      duck.facingRight = true;
      duck.walkCycle += dt * 0.008;
      duck.x += 0.25 * (dt / 16);

      // Ducklings follow on land
      for (let i = 0; i < duck.ducklings.length; i++) {
        const pos = duck.ducklingPositions[i];
        const targetX = duck.x - (8 + i * 6); // behind mother (she's facing right)
        pos.x += (targetX - pos.x) * 0.025 * (dt / 16);
        pos.y += (duck.landY - pos.y) * 0.05 * (dt / 16);
      }

      // Reached the shore edge — time to jump in
      if (duck.x >= shoreX + 5) {
        duck.phase = 'jumping_in';
        duck.jumpProgress = 0;
        duck.jumpStartX = duck.x;
        duck.jumpStartY = duck.landY;
        duck.jumpTargetX = duck.x + 15; // land a bit into the water
        duck.jumpTargetY = b.waterTop;
      }
      break;
    }

    case 'jumping_in': {
      duck.jumpProgress += dt * 0.002; // ~500ms jump
      if (duck.jumpProgress >= 1) {
        duck.jumpProgress = 1;
        // Splash!
        spawnSplash(duck.jumpTargetX, duck.jumpTargetY);
        spawnRipple(duck.jumpTargetX, duck.jumpTargetY);

        // Back to swimming
        duck.phase = 'swimming';
        duck.x = duck.jumpTargetX;
        duck.y = b.waterTop;
        duck.facingRight = true;
        duck.speed = 0.15;
        duck.dirTimer = 5000 + Math.random() * 5000;
        duck.shoreTimer = 45000 + Math.random() * 35000; // next trip in 45-80s
        duck.headDipTimer = 10000 + Math.random() * 5000;
        duck.honkTimer = 10000 + Math.random() * 10000;

        // Snap duckling positions to water near mother
        for (let i = 0; i < duck.ducklings.length; i++) {
          duck.ducklingPositions[i].x = duck.x - (8 + i * 6);
          duck.ducklingPositions[i].y = b.waterTop;
        }
      } else {
        // Parabolic arc
        const p = duck.jumpProgress;
        duck.x = duck.jumpStartX + (duck.jumpTargetX - duck.jumpStartX) * p;
        duck.y = duck.jumpStartY + (duck.jumpTargetY - duck.jumpStartY) * p - Math.sin(p * Math.PI) * 8;
      }

      // Ducklings jump in too with slight delay
      for (let i = 0; i < duck.ducklings.length; i++) {
        const pos = duck.ducklingPositions[i];
        const delay = (i + 1) * 0.15;
        const ducklingP = Math.max(0, Math.min(1, (duck.jumpProgress - delay) / (1 - delay)));
        if (ducklingP > 0 && ducklingP < 1) {
          const startX = duck.jumpStartX - (8 + i * 6) * (duck.facingRight ? -1 : 1);
          const targetX = duck.jumpTargetX - (8 + i * 6);
          pos.x = startX + (targetX - startX) * ducklingP;
          pos.y = duck.jumpStartY + (b.waterTop - duck.jumpStartY) * ducklingP - Math.sin(ducklingP * Math.PI) * 5;
        } else if (ducklingP >= 1) {
          pos.y = b.waterTop;
        }
      }
      break;
    }
  }
}

function updateDucklingPositions(dt: number, waterY: number) {
  if (!duck) return;
  const dir = duck.facingRight ? 1 : -1;
  for (let i = 0; i < duck.ducklings.length; i++) {
    const dl = duck.ducklings[i];
    dl.bobPhase += dt * 0.004;
    const targetX = duck.x + dl.offsetX * dir;
    const pos = duck.ducklingPositions[i];
    pos.x += (targetX - pos.x) * 0.02 * (dt / 16);
    pos.y = waterY;
  }
}

/** Returns the mother duck's x position (or null if not initialized) */
export function getDuckX(): number | null {
  return duck ? duck.x : null;
}

export function drawDucks(ctx: CanvasRenderingContext2D, t: number) {
  if (!duck) return;
  if (duck.phase === 'offscreen') return; // nothing to draw

  const night = isNighttime(t);
  const bob = (duck.phase === 'swimming' || duck.phase === 'walking_to_shore')
    ? Math.sin(duck.bobPhase) * 0.5
    : 0;
  const dir = duck.facingRight ? 1 : -1;
  const onLand = duck.phase === 'climbing_out' || duck.phase === 'walking_offscreen' || duck.phase === 'walking_back';
  const jumping = duck.phase === 'jumping_in';

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

  // Head dip animation (only while swimming)
  let headOffY = 0;
  if (duck.headDipping && duck.phase === 'swimming') {
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

  // Legs (visible when on land or jumping)
  if (onLand || jumping) {
    const legSwing = onLand ? Math.sin(duck.walkCycle) * 1.5 : 0;
    ctx.fillStyle = '#E89030';
    // Left leg
    ctx.fillRect(-1 - legSwing, 0, 1, 2.5);
    ctx.fillRect(-2 - legSwing, 2.5, 2, 0.5); // foot
    // Right leg
    ctx.fillRect(1 + legSwing, 0, 1, 2.5);
    ctx.fillRect(0 + legSwing, 2.5, 2, 0.5); // foot
  }

  ctx.restore();

  // Honk bubble (only when swimming)
  if (duck.phase === 'swimming' && t < duck.honkUntil) {
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
    const inWater = duck.phase === 'swimming' || duck.phase === 'walking_to_shore';
    const dlBob = inWater ? Math.sin(dl.bobPhase) * 0.4 : 0;

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

    // Duckling legs on land
    if (onLand || jumping) {
      const legSwing = onLand ? Math.sin(duck.walkCycle + i * 1.2) * 1 : 0;
      ctx.fillStyle = '#E89030';
      ctx.fillRect(-0.5 - legSwing, -0.2, 0.7, 1.5);
      ctx.fillRect(0.5 + legSwing, -0.2, 0.7, 1.5);
    }

    ctx.restore();
  }
}
