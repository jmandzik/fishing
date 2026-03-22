// Splash particles when pellets hit the water surface

interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

const particles: SplashParticle[] = [];

export function spawnSplash(x: number, y: number) {
  const count = 4 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI * 0.2 - Math.random() * Math.PI * 0.6; // upward fan
    const speed = 0.5 + Math.random() * 1.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
      vy: Math.sin(angle) * speed,
      life: 1,
      size: 1 + Math.random() * 1.5,
    });
  }
}

export function updateSplashes(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += 0.03 * (dt / 16); // gravity
    p.x += p.vx * (dt / 16);
    p.y += p.vy * (dt / 16);
    p.life -= 0.025 * (dt / 16);
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

export function drawSplashes(ctx: CanvasRenderingContext2D) {
  for (const p of particles) {
    ctx.globalAlpha = p.life * 0.7;
    ctx.fillStyle = '#C8E0F8';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
