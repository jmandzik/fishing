// Fishing mechanic: fisherman on dock, hold to charge cast, click to reel

import type { PondBounds } from './pond.ts';
import { getPondBounds, getBowlFloorY } from './pond.ts';
import type { TreasureChest } from './treasure.ts';
import type { Koi } from './koi.ts';
import type { Turtle } from './turtle.ts';
import { spawnSplash } from './splash.ts';

export interface FishingState {
  // Fisherman position (computed from bounds)
  rodTipX: number;
  rodTipY: number;

  // Charge
  charging: boolean;
  chargeStart: number;

  // Cast animation
  casting: boolean;       // rod swing + bobber flight
  castAnimStart: number;
  castPower: number;      // 0-1, stored when released
  castTargetX: number;    // where bobber will land
  castTargetY: number;
  rodAngle: number;       // current rod angle for animation

  // Line state
  active: boolean;
  bobberX: number;
  bobberY: number;
  hookX: number;
  hookY: number;
  castTime: number;

  // Bite state
  nibbling: Koi | null;
  nibbleStart: number;
  biting: boolean;
  biteStart: number;
  bobberDip: number;

  // Reeling tug-of-war
  reeling: boolean;
  reelingFish: Koi | null;
  tension: number;          // 0-1, too high = snap, too low = escape
  reelProgress: number;     // 0-1, fill to 1 to land the fish
  reelClicks: number;       // clicks needed scales with fish size
  reelClicksNeeded: number;
  reelingStartTime: number;
  lineBroke: boolean;
  brokeTime: number;

  // Catch state
  catching: boolean;
  catchStartTime: number;
  caughtFish: Koi | null;
  catchAnimX: number;
  catchAnimY: number;

  // Turtle stealing
  turtleStealing: boolean;
  stealTime: number;

  // Chest reeling
  reelingChest: boolean;
  caughtChest: boolean;     // for catch animation

  // Score
  totalCaught: number;
  biggestSize: number;
  totalCoins: number;

  // Cooldown
  canCastAfter: number;
}

export function createFishingState(): FishingState {
  return {
    rodTipX: 0,
    rodTipY: 0,
    charging: false,
    chargeStart: 0,
    casting: false,
    castAnimStart: 0,
    castPower: 0,
    castTargetX: 0,
    castTargetY: 0,
    rodAngle: 0,
    active: false,
    bobberX: 0,
    bobberY: 0,
    hookX: 0,
    hookY: 0,
    castTime: 0,
    nibbling: null,
    nibbleStart: 0,
    biting: false,
    biteStart: 0,
    bobberDip: 0,
    reeling: false,
    reelingFish: null,
    tension: 0.3,
    reelProgress: 0,
    reelClicks: 0,
    reelClicksNeeded: 0,
    reelingStartTime: 0,
    lineBroke: false,
    brokeTime: 0,
    catching: false,
    catchStartTime: 0,
    caughtFish: null,
    catchAnimX: 0,
    catchAnimY: 0,
    turtleStealing: false,
    stealTime: 0,
    reelingChest: false,
    caughtChest: false,
    canCastAfter: 0,
    totalCaught: 0,
    biggestSize: 0,
    totalCoins: 0,
  };
}

// Fisherman sits on dock at right side of pond
function getFishermanPos(w: number, h: number) {
  const b = getPondBounds(w, h);
  const dockY = b.waterTop - 3;
  const seatX = b.right + 8;
  return {
    seatX,
    dockY,
    rodTipX: seatX - 25,          // rod extends left over the water
    rodTipY: dockY - 18,          // rod tip is up high
    dockLeft: b.right - 8,
    dockRight: seatX + 12,
  };
}

export function startCharge(state: FishingState, t: number) {
  if (state.active || state.catching || state.casting || t < state.canCastAfter) return;
  state.charging = true;
  state.chargeStart = t;
}

export function releaseCharge(state: FishingState, bounds: PondBounds, t: number, w: number, h: number) {
  if (!state.charging) return;
  state.charging = false;

  const pos = getFishermanPos(w, h);
  const chargeDuration = Math.min(t - state.chargeStart, 2000);
  const power = chargeDuration / 2000;

  const minX = bounds.right - 25;
  const maxX = bounds.left + 20;
  const bobberX = minX - power * (minX - maxX);

  // Start cast animation instead of immediately activating
  state.casting = true;
  state.castAnimStart = t;
  state.castPower = power;
  state.castTargetX = bobberX;
  state.castTargetY = bounds.waterTop;
  state.rodTipX = pos.rodTipX;
  state.rodTipY = pos.rodTipY;
  state.rodAngle = 0;
}

export function reelIn(state: FishingState, t: number, chest?: TreasureChest) {
  if (!state.active) return;

  // Check if hook is on the chest
  if (chest && chest.visible && chest.hooked) {
    state.reeling = true;
    state.reelingChest = true;
    state.reelingFish = null;
    state.tension = 0.5;
    state.reelProgress = 0;
    state.reelClicks = 0;
    state.reelClicksNeeded = 18; // heavy!
    state.reelingStartTime = t;
    state.lineBroke = false;
    state.active = false;
    return;
  }

  if (state.biting && state.nibbling) {
    // Start tug-of-war with fish!
    state.reeling = true;
    state.reelingChest = false;
    state.reelingFish = state.nibbling;
    state.tension = 0.5;
    state.reelProgress = 0;
    state.reelClicks = 0;
    state.reelClicksNeeded = Math.floor(3 + state.nibbling.size * 0.5);
    state.reelingStartTime = t;
    state.lineBroke = false;
    state.active = false;
    state.biting = false;
    state.nibbling = null;
  } else {
    // Nothing biting — just pull line out
    state.active = false;
    state.nibbling = null;
    state.biting = false;
    state.canCastAfter = t + 500;
  }
}

/** Call this each time the player clicks during tug-of-war */
export function reelClick(state: FishingState, t: number, chest?: TreasureChest) {
  if (!state.reeling) return;
  if (!state.reelingFish && !state.reelingChest) return;

  state.reelClicks++;
  state.tension += state.reelingChest ? 0.05 : 0.08; // chest is heavier, less tension per click
  state.reelProgress = state.reelClicks / state.reelClicksNeeded;

  if (state.reelProgress >= 1) {
    state.reeling = false;
    state.catching = true;
    state.catchStartTime = t;
    state.catchAnimX = state.hookX;
    state.catchAnimY = state.hookY;

    if (state.reelingChest && chest) {
      // Landed the chest!
      state.caughtChest = true;
      state.caughtFish = null;
      state.totalCoins += chest.coins;
      chest.visible = false;
      chest.hooked = false;
      chest.respawnAfter = t + 30000 + Math.random() * 30000;
      spawnSplash(state.bobberX, state.bobberY);
    } else if (state.reelingFish) {
      // Landed a fish!
      state.caughtChest = false;
      state.caughtFish = state.reelingFish;
      state.caughtFish.alive = false;
      state.totalCaught++;
      if (state.caughtFish.size > state.biggestSize) {
        state.biggestSize = state.caughtFish.size;
      }
      spawnSplash(state.bobberX, state.bobberY);
    }
    state.reelingFish = null;
    state.reelingChest = false;
  }
}

// Cast animation durations
const ROD_SWING_MS = 350;   // rod swings back then forward
const BOBBER_FLY_MS = 400;  // bobber arcs through the air
const CAST_TOTAL_MS = ROD_SWING_MS + BOBBER_FLY_MS;

export function updateFishing(state: FishingState, bounds: PondBounds, t: number, dt: number, fish: Koi[], turtle: Turtle, w: number, h: number, chest: TreasureChest) {
  // --- Line broke message ---
  if (state.lineBroke) {
    if (t - state.brokeTime > 1500) {
      state.lineBroke = false;
      state.canCastAfter = t + 500;
    }
    return;
  }

  // --- Tug-of-war reeling (chest) ---
  if (state.reeling && state.reelingChest) {
    // Chest is dead weight — constant slow tension drain
    state.tension -= 0.001 * (dt / 16);

    // Hook rises toward surface as you reel
    const surfaceY = bounds.waterTop + 5;
    state.hookY = state.hookY + (surfaceY - state.hookY) * state.reelProgress * 0.02 * (dt / 16);

    state.bobberDip = Math.sin(t * 0.02) * 1.5;

    // Line snaps (clicked too fast)
    if (state.tension >= 1) {
      state.reeling = false;
      state.reelingChest = false;
      if (chest) chest.hooked = false;
      state.lineBroke = true;
      state.brokeTime = t;
      state.bobberDip = 0;
      return;
    }

    // Chest can't escape — tension just clamps at 0
    if (state.tension < 0.05) state.tension = 0.05;
    return;
  }

  // --- Tug-of-war reeling (fish) ---
  if (state.reeling && state.reelingFish) {
    // Hook rises toward surface as you reel
    const surfaceY = bounds.waterTop + 5;
    state.hookY = state.hookY + (surfaceY - state.hookY) * state.reelProgress * 0.03 * (dt / 16);

    // Tension decays slowly (line relaxes over time)
    state.tension -= 0.0008 * (dt / 16);

    // Fish fights back — gentle constant pull
    const fishStrength = state.reelingFish.size * 0.0003;
    state.tension -= fishStrength * (dt / 16);

    // Random sharp tugs from the fish (less frequent, less harsh)
    if (Math.random() < 0.008 * (dt / 16)) {
      state.tension -= 0.03 + state.reelingFish.size * 0.002;
    }

    // Bobber shakes while fighting
    state.bobberDip = Math.sin(t * 0.025) * 2 + Math.sin(t * 0.06) * 1;

    // Line snaps!
    if (state.tension >= 1) {
      state.reeling = false;
      state.reelingFish = null;
      state.lineBroke = true;
      state.brokeTime = t;
      state.bobberDip = 0;
      return;
    }

    // Fish escapes (tension too low = slack line)
    if (state.tension <= 0) {
      state.reeling = false;
      state.reelingFish = null;
      state.canCastAfter = t + 1000;
      state.bobberDip = 0;
      return;
    }

    // Fish died while fighting (eaten by turtle etc.)
    if (!state.reelingFish.alive) {
      state.reeling = false;
      state.reelingFish = null;
      state.canCastAfter = t + 500;
      state.bobberDip = 0;
      return;
    }
    return;
  }

  // --- Cast animation ---
  if (state.casting) {
    const elapsed = t - state.castAnimStart;

    if (elapsed < ROD_SWING_MS) {
      // Phase 1: rod swings back then snaps forward
      const swingProg = elapsed / ROD_SWING_MS;
      if (swingProg < 0.4) {
        // Swing back (rod tilts right/back)
        state.rodAngle = (swingProg / 0.4) * 0.6;
      } else {
        // Snap forward (rod tilts left/forward)
        const forwardProg = (swingProg - 0.4) / 0.6;
        state.rodAngle = 0.6 - forwardProg * 1.2;
      }
    } else if (elapsed < CAST_TOTAL_MS) {
      // Phase 2: bobber flies through the air
      state.rodAngle = -0.6; // rod stays forward
      const flyProg = (elapsed - ROD_SWING_MS) / BOBBER_FLY_MS;
      const pos = getFishermanPos(w, h);
      // Bobber arcs from rod tip to target
      state.bobberX = pos.rodTipX + (state.castTargetX - pos.rodTipX) * flyProg;
      state.bobberY = pos.rodTipY + (state.castTargetY - pos.rodTipY) * flyProg
        - Math.sin(flyProg * Math.PI) * (30 + state.castPower * 20);
    } else {
      // Animation done — activate the line
      state.casting = false;
      state.rodAngle = 0;
      state.active = true;
      state.bobberX = state.castTargetX;
      state.bobberY = bounds.waterTop;
      state.hookX = state.castTargetX;
      state.hookY = bounds.waterTop + 15 + state.castPower * 20;
      state.castTime = t;
      state.nibbling = null;
      state.biting = false;
      state.turtleStealing = false;
      state.caughtFish = null;

      spawnSplash(state.castTargetX, bounds.waterTop);
    }
    return;
  }

  // Charge: gently wobble rod back
  if (state.charging) {
    const elapsed = Math.min(t - state.chargeStart, 2000);
    state.rodAngle = (elapsed / 2000) * 0.5; // slowly tip back while charging
    return;
  } else if (!state.active && !state.catching) {
    state.rodAngle = 0; // rest position
  }

  // Catch animation — arc toward fisherman
  if (state.catching) {
    const elapsed = t - state.catchStartTime;
    const prog = Math.min(elapsed / 800, 1);
    const startX = state.bobberX;
    const startY = state.hookY;
    const endX = state.rodTipX;
    const endY = state.rodTipY;
    state.catchAnimX = startX + (endX - startX) * prog;
    state.catchAnimY = startY + (endY - startY) * prog - Math.sin(prog * Math.PI) * 40;

    if (prog >= 1) {
      state.catching = false;
      state.caughtFish = null;
      state.caughtChest = false;
      state.canCastAfter = t + 1000;
    }
    return;
  }

  if (!state.active) return;

  // --- Hook slowly sinks toward the floor ---
  if (!state.nibbling && !state.biting && !state.turtleStealing) {
    const floorY = getBowlFloorY(state.hookX, bounds) - 3;
    if (state.hookY < floorY) {
      state.hookY += 0.15 * (dt / 16);
    }
  }

  // --- Check if hook reached the treasure chest ---
  if (chest.visible && !chest.hooked) {
    const d = Math.hypot(state.hookX - chest.x, state.hookY - chest.y);
    if (d < 10) {
      chest.hooked = true;
      // Show bobber dip to indicate something grabbed
      state.bobberDip = 4;
    }
  }

  state.bobberY = bounds.waterTop + Math.sin(t * 0.005) * 0.5;

  // Turtle steal
  if (!state.turtleStealing && !state.biting && t - state.castTime > 3000) {
    const tDist = Math.hypot(turtle.x - state.hookX, turtle.y - state.hookY);
    if (tDist < 20 && Math.random() < 0.005 * (dt / 16)) {
      state.turtleStealing = true;
      state.stealTime = t;
    }
  }

  if (state.turtleStealing) {
    if (t - state.stealTime > 1000) {
      state.active = false;
      state.turtleStealing = false;
      state.nibbling = null;
      state.canCastAfter = t + 2000;
    }
    state.bobberDip = Math.sin(t * 0.03) * 2;
    return;
  }

  // Fish near hook
  if (!state.nibbling && !state.biting) {
    for (const f of fish) {
      if (!f.alive || f.dead) continue;
      const d = Math.hypot(f.x - state.hookX, f.y - state.hookY);
      if (d < 15) {
        state.nibbling = f;
        state.nibbleStart = t;
        break;
      }
    }
  }

  // Nibble -> Bite
  if (state.nibbling && !state.biting) {
    const nibbleDuration = 1500 + Math.random() * 500;
    if (!state.nibbling.alive || state.nibbling.dead) {
      state.nibbling = null;
    } else if (t - state.nibbleStart > nibbleDuration) {
      state.biting = true;
      state.biteStart = t;
    }
    state.bobberDip = Math.sin(t * 0.02) * 1.5;
  }

  if (state.biting) {
    state.bobberDip = 3 + Math.sin(t * 0.04) * 1;
    if (t - state.biteStart > 2000) {
      state.biting = false;
      state.nibbling = null;
      state.bobberDip = 0;
      state.canCastAfter = 0;
    }
  }

  if (!state.nibbling && !state.biting) {
    state.bobberDip = 0;
  }

  // Attract nearby hungry fish
  for (const f of fish) {
    if (!f.alive || f.dead) continue;
    const d = Math.hypot(f.x - state.hookX, f.y - state.hookY);
    if (d < 40 && d > 5 && f.hunger > 0.3) {
      f.targetX = state.hookX;
      f.targetY = state.hookY;
    }
  }
}

// --- Drawing ---

export function drawDock(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const pos = getFishermanPos(w, h);
  const b = getPondBounds(w, h);
  const dockW = pos.dockRight - pos.dockLeft;

  // Dock support posts — darker, thicker
  ctx.fillStyle = '#4A3018';
  ctx.fillRect(pos.dockLeft + 5, pos.dockY, 4, b.waterTop + 14 - pos.dockY);
  ctx.fillRect(pos.dockRight - 9, pos.dockY, 4, b.waterTop + 10 - pos.dockY);
  // Post highlights
  ctx.fillStyle = '#5A4020';
  ctx.fillRect(pos.dockLeft + 5, pos.dockY, 1, b.waterTop + 14 - pos.dockY);
  ctx.fillRect(pos.dockRight - 9, pos.dockY, 1, b.waterTop + 10 - pos.dockY);

  // Cross beam under planks
  ctx.fillStyle = '#4A3018';
  ctx.fillRect(pos.dockLeft + 3, pos.dockY + 1, dockW - 6, 2);

  // Dock planks — thicker, lighter wood
  ctx.fillStyle = '#A07820';
  ctx.fillRect(pos.dockLeft, pos.dockY - 3, dockW, 5);

  // Individual plank lines
  ctx.strokeStyle = '#7A5A14';
  ctx.lineWidth = 0.7;
  for (let x = pos.dockLeft + 6; x < pos.dockRight; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, pos.dockY - 3);
    ctx.lineTo(x, pos.dockY + 2);
    ctx.stroke();
  }

  // Top edge highlight
  ctx.fillStyle = '#B89030';
  ctx.fillRect(pos.dockLeft, pos.dockY - 3, dockW, 1);

  // Bottom shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(pos.dockLeft, pos.dockY + 2, dockW, 1);

  // Side edge (left end of dock)
  ctx.fillStyle = '#8A6818';
  ctx.fillRect(pos.dockLeft - 1, pos.dockY - 3, 2, 5);
}

export function drawFisherman(ctx: CanvasRenderingContext2D, state: FishingState, w: number, h: number, t: number) {
  const pos = getFishermanPos(w, h);

  // Fisherman sits on the dock edge, facing left
  const fx = pos.seatX;
  const fy = pos.dockY - 2;

  // --- Legs (dangling off dock) ---
  ctx.fillStyle = '#4A5A3A'; // pants
  ctx.fillRect(fx - 3, fy, 3, 7);
  ctx.fillRect(fx + 1, fy, 3, 6);
  // Shoes
  ctx.fillStyle = '#3A2A1A';
  ctx.fillRect(fx - 4, fy + 7, 4, 2);
  ctx.fillRect(fx, fy + 6, 4, 2);

  // --- Body ---
  ctx.fillStyle = '#4466AA'; // blue shirt
  ctx.fillRect(fx - 3, fy - 8, 7, 8);

  // --- Arms ---
  // Back arm (holding rod)
  ctx.fillStyle = '#DDAA77'; // skin
  ctx.fillRect(fx - 5, fy - 7, 3, 2);
  // Front arm resting
  ctx.fillStyle = '#DDAA77';
  ctx.fillRect(fx + 4, fy - 5, 2, 3);

  // --- Head ---
  ctx.fillStyle = '#DDAA77';
  ctx.fillRect(fx - 1, fy - 13, 5, 5);

  // Eye
  ctx.fillStyle = '#111111';
  ctx.fillRect(fx - 1, fy - 11, 1, 1);

  // --- Hat ---
  ctx.fillStyle = '#886633';
  ctx.fillRect(fx - 3, fy - 15, 8, 2); // brim
  ctx.fillRect(fx - 1, fy - 17, 5, 2); // top

  // --- Fishing Rod (rotates with rodAngle) ---
  const handX = fx - 5;
  const handY = fy - 6;
  const rodLen = 30;
  const baseAngle = -2.2; // default: pointing up-left
  const angle = baseAngle + state.rodAngle;

  // Rod tip position based on angle
  const tipX = handX + Math.cos(angle) * rodLen;
  const tipY = handY + Math.sin(angle) * rodLen;

  // Rod handle (short, opposite direction)
  ctx.strokeStyle = '#3A2A10';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.lineTo(handX - Math.cos(angle) * 5, handY - Math.sin(angle) * 5);
  ctx.stroke();

  // Rod shaft
  ctx.strokeStyle = '#5A4020';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Rod tip (thinner)
  ctx.strokeStyle = '#7A6040';
  ctx.lineWidth = 0.6;
  const tipExtX = tipX + Math.cos(angle) * 6;
  const tipExtY = tipY + Math.sin(angle) * 6;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipExtX, tipExtY);
  ctx.stroke();

  // --- Power bar (when charging) ---
  if (state.charging) {
    const elapsed = Math.min(t - state.chargeStart, 2000);
    const power = elapsed / 2000;
    const barH = 16;
    const barX = fx + 10;
    const barY = fy - 17;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, 4, barH);

    const fillH = barH * power;
    if (power < 0.5) {
      ctx.fillStyle = '#44CC44';
    } else if (power < 0.8) {
      ctx.fillStyle = '#CCCC44';
    } else {
      ctx.fillStyle = '#CC4444';
    }
    ctx.fillRect(barX, barY + barH - fillH, 4, fillH);

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, 4, barH);
  }

  // --- Cast animation: bobber flying through the air ---
  if (state.casting) {
    const elapsed = t - state.castAnimStart;
    if (elapsed >= ROD_SWING_MS) {
      // Draw the bobber mid-flight
      ctx.fillStyle = '#FF3030';
      ctx.beginPath();
      ctx.arc(state.bobberX, state.bobberY, 2, 0, Math.PI * 2);
      ctx.fill();

      // Line from rod tip to flying bobber
      ctx.strokeStyle = '#888888';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(tipExtX, tipExtY);
      ctx.quadraticCurveTo(
        (tipExtX + state.bobberX) / 2, Math.min(tipExtY, state.bobberY) - 10,
        state.bobberX, state.bobberY,
      );
      ctx.stroke();
    }
  }

  // --- Fishing line during tug-of-war ---
  if (state.reeling) {
    const bobberY = state.bobberY + state.bobberDip;

    // Taut line from rod tip to bobber
    ctx.strokeStyle = state.tension > 0.7 ? '#CC4444' : '#888888';
    ctx.lineWidth = state.tension > 0.7 ? 0.8 : 0.5;
    ctx.beginPath();
    ctx.moveTo(tipExtX, tipExtY);
    ctx.quadraticCurveTo(
      (tipExtX + state.bobberX) / 2, tipExtY + 3 - state.tension * 5,
      state.bobberX, bobberY,
    );
    ctx.stroke();
  }

  // --- Fishing line from rod tip to bobber (when active) ---
  if (state.active || state.catching) {
    const bobberY = state.bobberY + state.bobberDip;

    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(tipExtX, tipExtY);
    ctx.quadraticCurveTo(
      (tipExtX + state.bobberX) / 2, tipExtY + 5,
      state.bobberX, bobberY,
    );
    ctx.stroke();
  }
}

export function drawFishing(ctx: CanvasRenderingContext2D, state: FishingState, t: number) {
  // --- Tug-of-war UI ---
  if (state.reeling) {
    const bobberY = state.bobberY + state.bobberDip;

    // Line from bobber down to hook (shows depth)
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(state.bobberX, bobberY + 2);
    ctx.lineTo(state.hookX, state.hookY);
    ctx.stroke();

    // Bobber bouncing
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(state.bobberX, bobberY - 1.5, 3, 2, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FF3030';
    ctx.beginPath();
    ctx.ellipse(state.bobberX, bobberY - 1.5, 3, 2, 0, 0, Math.PI);
    ctx.fill();

    // "CLICK!" prompt
    const flash = Math.sin(t * 0.012) > 0;
    if (flash) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '6px monospace';
      ctx.fillText('CLICK!', state.bobberX - 10, bobberY - 10);
    }

    // Tension bar (horizontal, above the bobber)
    const barW = 40;
    const barH = 5;
    const barX = state.bobberX - barW / 2;
    const barY = bobberY - 22;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);

    // Tension fill — green in the middle, red at extremes
    const tensionFill = state.tension * barW;
    let tensionColor: string;
    if (state.tension < 0.2) {
      tensionColor = '#4488FF'; // too low — blue/slack
    } else if (state.tension < 0.7) {
      tensionColor = '#44CC44'; // good — green
    } else if (state.tension < 0.85) {
      tensionColor = '#CCCC44'; // getting tight — yellow
    } else {
      tensionColor = '#CC4444'; // about to snap — red
    }
    ctx.fillStyle = tensionColor;
    ctx.fillRect(barX, barY, tensionFill, barH);

    // Danger zones
    ctx.fillStyle = 'rgba(255,0,0,0.3)';
    ctx.fillRect(barX + barW * 0.85, barY, barW * 0.15, barH); // snap zone
    ctx.fillStyle = 'rgba(0,100,255,0.3)';
    ctx.fillRect(barX, barY, barW * 0.15, barH); // escape zone

    // Border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barW, barH);

    // Progress bar (how close to landing)
    const progBarY = barY + barH + 2;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(barX, progBarY, barW, 3);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(barX, progBarY, barW * Math.min(state.reelProgress, 1), 3);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.3;
    ctx.strokeRect(barX, progBarY, barW, 3);
  }

  // --- Line broke message ---
  if (state.lineBroke) {
    ctx.fillStyle = '#FF4444';
    ctx.font = '8px monospace';
    ctx.fillText('SNAP!', state.bobberX - 10, state.bobberY - 15);
  }

  // Catch animation
  if (state.catching) {
    ctx.save();
    ctx.translate(state.catchAnimX, state.catchAnimY);
    const prog = Math.min((t - state.catchStartTime) / 800, 1);

    if (state.caughtChest) {
      // Chest flying up
      ctx.rotate(prog * 0.3);
      ctx.fillStyle = '#6B3A1A';
      ctx.fillRect(-6, -4, 12, 7);
      ctx.fillStyle = '#7A4A2A';
      ctx.fillRect(-6, -6, 12, 3);
      ctx.fillStyle = '#D4A830';
      ctx.fillRect(-1, -5, 2, 3);
      // Sparkles
      ctx.fillStyle = `rgba(255,215,0,${0.8 - prog * 0.6})`;
      ctx.beginPath();
      ctx.arc(8, -6, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-7, -3, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (state.caughtFish) {
      // Fish flying up
      ctx.rotate(prog * Math.PI * 0.5);
      const f = state.caughtFish;
      const s = f.size;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = f.accentColor;
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, 0);
      ctx.lineTo(-s * 1.2, -s * 0.3);
      ctx.lineTo(-s * 1.2, s * 0.3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  if (!state.active) return;

  const bobberY = state.bobberY + state.bobberDip;

  // Line from bobber to hook
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(state.bobberX, bobberY + 2);
  ctx.lineTo(state.hookX, state.hookY);
  ctx.stroke();

  // Bobber
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(state.bobberX, bobberY - 1.5, 3, 2, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FF3030';
  ctx.beginPath();
  ctx.ellipse(state.bobberX, bobberY - 1.5, 3, 2, 0, 0, Math.PI);
  ctx.fill();
  // Bobber stick
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(state.bobberX, bobberY - 3.5);
  ctx.lineTo(state.bobberX, bobberY - 6);
  ctx.stroke();

  // Hook
  ctx.strokeStyle = '#AAAAAA';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(state.hookX, state.hookY, 2, 0, Math.PI * 1.5);
  ctx.stroke();
  ctx.fillStyle = '#AAAAAA';
  ctx.beginPath();
  ctx.arc(state.hookX + 2, state.hookY, 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Bait — wriggly worm on the hook
  if (!state.turtleStealing) {
    const wx = state.hookX;
    const wy = state.hookY + 2;
    const wg1 = Math.sin(t * 0.006) * 2;
    const wg2 = Math.sin(t * 0.008 + 1) * 1.5;

    ctx.strokeStyle = '#E08090';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + wg1, wy + 3, wx + wg2, wy + 6);
    ctx.quadraticCurveTo(wx - wg1 * 0.5, wy + 8, wx + wg1 * 0.3, wy + 10);
    ctx.stroke();

    // Worm head
    ctx.fillStyle = '#D07080';
    ctx.beginPath();
    ctx.arc(wx + wg1 * 0.3, wy + 10, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bite indicator
  if (state.biting) {
    const flash = Math.sin(t * 0.015) > 0;
    if (flash) {
      ctx.fillStyle = '#FFD700';
      ctx.font = '8px monospace';
      ctx.fillText('!', state.bobberX + 5, bobberY - 8);
    }
  }

  // Turtle stealing indicator
  if (state.turtleStealing) {
    ctx.fillStyle = '#FF6600';
    ctx.font = '6px monospace';
    ctx.fillText('?!', state.bobberX + 5, bobberY - 8);
  }
}

export function drawScore(ctx: CanvasRenderingContext2D, state: FishingState) {
  if (state.totalCaught === 0 && state.totalCoins === 0 && !state.active) return;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(4, 4, 56, 24);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '6px monospace';
  ctx.fillText(`Fish: ${state.totalCaught}`, 7, 11);

  ctx.fillStyle = '#FFD700';
  ctx.fillText(`Coins: ${state.totalCoins}`, 7, 19);

  if (state.biggestSize > 0) {
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '5px monospace';
    ctx.fillText(`Best: ${state.biggestSize.toFixed(0)}`, 7, 25);
  }
  ctx.restore();
}
