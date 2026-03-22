import { drawPond, drawDecorations, getPondBounds, getHidingSpots } from './pond.ts';
import { createKoi, updateKoi, drawKoi, tryBreed, spawnHearts, updateHearts, drawHearts, type Temperament } from './koi.ts';
import { spawnBubblesRandomly, updateBubbles, drawBubbles } from './bubbles.ts';
import { dropPellet, updatePellets, drawPellets, getPellets } from './food.ts';
import { updateSplashes, drawSplashes } from './splash.ts';
import { createTurtle, updateTurtle, drawTurtle, updateBoneParticles, drawBoneParticles } from './turtle.ts';
import { createFishingState, startCharge, releaseCharge, reelIn, reelClick, updateFishing, drawDock, drawFisherman, drawFishing, drawScore } from './fishing.ts';
import { createTreasureChest, respawnChest, drawTreasureChest } from './treasure.ts';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Pixel art: render at low res, CSS scales it up to fill the screen
const PIXEL_SCALE = 3;
let W = Math.ceil(window.innerWidth / PIXEL_SCALE);
let H = Math.ceil(window.innerHeight / PIXEL_SCALE);

function resize() {
  W = Math.ceil(window.innerWidth / PIXEL_SCALE);
  H = Math.ceil(window.innerHeight / PIXEL_SCALE);
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}

resize();
window.addEventListener('resize', resize);

let bounds = getPondBounds(W, H);
const fishingState = createFishingState();

// Mouse down: start charging cast (above water) or prepare to drop food (in water)
let mouseDownY = 0;
let mouseDownX = 0;
let mouseIsDown = false;

canvas.addEventListener('mousedown', (e) => {
  const x = e.clientX / PIXEL_SCALE;
  const y = e.clientY / PIXEL_SCALE;
  mouseDownX = x;
  mouseDownY = y;
  mouseIsDown = true;

  if (fishingState.reeling) {
    // Tug-of-war — each click reels in
    reelClick(fishingState, lastTime, chest);
  } else if (fishingState.active || fishingState.catching) {
    // Line is out — reel in on click
    reelIn(fishingState, lastTime, chest);
  } else if (y < bounds.waterTop + 5) {
    // Above water — start charging a cast
    startCharge(fishingState, lastTime);
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (!mouseIsDown) return;
  mouseIsDown = false;

  const y = e.clientY / PIXEL_SCALE;

  if (fishingState.charging) {
    // Release the cast
    releaseCharge(fishingState, bounds, lastTime, W, H);
  } else if (y >= bounds.waterTop && !fishingState.active) {
    // Clicked in the water — drop food
    dropPellet(mouseDownX, mouseDownY, bounds);
  }
});

canvas.addEventListener('mouseleave', () => {
  if (fishingState.charging) {
    fishingState.charging = false;
  }
  mouseIsDown = false;
});

// Right click to spawn a fish — cycles through temperaments
const temperaments: Temperament[] = ['aggressive', 'neutral', 'shy'];
let nextTemp = 0;

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const temp = temperaments[nextTemp % temperaments.length];
  nextTemp++;
  fish.push(createKoi(bounds, temp));
});

// Start with 5-10 random fish
const fishCount = 5 + Math.floor(Math.random() * 6);
const fish = Array.from({ length: fishCount }, () => createKoi(bounds));

// One turtle
const turtle = createTurtle(bounds);

// Treasure chest
const chest = createTreasureChest(bounds);

let lastTime = 0;

function loop(t: number) {
  const dt = lastTime ? Math.min(t - lastTime, 50) : 16;
  lastTime = t;

  bounds = getPondBounds(W, H);
  const hidingSpots = getHidingSpots(W, H);

  ctx.clearRect(0, 0, W, H);

  // Respawn chest if needed
  if (!chest.visible && chest.respawnAfter > 0 && t > chest.respawnAfter) {
    respawnChest(chest, bounds);
  }

  drawPond(ctx, W, H, t);
  drawDock(ctx, W, H);         // dock behind decorations/fish
  drawDecorations(ctx, W, H, t);
  drawTreasureChest(ctx, chest, t);

  spawnBubblesRandomly(bounds, t);
  updateBubbles(dt, bounds);
  updatePellets(dt, bounds);
  updateSplashes(dt);

  // Remove fully dead fish
  for (let i = fish.length - 1; i >= 0; i--) {
    if (!fish[i].alive) fish.splice(i, 1);
  }

  // Breeding
  const breedResult = tryBreed(fish, bounds, t);
  if (breedResult) {
    fish.push(...breedResult.babies);
    spawnHearts(breedResult.x, breedResult.y);
  }
  updateHearts(dt);

  const pellets = getPellets();
  for (const koi of fish) {
    updateKoi(koi, bounds, t, dt, pellets, fish, hidingSpots);
  }

  updateTurtle(turtle, bounds, t, dt, fish);
  updateBoneParticles(dt);
  updateFishing(fishingState, bounds, t, dt, fish, turtle, W, H, chest);

  for (const koi of fish) {
    drawKoi(ctx, koi, t);
  }
  drawTurtle(ctx, turtle, t);
  drawBoneParticles(ctx);

  drawPellets(ctx);
  drawBubbles(ctx);
  drawSplashes(ctx);
  drawHearts(ctx);
  drawFishing(ctx, fishingState, t);
  drawFisherman(ctx, fishingState, W, H, t);  // fisherman on top of everything
  drawScore(ctx, fishingState);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
