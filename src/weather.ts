// Weather system — random weather events with rain, storms, and lightning

import { spawnRipple } from './ripples.ts';
import { getPondBounds } from './pond.ts';

// --- Types ---

type WeatherState = 'clear' | 'cloudy' | 'rain' | 'storm';

interface RainParticle {
  x: number;
  y: number;
  speed: number;
  length: number;
}

// --- State ---

let currentWeather: WeatherState = 'clear';
let targetWeather: WeatherState = 'clear';
let transitionProgress = 1; // 0 = old state, 1 = fully transitioned
let nextChangeAt = 0; // timestamp when weather should change next
let overlayAlpha = 0; // current sky darkening alpha (smoothly interpolated)

const rainParticles: RainParticle[] = [];

// Lightning state
let lightningFlashAlpha = 0;
let nextLightningAt = 0;
let thunderPending = false;
let thunderAt = 0;

// --- Weather transition weights ---

const WEATHER_WEIGHTS: { state: WeatherState; weight: number }[] = [
  { state: 'clear', weight: 0.50 },
  { state: 'cloudy', weight: 0.25 },
  { state: 'rain', weight: 0.15 },
  { state: 'storm', weight: 0.10 },
];

const SKY_OVERLAY: Record<WeatherState, number> = {
  clear: 0,
  cloudy: 0.1,
  rain: 0.15,
  storm: 0.25,
};

const PARTICLE_RANGE: Record<WeatherState, [number, number]> = {
  clear: [0, 0],
  cloudy: [0, 0],
  rain: [30, 60],
  storm: [80, 120],
};

// --- Helpers ---

function pickWeather(): WeatherState {
  const r = Math.random();
  let acc = 0;
  for (const { state, weight } of WEATHER_WEIGHTS) {
    acc += weight;
    if (r < acc) return state;
  }
  return 'clear';
}

function scheduleNextChange(t: number) {
  // 60-120 seconds from now
  nextChangeAt = t + 60000 + Math.random() * 60000;
}

function scheduleLightning(t: number) {
  // Random flash every 10-20 seconds during storm
  nextLightningAt = t + 10000 + Math.random() * 10000;
}

function spawnParticle(w: number, h: number): RainParticle {
  return {
    x: Math.random() * (w + 20) - 10, // slight overshoot for wind angle
    y: -Math.random() * h * 0.3, // start above screen
    speed: 2.5 + Math.random() * 1.5,
    length: 3 + Math.random() * 3,
  };
}

function getTargetParticleCount(): number {
  const effectiveState = transitionProgress >= 1 ? currentWeather : targetWeather;
  const range = PARTICLE_RANGE[effectiveState];
  if (range[1] === 0) return 0;
  return range[0] + Math.floor(Math.random() * (range[1] - range[0]));
}

// --- Thunder sound (inline low-freq oscillator burst) ---

function playThunder() {
  // Use a dynamically created AudioContext-like approach
  // We create it inline to avoid needing to import the main audio context
  try {
    const ac = new AudioContext();
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(50, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ac.currentTime + 0.8);

    gain.gain.setValueAtTime(0.3, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 1.2);

    // Add a rumble noise layer
    const bufSize = Math.floor(ac.sampleRate * 1.2);
    const noiseBuf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const noiseNode = ac.createBufferSource();
    noiseNode.buffer = noiseBuf;

    const noiseGain = ac.createGain();
    noiseGain.gain.setValueAtTime(0.15, ac.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.5);

    // Low-pass filter for rumble
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 100;

    noiseNode.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ac.destination);

    noiseNode.start(ac.currentTime);
    noiseNode.stop(ac.currentTime + 1.5);

    // Close context after sound finishes
    setTimeout(() => ac.close(), 2000);
  } catch (_e) {
    // Audio not available — silently ignore
  }
}

// --- Public API ---

export function getWeatherState(): string {
  return currentWeather;
}

export function updateWeather(dt: number, t: number, w: number, h: number) {
  // Initialize on first call
  if (nextChangeAt === 0) {
    scheduleNextChange(t);
    if (currentWeather === 'storm') scheduleLightning(t);
  }

  // --- Weather state transitions ---
  if (t >= nextChangeAt) {
    let next = pickWeather();
    // After rain/storm, strongly bias toward clearing up
    if ((currentWeather === 'rain' || currentWeather === 'storm') && (next === 'rain' || next === 'storm')) {
      next = Math.random() < 0.7 ? 'clear' : 'cloudy';
    }
    if (next !== currentWeather) {
      targetWeather = next;
      transitionProgress = 0;
    }
    scheduleNextChange(t);

    if (next === 'storm') {
      scheduleLightning(t);
    }
  }

  // Smooth transition (fade over ~2 seconds)
  if (transitionProgress < 1) {
    transitionProgress = Math.min(1, transitionProgress + (dt / 2000));
    if (transitionProgress >= 1) {
      currentWeather = targetWeather;
    }
  }

  // --- Overlay alpha interpolation ---
  const fromAlpha = SKY_OVERLAY[currentWeather];
  const toAlpha = SKY_OVERLAY[targetWeather];
  const targetAlpha = transitionProgress < 1
    ? fromAlpha + (toAlpha - fromAlpha) * transitionProgress
    : SKY_OVERLAY[currentWeather];
  // Smooth lerp
  overlayAlpha += (targetAlpha - overlayAlpha) * Math.min(1, dt * 0.003);

  // --- Rain particles ---
  const effectiveState = transitionProgress >= 1 ? currentWeather : targetWeather;
  const wantsRain = effectiveState === 'rain' || effectiveState === 'storm';

  if (wantsRain) {
    const targetCount = getTargetParticleCount();
    // Add particles if we need more
    while (rainParticles.length < targetCount) {
      rainParticles.push(spawnParticle(w, h));
    }
  }

  // Update existing particles
  const bounds = getPondBounds(w, h);
  for (let i = rainParticles.length - 1; i >= 0; i--) {
    const p = rainParticles[i];
    p.y += p.speed * (dt / 16);
    p.x -= 0.4 * (dt / 16); // slight wind angle to the left

    // Check if raindrop hit water surface or went below screen
    if (p.y >= bounds.waterTop && p.x >= bounds.left && p.x <= bounds.right) {
      // Spawn a small ripple on the water surface
      spawnRipple(p.x, bounds.waterTop + Math.random() * 3);
      rainParticles.splice(i, 1);
      continue;
    }

    // Remove if raindrop hits the ground surface
    if (p.y >= bounds.waterTop && (p.x < bounds.left || p.x > bounds.right)) {
      rainParticles.splice(i, 1);
      continue;
    }

    if (p.y > h + 10) {
      // Off screen — remove or recycle
      if (wantsRain) {
        // Recycle: reset to top
        p.y = -Math.random() * 20;
        p.x = Math.random() * (w + 20) - 10;
        p.speed = 2.5 + Math.random() * 1.5;
        p.length = 3 + Math.random() * 3;
      } else {
        rainParticles.splice(i, 1);
      }
    }
  }

  // Remove excess particles when transitioning away from rain
  if (!wantsRain && rainParticles.length > 0) {
    // Let them fall off naturally — don't add new ones
  }

  // --- Lightning ---
  if (currentWeather === 'storm' || targetWeather === 'storm') {
    if (t >= nextLightningAt && nextLightningAt > 0) {
      // Flash!
      lightningFlashAlpha = 1;
      // Schedule thunder 300-800ms after flash
      thunderPending = true;
      thunderAt = t + 300 + Math.random() * 500;
      scheduleLightning(t);
    }

    // Thunder sound
    if (thunderPending && t >= thunderAt) {
      thunderPending = false;
      playThunder();
    }
  }

  // Decay lightning flash (very quick — 100ms)
  if (lightningFlashAlpha > 0) {
    lightningFlashAlpha = Math.max(0, lightningFlashAlpha - (dt / 100));
  }
}

export function drawWeatherSky(ctx: CanvasRenderingContext2D, w: number, h: number, _t: number) {
  if (overlayAlpha <= 0.001) return;

  const bounds = getPondBounds(w, h);

  // Darken the sky area (above waterTop)
  ctx.fillStyle = `rgba(30, 30, 50, ${overlayAlpha})`;
  ctx.fillRect(0, 0, w, bounds.waterTop);
}

export function drawWeatherEffects(ctx: CanvasRenderingContext2D, w: number, h: number, _t: number) {
  // --- Rain particles (clipped to sky/water area, not underground) ---
  if (rainParticles.length > 0) {
    const bounds = getPondBounds(w, h);
    ctx.save();
    // Clip to above ground level
    ctx.beginPath();
    ctx.rect(0, 0, w, bounds.waterTop + 2);
    ctx.clip();

    ctx.strokeStyle = 'rgba(180, 200, 230, 0.5)';
    ctx.lineWidth = 1;
    for (const p of rainParticles) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 0.8, p.y + p.length);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Lightning flash ---
  if (lightningFlashAlpha > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${lightningFlashAlpha * 0.7})`;
    ctx.fillRect(0, 0, w, h);
  }
}
