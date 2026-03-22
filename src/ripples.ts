// Water surface ripples — expanding concentric ellipses (side-view, wider than tall)

interface Ripple {
  x: number;
  y: number;
  age: number;       // 0..1, dies at 1
  maxRadius: number;
}

const ripples: Ripple[] = [];

export function spawnRipple(x: number, y: number) {
  ripples.push({
    x,
    y,
    age: 0,
    maxRadius: 8 + Math.random() * 6,
  });
}

export function updateRipples(dt: number) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.age += 0.001 * dt; // ~1 second lifetime at 60fps (dt≈16)
    if (r.age >= 1) {
      ripples.splice(i, 1);
    }
  }
}

export function drawRipples(ctx: CanvasRenderingContext2D) {
  for (const r of ripples) {
    const alpha = 1 - r.age;
    // Draw 2–3 concentric ellipses
    const rings = 3;
    for (let ring = 0; ring < rings; ring++) {
      const frac = (r.age + ring * 0.15);
      if (frac > 1 || frac < 0) continue;
      const rx = r.maxRadius * frac;         // horizontal radius
      const ry = rx * 0.3;                   // squished for side-view perspective
      const ringAlpha = alpha * (1 - ring * 0.3) * 0.5;
      if (ringAlpha <= 0) continue;

      ctx.strokeStyle = `rgba(200, 224, 248, ${ringAlpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, Math.max(rx, 0.5), Math.max(ry, 0.3), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
