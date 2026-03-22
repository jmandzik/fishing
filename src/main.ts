import { drawPond, drawDecorations, getPondBounds, getHidingSpots } from './pond.ts';
import { createKoi, updateKoi, drawKoi, tryBreed, spawnHearts, updateHearts, drawHearts, type Temperament } from './koi.ts';
import { spawnBubblesRandomly, updateBubbles, drawBubbles } from './bubbles.ts';
import { dropPellet, updatePellets, drawPellets, getPellets } from './food.ts';
import { updateSplashes, drawSplashes } from './splash.ts';
import { updateRipples, drawRipples } from './ripples.ts';
import { updateDragonflies, drawDragonflies } from './dragonflies.ts';
import { updateFireflies, drawFireflies } from './daycycle.ts';
import { updateFrogs, drawFrogsSitting, drawFrogsSwimming, clickFrog } from './frogs.ts';
import { createTurtle, updateTurtle, drawTurtle, updateBoneParticles, drawBoneParticles } from './turtle.ts';
import { createSnail, updateSnail, drawSnail } from './snail.ts';
import { createCrayfish, updateCrayfish, drawCrayfish } from './crayfish.ts';
import { createCatfish, updateCatfish, drawCatfish } from './catfish.ts';
import { createHeron, updateHeron, drawHeron, scareHeron } from './heron.ts';
import { createFishingState, startCharge, releaseCharge, reelIn, reelClick, updateFishing, updateFishermanEasterEggs, drawDock, drawFisherman, drawFishing, drawScore } from './fishing.ts';
import { createTreasureChest, respawnChest, updateTreasureChest, drawTreasureChest } from './treasure.ts';
import { createShop, isShopOpen, drawShopButton, drawShop, handleShopClick } from './shop.ts';
import { updateAmbientSounds } from './sounds.ts';
import { isNighttime, adjustDayCycle } from './daycycle.ts';
import { updateWeather, drawWeatherSky, drawWeatherEffects } from './weather.ts';
import { createSettings, isSettingsOpen, drawSettingsButton, drawSettings, handleSettingsClick } from './settings.ts';
import { initAudio, playAmbient } from './sounds.ts';
import { updateButterflies, drawFlowers, drawButterflies } from './butterflies.ts';
import { updateDucks, drawDucks } from './ducks.ts';
import { updateTadpoles, drawTadpoles } from './tadpoles.ts';
import { createBaitState, handleBaitClick, drawBaitToggle } from './bait.ts';
import { createKrakenState, handleDinoEyeClick, updateKraken, drawKraken } from './kraken.ts';

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
const shop = createShop();
const settings = createSettings();
const baitState = createBaitState();
const krakenState = createKrakenState();

// Mouse down: start charging cast (above water) or prepare to drop food (in water)
let mouseDownY = 0;
let mouseDownX = 0;
let mouseIsDown = false;
let clickConsumedByUI = false;

canvas.addEventListener('mousedown', (e) => {
  initAudio();
  playAmbient();

  const x = e.clientX / PIXEL_SCALE;
  const y = e.clientY / PIXEL_SCALE;
  mouseDownX = x;
  mouseDownY = y;
  mouseIsDown = true;
  clickConsumedByUI = false;

  // Settings click takes priority
  if (handleSettingsClick(settings, x, y, W, H)) { clickConsumedByUI = true; return; }

  // Shop click takes priority
  if (handleShopClick(shop, fishingState, x, y, W, H)) { clickConsumedByUI = true; return; }

  // Bait toggle
  if (handleBaitClick(baitState, x, y, W, H)) { clickConsumedByUI = true; return; }

  // Click a sitting frog to make it jump
  if (clickFrog(x, y, W, H, lastTime)) return;

  // Scare heron if it's hovering or diving
  if (heron.state === 'hovering' || heron.state === 'diving') {
    scareHeron(heron, lastTime);
  }

  // Click dino eye socket — kraken easter egg
  if (handleDinoEyeClick(krakenState, x, y, W, H, lastTime, fish, bounds)) { clickConsumedByUI = true; return; }

  // Click on fisherman — easter egg reaction
  const fmPos = getPondBounds(W, H);
  const fishermanX = fmPos.right + 8;
  const fishermanY = fmPos.waterTop - 5;
  if (Math.hypot(x - fishermanX, y - fishermanY) < 15) {
    fishingState.clickReaction = lastTime;
  }

});

canvas.addEventListener('mouseup', (e) => {
  if (!mouseIsDown) return;
  mouseIsDown = false;

  if (clickConsumedByUI) return;

  const y = e.clientY / PIXEL_SCALE;

  if (isShopOpen(shop) || isSettingsOpen(settings)) return;

  if (e.button === 0 && y >= bounds.waterTop) {
    // Left-clicked in the water — drop food (works even while fishing)
    dropPellet(mouseDownX, mouseDownY, bounds);
  }
});

canvas.addEventListener('mouseleave', () => {
  if (fishingState.charging) {
    fishingState.charging = false;
  }
  mouseIsDown = false;
});

// Spacebar: hold to charge cast, release to cast, tap to reel in / click during tug-of-war
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  initAudio();
  playAmbient();

  if (fishingState.reeling) {
    reelClick(fishingState, lastTime, chest, catfish);
  } else if (fishingState.active) {
    reelIn(fishingState, lastTime, chest);
  } else if (!fishingState.charging && !fishingState.casting) {
    startCharge(fishingState, lastTime);
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();

  if (fishingState.charging) {
    releaseCharge(fishingState, bounds, lastTime, W, H);
  }
});

// Right click to spawn a fish — cycles through temperaments
const temperaments: Temperament[] = ['aggressive', 'neutral', 'shy'];
let nextTemp = 0;

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const temp = temperaments[nextTemp % temperaments.length];
  nextTemp++;
  const newFish = createKoi(bounds, temp);
  const fromLeft = Math.random() > 0.5;
  newFish.x = fromLeft ? bounds.left + 5 : bounds.right - 5;
  newFish.y = bounds.waterTop + 10 + Math.random() * 20;
  newFish.vx = fromLeft ? 0.8 : -0.8;
  newFish.facingRight = fromLeft;
  newFish.targetX = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.3;
  newFish.targetY = (bounds.waterTop + bounds.bowlBottom) / 2 + (Math.random() - 0.5) * 30;
  fish.push(newFish);
});

// Start with 5-10 random fish
const fishCount = 5 + Math.floor(Math.random() * 6);
const fish = Array.from({ length: fishCount }, () => createKoi(bounds));

// One turtle
const turtle = createTurtle(bounds);

// One catfish
const catfish = createCatfish(bounds);

// One snail
const snail = createSnail(bounds);

// One crayfish
const crayfish = createCrayfish(bounds);
const crayfish2 = createCrayfish(bounds);

// Heron predator
const heron = createHeron();

// Golden koi spawning tracker
let lastGoldenSpawn = 0;
let lastRestockTime = 0;

// Treasure chest
const chest = createTreasureChest(bounds);

let lastTime = 0;
let paused = false;
let pauseTimeOffset = 0;
let pauseStartedAt = 0;

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    e.preventDefault();
    if (!paused) {
      paused = true;
      pauseStartedAt = performance.now();
    } else {
      paused = false;
      pauseTimeOffset += performance.now() - pauseStartedAt;
    }
  }
  // Arrow keys: advance/rewind day cycle (1 hour = 1/24 of cycle)
  if (e.code === 'ArrowRight') {
    e.preventDefault();
    adjustDayCycle(180_000 / 24); // advance 1 hour
  }
  if (e.code === 'ArrowLeft') {
    e.preventDefault();
    adjustDayCycle(-180_000 / 24); // rewind 1 hour
  }
});

function loop(rawT: number) {
  if (paused) {
    requestAnimationFrame(loop);
    return;
  }

  const t = rawT - pauseTimeOffset;
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
  drawFlowers(ctx, W, H, t);           // flowers on ground near trees
  drawWeatherSky(ctx, W, H, t);
  drawDock(ctx, W, H);         // dock behind decorations/fish
  drawDecorations(ctx, W, H, t);
  updateTreasureChest(chest, dt);
  drawTreasureChest(ctx, chest, t);

  drawFrogsSitting(ctx, t);        // frogs on rocks, behind water

  spawnBubblesRandomly(bounds, t);
  updateBubbles(dt, bounds);
  updatePellets(dt, bounds);
  updateSplashes(dt);
  updateRipples(dt);
  updateDragonflies(dt, t, W, H);
  updateFireflies(dt, t, W, H);
  updateFrogs(dt, t, W, H);
  updateButterflies(dt, t, W, H);
  updateDucks(dt, t, W, H);
  updateTadpoles(dt, t, W, H);

  // Remove fully dead fish
  for (let i = fish.length - 1; i >= 0; i--) {
    if (!fish[i].alive) fish.splice(i, 1);
  }

  // Golden koi spawning: one every 60s, max 2 alive
  if (t - lastGoldenSpawn > 60000) {
    const goldenCount = fish.filter(f => f.alive && !f.dead && f.temperament === 'golden').length;
    if (goldenCount < 2) {
      const golden = createKoi(bounds, 'golden');
      if (chest.visible) {
        // Spawn from behind the treasure chest, aimed toward center
        golden.x = chest.x;
        golden.y = chest.y;
        const toCenterX = bounds.centerX - chest.x;
        const toCenterY = (bounds.waterTop + bounds.bowlBottom) / 2 - chest.y;
        const dist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
        golden.vx = dist > 0 ? (toCenterX / dist) * 1.2 : 0;
        golden.vy = dist > 0 ? (toCenterY / dist) * 0.8 : -0.5;
        golden.facingRight = golden.vx > 0;
      } else {
        // Spawn at pond edge (like restock fish)
        const fromLeft = Math.random() > 0.5;
        golden.x = fromLeft ? bounds.left + 5 : bounds.right - 5;
        golden.y = bounds.waterTop + 10 + Math.random() * 20;
        golden.vx = fromLeft ? 0.8 : -0.8;
        golden.facingRight = fromLeft;
      }
      golden.targetX = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.3;
      golden.targetY = (bounds.waterTop + bounds.bowlBottom) / 2 + (Math.random() - 0.5) * 30;
      fish.push(golden);
      lastGoldenSpawn = t;
    }
  }

  // Minimum population — new fish swim in from the edge
  const aliveFish = fish.filter(f => f.alive && !f.dead).length;
  if (aliveFish < 3 && t - lastRestockTime > 15000) {
    const fromLeft = Math.random() > 0.5;
    const entryX = fromLeft ? bounds.left + 5 : bounds.right - 5;
    const entryY = bounds.waterTop + 10 + Math.random() * 20;
    const newFish = createKoi(bounds);
    newFish.x = entryX;
    newFish.y = entryY;
    newFish.vx = fromLeft ? 0.8 : -0.8;
    newFish.facingRight = fromLeft;
    newFish.targetX = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.3;
    newFish.targetY = (bounds.waterTop + bounds.bowlBottom) / 2 + (Math.random() - 0.5) * 30;
    fish.push(newFish);
    lastRestockTime = t;
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
  updateSnail(snail, bounds, dt, t);
  updateCrayfish(crayfish, bounds, dt, t, fish, turtle);
  updateCrayfish(crayfish2, bounds, dt, t, fish, turtle);
  updateCatfish(catfish, bounds, t, dt, pellets,
    fishingState.hookX, fishingState.hookY, fishingState.active);
  updateHeron(heron, bounds, t, dt, fish);
  updateBoneParticles(dt);
  updateFishing(fishingState, bounds, t, dt, fish, turtle, W, H, chest, catfish, baitState.enabled);
  updateKraken(krakenState, t, dt, bounds);
  updateFishermanEasterEggs(fishingState, bounds, t, dt, W, H);
  updateWeather(dt, t, W, H);

  drawTadpoles(ctx, t);               // tadpoles near bottom, before fish
  drawSnail(ctx, snail, t);
  drawCrayfish(ctx, crayfish, t);
  drawCrayfish(ctx, crayfish2, t);
  for (const koi of fish) {
    drawKoi(ctx, koi, t);
  }
  drawTurtle(ctx, turtle, t);
  drawCatfish(ctx, catfish, t);
  drawBoneParticles(ctx);

  drawKraken(ctx, krakenState, t, bounds);
  drawPellets(ctx);
  drawBubbles(ctx);
  drawSplashes(ctx);
  drawRipples(ctx);
  drawFrogsSwimming(ctx, t);       // frogs in water, after fish
  drawDucks(ctx, t);                  // ducks on water surface
  drawDragonflies(ctx, t);         // dragonflies above water
  drawButterflies(ctx, t);         // butterflies near trees
  drawFireflies(ctx, t);           // fireflies at night
  drawHearts(ctx);
  drawFishing(ctx, fishingState, t, baitState.enabled);
  drawFisherman(ctx, fishingState, W, H, t);  // fisherman on top of everything
  drawHeron(ctx, heron, t);                   // heron on top of everything
  drawScore(ctx, fishingState, W, H);
  drawShopButton(ctx, W, H);
  drawShop(ctx, shop, fishingState, W, H);
  drawBaitToggle(ctx, baitState, W, H, t);
  drawSettingsButton(ctx, W, H);
  drawSettings(ctx, settings, W, H);
  drawWeatherEffects(ctx, W, H, t);

  // Ambient nature sounds
  updateAmbientSounds(t, isNighttime(t));

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
