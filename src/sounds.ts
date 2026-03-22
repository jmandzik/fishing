// Synthesized sound effects using Web Audio API — no external audio files

let ctx: AudioContext | null = null;

/** Call on first user gesture to unlock AudioContext */
export function initAudio() {
  if (ctx) return;
  ctx = new AudioContext();
}

function getCtx(): AudioContext | null {
  if (!ctx) return null;
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Create a short noise buffer */
function noiseBuffer(ac: AudioContext, duration: number): AudioBuffer {
  const len = Math.floor(ac.sampleRate * duration);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

/** White noise burst — pellets hitting water, fish splashing */
export function playSplash() {
  const ac = getCtx();
  if (!ac) return;

  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer(ac, 0.15);

  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3000;
  filter.Q.value = 0.8;

  const gain = ac.createGain();
  const now = ac.currentTime;
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  noise.connect(filter).connect(gain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.15);
}

/** Short low-frequency pop/crunch — fish eating */
export function playChomp() {
  const ac = getCtx();
  if (!ac) return;

  const osc = ac.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(120, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.08);

  const gain = ac.createGain();
  const now = ac.currentTime;
  gain.gain.setValueAtTime(0.07, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

/** Quick high pluck — fish bites hook */
export function playBite() {
  const ac = getCtx();
  if (!ac) return;

  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(800, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, ac.currentTime + 0.1);

  const gain = ac.createGain();
  const now = ac.currentTime;
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

/** Whoosh — filtered noise sweep for casting */
export function playCast() {
  const ac = getCtx();
  if (!ac) return;

  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer(ac, 0.3);

  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 2;
  const now = ac.currentTime;
  filter.frequency.setValueAtTime(400, now);
  filter.frequency.exponentialRampToValueAtTime(4000, now + 0.15);
  filter.frequency.exponentialRampToValueAtTime(800, now + 0.3);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.05, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  noise.connect(filter).connect(gain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.3);
}

/** Triumphant ascending tone — 3 quick rising notes */
export function playCatch() {
  const ac = getCtx();
  if (!ac) return;

  const notes = [523, 659, 784]; // C5, E5, G5
  const now = ac.currentTime;

  for (let i = 0; i < notes.length; i++) {
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.value = notes[i];

    const gain = ac.createGain();
    const start = now + i * 0.09;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.06, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.12);
  }
}

/** Sharp crack — line breaking */
export function playSnap() {
  const ac = getCtx();
  if (!ac) return;

  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer(ac, 0.08);

  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000;

  const gain = ac.createGain();
  const now = ac.currentTime;
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  noise.connect(filter).connect(gain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.08);
}

/** Soft double-thump — breeding heartbeat */
export function playHeartbeat() {
  const ac = getCtx();
  if (!ac) return;

  const now = ac.currentTime;
  for (let i = 0; i < 2; i++) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 60;

    const gain = ac.createGain();
    const start = now + i * 0.2;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.08, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.15);
  }
}

/** Bright tinkling — treasure chest coins */
export function playCoins() {
  const ac = getCtx();
  if (!ac) return;

  const now = ac.currentTime;
  for (let i = 0; i < 5; i++) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    const freq = 1200 + Math.random() * 1800;
    osc.frequency.value = freq;

    const gain = ac.createGain();
    const start = now + i * 0.06;
    gain.gain.setValueAtTime(0.04, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.15);
  }
}

/** Very quiet looping water ambience. Returns a volume control { setVolume(v: number) } */
let ambientGain: GainNode | null = null;

export function playAmbient() {
  const ac = getCtx();
  if (!ac || ambientGain) return; // only start once

  // Create a long noise buffer that loops
  const buf = noiseBuffer(ac, 2);
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  filter.Q.value = 0.5;

  ambientGain = ac.createGain();
  ambientGain.gain.value = 0.012;

  noise.connect(filter).connect(ambientGain).connect(ac.destination);
  noise.start();
}

/** Adjust ambient volume (0-1 scale, default ~0.012) */
export function setAmbientVolume(v: number) {
  if (ambientGain) {
    ambientGain.gain.value = v;
  }
}

// --- Ambient nature sounds ---

// Settings for which ambient sounds are enabled
export const ambientSettings = {
  frogs: true,
  crickets: true,
  waterLap: true,
  birds: true,
  wind: true,
};

let ambientStarted = false;
let lastFrogCroak = 0;
let lastWaterLap = 0;
let lastBirdChirp = 0;
let lastWindGust = 0;
let lastOwlHoot = 0;
let cricketsNode: AudioBufferSourceNode | null = null;
let cricketsGain: GainNode | null = null;

/** Call every frame to trigger random ambient sounds */
export function updateAmbientSounds(t: number, isNight: boolean) {
  const ac = getCtx();
  if (!ac) return;

  if (!ambientStarted) {
    ambientStarted = true;
    startCrickets(ac);
  }

  // Crickets — continuous at night, off during day
  if (cricketsGain) {
    const targetVol = (isNight && ambientSettings.crickets) ? 0.025 : 0;
    cricketsGain.gain.value += (targetVol - cricketsGain.gain.value) * 0.01;
  }

  // Frog croaks — more at night
  if (ambientSettings.frogs) {
    const frogInterval = isNight ? 8000 : 25000;
    if (t - lastFrogCroak > frogInterval + Math.random() * frogInterval) {
      lastFrogCroak = t;
      playFrogCroak(ac, isNight);
    }
  }

  // Water lapping — gentle random splashes
  if (ambientSettings.waterLap) {
    if (t - lastWaterLap > 4000 + Math.random() * 6000) {
      lastWaterLap = t;
      playWaterLap(ac);
    }
  }

  // Bird chirps — daytime only
  if (ambientSettings.birds && !isNight) {
    if (t - lastBirdChirp > 15000 + Math.random() * 20000) {
      lastBirdChirp = t;
      playBirdChirp(ac);
    }
  }

  // Wind — occasional soft gust
  if (ambientSettings.wind) {
    if (t - lastWindGust > 20000 + Math.random() * 30000) {
      lastWindGust = t;
      playWindGust(ac);
    }
  }

  // Owl hoot — night only, rare
  if (isNight && ambientSettings.birds) {
    if (t - lastOwlHoot > 40000 + Math.random() * 50000) {
      lastOwlHoot = t;
      playOwlHoot(ac);
    }
  }
}

function startCrickets(ac: AudioContext) {
  // Crickets: rapid alternating tones
  const buf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // Chirp pattern: bursts of high-freq sine
    const chirpRate = 18; // chirps per second
    const chirpPhase = (i / ac.sampleRate * chirpRate) % 1;
    const inChirp = chirpPhase < 0.3;
    if (inChirp) {
      data[i] = Math.sin(i * 0.8) * 0.3 * Math.sin(chirpPhase / 0.3 * Math.PI);
    } else {
      data[i] = 0;
    }
  }
  cricketsNode = ac.createBufferSource();
  cricketsNode.buffer = buf;
  cricketsNode.loop = true;

  cricketsGain = ac.createGain();
  cricketsGain.gain.value = 0;

  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 4500;
  filter.Q.value = 3;

  cricketsNode.connect(filter).connect(cricketsGain).connect(ac.destination);
  cricketsNode.start();
}

function playFrogCroak(ac: AudioContext, deep: boolean) {
  const now = ac.currentTime;
  const baseFreq = deep ? 80 : 120;

  // Two-part croak
  for (let i = 0; i < 2; i++) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    const start = now + i * 0.15;
    osc.frequency.setValueAtTime(baseFreq + Math.random() * 30, start);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, start + 0.1);

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.04, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.12);
  }
}

function playWaterLap(ac: AudioContext) {
  const now = ac.currentTime;
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer(ac, 0.5);

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.015, now + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  noise.connect(filter).connect(gain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.5);
}

function playBirdChirp(ac: AudioContext) {
  const now = ac.currentTime;
  // 2-3 quick descending notes
  const noteCount = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < noteCount; i++) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    const freq = 2000 + Math.random() * 1500 - i * 300;
    const start = now + i * 0.08;
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, start + 0.06);

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.02, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.07);

    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.08);
  }
}

function playWindGust(ac: AudioContext) {
  const now = ac.currentTime;
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer(ac, 1.5);

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(300, now);
  filter.frequency.linearRampToValueAtTime(600, now + 0.5);
  filter.frequency.linearRampToValueAtTime(200, now + 1.5);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.012, now + 0.4);
  gain.gain.linearRampToValueAtTime(0, now + 1.4);

  noise.connect(filter).connect(gain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + 1.5);
}

function playOwlHoot(ac: AudioContext) {
  const now = ac.currentTime;
  // Two low hoots
  for (let i = 0; i < 2; i++) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    const start = now + i * 0.5;
    osc.frequency.setValueAtTime(280, start);
    osc.frequency.exponentialRampToValueAtTime(220, start + 0.3);

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(i === 0 ? 0.03 : 0.025, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.35);
  }
}
