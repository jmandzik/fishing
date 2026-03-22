// Bait toggle — a wiggly worm in a box that controls whether fish are attracted to the hook

const BOX_SIZE = 14;
const MARGIN = 4;

export interface BaitState {
  enabled: boolean;
}

export function createBaitState(): BaitState {
  return { enabled: true };
}

function getRect(w: number, h: number) {
  // Above settings button (settings is at y = h - 10 - 4 - 14 = h - 28)
  return { x: w - BOX_SIZE - MARGIN, y: h - BOX_SIZE - MARGIN - 28, w: BOX_SIZE, h: BOX_SIZE };
}

export function handleBaitClick(bait: BaitState, x: number, y: number, w: number, h: number): boolean {
  const r = getRect(w, h);
  if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
    bait.enabled = !bait.enabled;
    return true;
  }
  return false;
}

export function drawBaitToggle(ctx: CanvasRenderingContext2D, bait: BaitState, w: number, h: number, t: number) {
  const r = getRect(w, h);

  // Box background
  ctx.fillStyle = bait.enabled ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // Border
  ctx.strokeStyle = bait.enabled ? '#E8845A' : '#666666';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(r.x, r.y, r.w, r.h);

  // Worm
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;

  if (bait.enabled) {
    // Wiggly animated worm
    const wiggle = Math.sin(t * 0.006) * 1.5;
    const wiggle2 = Math.sin(t * 0.008 + 1) * 1;

    ctx.strokeStyle = '#D4724A';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy + 2 + wiggle2);
    ctx.quadraticCurveTo(cx - 1, cy - 3 + wiggle, cx + 1, cy + wiggle2);
    ctx.quadraticCurveTo(cx + 3, cy + 3 - wiggle, cx + 4, cy - 1 + wiggle);
    ctx.stroke();
  } else {
    // Crossed-out / no worm — just a small X
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 3);
    ctx.lineTo(cx + 3, cy + 3);
    ctx.moveTo(cx + 3, cy - 3);
    ctx.lineTo(cx - 3, cy + 3);
    ctx.stroke();
  }
}
