// Day/night cycle — full cycle over ~180 seconds (3 minutes)
// Dawn 0-15%, Day 15-50%, Dusk 50-65%, Night 65-100%

const CYCLE_MS = 180_000;

/** Manual time offset — adjusted by arrow keys for debugging */
let timeOffset = 0;

/** Shift the day cycle forward or backward by ms */
export function adjustDayCycle(ms: number) {
  timeOffset += ms;
}

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/** Returns 0-1 cycle position from timestamp in ms */
export function getDayPhase(t: number): number {
  return (((t + timeOffset) % CYCLE_MS) + CYCLE_MS) % CYCLE_MS / CYCLE_MS;
}

export function getTimeOfDay(t: number): TimeOfDay {
  const p = getDayPhase(t);
  if (p < 0.15) return 'dawn';
  if (p < 0.50) return 'day';
  if (p < 0.65) return 'dusk';
  return 'night';
}

/** Interpolate between two hex colors. amt 0 = a, amt 1 = b */
function lerpColor(a: string, b: string, amt: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 0xff) * (1 - amt) + ((pb >> 16) & 0xff) * amt);
  const g = Math.round(((pa >> 8) & 0xff) * (1 - amt) + ((pb >> 8) & 0xff) * amt);
  const bl = Math.round((pa & 0xff) * (1 - amt) + (pb & 0xff) * amt);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

/** Smooth step for transitions */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function getSkyColors(t: number): { top: string; bottom: string } {
  const p = getDayPhase(t);

  // Define key colors for top and bottom of sky gradient
  // Dawn: dark blue -> orange/pink
  // Day: blue sky
  // Dusk: orange/red/purple
  // Night: dark blue/black

  const nightTop = '#0A0A2A';
  const nightBottom = '#1A1A3A';
  const dawnTop = '#2A3A6A';
  const dawnBottom = '#E87040';
  const dayTop = '#5BA8E0';
  const dayBottom = '#A0D4F0';
  const duskTop = '#4A2060';
  const duskBottom = '#D04020';

  let top: string;
  let bottom: string;

  if (p < 0.08) {
    // Night -> Dawn transition (first half of dawn)
    const f = smoothstep(0, 0.08, p);
    top = lerpColor(nightTop, dawnTop, f);
    bottom = lerpColor(nightBottom, dawnBottom, f);
  } else if (p < 0.15) {
    // Dawn -> Day transition (second half of dawn)
    const f = smoothstep(0.08, 0.15, p);
    top = lerpColor(dawnTop, dayTop, f);
    bottom = lerpColor(dawnBottom, dayBottom, f);
  } else if (p < 0.50) {
    // Full day
    top = dayTop;
    bottom = dayBottom;
  } else if (p < 0.58) {
    // Day -> Dusk transition (first half of dusk)
    const f = smoothstep(0.50, 0.58, p);
    top = lerpColor(dayTop, duskTop, f);
    bottom = lerpColor(dayBottom, duskBottom, f);
  } else if (p < 0.65) {
    // Dusk -> Night transition (second half of dusk)
    const f = smoothstep(0.58, 0.65, p);
    top = lerpColor(duskTop, nightTop, f);
    bottom = lerpColor(duskBottom, nightBottom, f);
  } else {
    // Night
    top = nightTop;
    bottom = nightBottom;
  }

  return { top, bottom };
}

/** 0 at day, up to 0.5 at night — for darkening overlays */
export function getDarkness(t: number): number {
  const p = getDayPhase(t);
  if (p < 0.15) {
    // Dawn: fading from dark to light
    return 0.5 * (1 - smoothstep(0, 0.15, p));
  }
  if (p < 0.50) {
    return 0;
  }
  if (p < 0.65) {
    // Dusk: getting darker
    return 0.5 * smoothstep(0.50, 0.65, p);
  }
  // Night
  return 0.5;
}

export function isNighttime(t: number): boolean {
  const tod = getTimeOfDay(t);
  return tod === 'night';
}

/** Sun position: returns {x fraction 0-1 across sky, y fraction 0-1, visible} */
export function getSunPosition(t: number, w: number, skyH: number): { x: number; y: number; visible: boolean } {
  const p = getDayPhase(t);

  // Sun is visible from dawn (0) to end of dusk (0.65)
  if (p >= 0.65) return { x: 0, y: 0, visible: false };

  // Map 0..0.65 to an arc across the sky
  // 0 = sunrise on left, 0.325 = zenith, 0.65 = sunset on right
  const sunProgress = p / 0.65;
  // Arc from behind left trees (0.03) to behind right trees (0.97)
  const x = w * 0.03 + sunProgress * w * 0.94;
  const arcHeight = Math.sin(sunProgress * Math.PI);
  const y = skyH * (0.90 - arcHeight * 0.75);

  const visible = p >= 0.01 && p <= 0.64;

  return { x, y, visible };
}

/** Moon position: appears at night on the right side */
export function getMoonPosition(t: number, w: number, skyH: number): { x: number; y: number; visible: boolean } {
  const p = getDayPhase(t);

  if (p < 0.60) return { x: 0, y: 0, visible: false };

  // Moon rises from right, arcs across to left during night
  // Night is 0.65 to 1.0 (wrapping). Also show during late dusk.
  let moonProgress: number;
  if (p >= 0.60) {
    // 0.60 -> 1.0 maps to 0 -> 1
    moonProgress = (p - 0.60) / 0.40;
  } else {
    moonProgress = 0;
  }

  // Arc from behind left trees (0.03) to behind right trees (0.97)
  const x = w * 0.03 + moonProgress * w * 0.94;
  const arcHeight = Math.sin(moonProgress * Math.PI);
  const y = skyH * (0.85 - arcHeight * 0.6);

  const visible = p >= 0.63;

  return { x, y, visible };
}

// --- Stars ---

interface Star {
  x: number; // fraction 0-1
  y: number; // fraction 0-1
  twinkleOffset: number;
  brightness: number;
}

const stars: Star[] = [];

function ensureStars() {
  if (stars.length > 0) return;
  const count = 30 + Math.floor(Math.random() * 11); // 30-40
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random() * 0.9, // keep away from very bottom of sky
      twinkleOffset: Math.random() * Math.PI * 2,
      brightness: 0.5 + Math.random() * 0.5,
    });
  }
}

export function drawStars(ctx: CanvasRenderingContext2D, w: number, skyH: number, t: number) {
  ensureStars();
  const p = getDayPhase(t);

  // Stars visible during night and edges of dusk/dawn
  let starAlpha = 0;
  if (p >= 0.60 && p < 0.65) {
    starAlpha = smoothstep(0.60, 0.65, p);
  } else if (p >= 0.65) {
    starAlpha = 1;
  } else if (p < 0.05) {
    starAlpha = 1 - smoothstep(0, 0.05, p);
  }

  if (starAlpha <= 0) return;

  ctx.fillStyle = '#FFFFFF';
  for (const star of stars) {
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.002 + star.twinkleOffset));
    const alpha = starAlpha * star.brightness * twinkle;
    ctx.globalAlpha = alpha;
    ctx.fillRect(Math.floor(star.x * w), Math.floor(star.y * skyH), 1, 1);
  }
  ctx.globalAlpha = 1;
}

// --- Cloud tinting ---

/** Returns an rgba tint overlay for clouds at night */
export function getCloudTint(t: number): string {
  const darkness = getDarkness(t);
  const r = Math.round(10 * darkness * 2);
  const g = Math.round(10 * darkness * 2);
  const b = Math.round(30 * darkness * 2);
  const a = darkness * 1.2;
  return `rgba(${r},${g},${b},${a})`;
}

// --- Fireflies ---

interface Firefly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  glowOffset: number;
  size: number;
  spawnDelay: number;  // staggered appearance (0-10 seconds)
  fadeIn: number;      // 0-1, fades in over time
}

const fireflies: Firefly[] = [];
let firefliesInitialized = false;
let nightStartedAt = 0;
let wasNight = false;

function initFireflies(w: number, h: number) {
  if (firefliesInitialized) return;
  firefliesInitialized = true;
  const count = 8 + Math.floor(Math.random() * 5); // 8-12
  for (let i = 0; i < count; i++) {
    fireflies.push({
      x: w * 0.1 + Math.random() * w * 0.8,
      y: h * 0.08 + Math.random() * h * 0.15,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.2,
      glowOffset: Math.random() * Math.PI * 2,
      size: 1 + Math.random() * 0.5,
      spawnDelay: Math.random() * 10000, // stagger over 10 seconds
      fadeIn: 0,
    });
  }
}

export function updateFireflies(dt: number, t: number, w: number, h: number) {
  const night = isNighttime(t);

  // Track when night starts
  if (night && !wasNight) {
    nightStartedAt = t;
    // Reset fade for all fireflies
    for (const ff of fireflies) {
      ff.fadeIn = 0;
    }
  }
  wasNight = night;

  if (!night) {
    // Fade out during day
    for (const ff of fireflies) {
      ff.fadeIn = Math.max(0, ff.fadeIn - 0.002 * (dt / 16));
    }
    return;
  }

  initFireflies(w, h);

  const nightElapsed = t - nightStartedAt;
  const minY = h * 0.05;
  const maxY = h * 0.24;

  for (const ff of fireflies) {
    // Staggered appearance — don't start until delay has passed
    if (nightElapsed < ff.spawnDelay) continue;

    // Fade in over 2 seconds after spawn delay
    ff.fadeIn = Math.min(1, ff.fadeIn + 0.0008 * (dt / 16));

    // Gentle random wandering
    ff.vx += (Math.random() - 0.5) * 0.02 * (dt / 16);
    ff.vy += (Math.random() - 0.5) * 0.015 * (dt / 16);
    ff.vx *= 0.97;
    ff.vy *= 0.97;
    ff.x += ff.vx * (dt / 16);
    ff.y += ff.vy * (dt / 16);

    // Keep in bounds
    if (ff.x < w * 0.05) { ff.x = w * 0.05; ff.vx = Math.abs(ff.vx); }
    if (ff.x > w * 0.95) { ff.x = w * 0.95; ff.vx = -Math.abs(ff.vx); }
    if (ff.y < minY) { ff.y = minY; ff.vy = Math.abs(ff.vy); }
    if (ff.y > maxY) { ff.y = maxY; ff.vy = -Math.abs(ff.vy); }
  }
}

export function drawFireflies(ctx: CanvasRenderingContext2D, t: number) {
  for (const ff of fireflies) {
    if (ff.fadeIn <= 0) continue;

    const glow = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.003 + ff.glowOffset));
    const alpha = ff.fadeIn;

    // Outer glow
    ctx.globalAlpha = glow * 0.3 * alpha;
    ctx.fillStyle = '#AAFF44';
    ctx.beginPath();
    ctx.arc(ff.x, ff.y, ff.size * 3, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright dot
    ctx.globalAlpha = glow * 0.8 * alpha;
    ctx.fillStyle = '#EEFF88';
    ctx.beginPath();
    ctx.arc(ff.x, ff.y, ff.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
