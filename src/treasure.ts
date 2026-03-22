// Treasure chest that sits on the pond floor and can be fished up

import type { PondBounds } from './pond.ts';
import { getBowlFloorY } from './pond.ts';

export interface TreasureChest {
  x: number;
  y: number;
  visible: boolean;
  hooked: boolean;
  respawnAfter: number;
  coins: number;         // reward when caught (1-3)
}

export function createTreasureChest(bounds: PondBounds): TreasureChest {
  const x = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.5;
  const y = getBowlFloorY(x, bounds) - 4;
  return {
    x, y,
    visible: true,
    hooked: false,
    respawnAfter: 0,
    coins: 1 + Math.floor(Math.random() * 3),
  };
}

export function respawnChest(chest: TreasureChest, bounds: PondBounds) {
  chest.x = bounds.centerX + (Math.random() - 0.5) * (bounds.right - bounds.left) * 0.5;
  chest.y = getBowlFloorY(chest.x, bounds) - 4;
  chest.visible = true;
  chest.hooked = false;
  chest.coins = 1 + Math.floor(Math.random() * 3);
}

export function drawTreasureChest(ctx: CanvasRenderingContext2D, chest: TreasureChest, t: number) {
  if (!chest.visible) return;

  const x = chest.x;
  const y = chest.y;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 7, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Chest body
  ctx.fillStyle = '#6B3A1A';
  ctx.fillRect(x - 6, y - 3, 12, 7);

  // Lid (slightly arched)
  ctx.fillStyle = '#7A4A2A';
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 3);
  ctx.lineTo(x - 6, y - 5);
  ctx.quadraticCurveTo(x, y - 7, x + 6, y - 5);
  ctx.lineTo(x + 6, y - 3);
  ctx.closePath();
  ctx.fill();

  // Metal bands
  ctx.fillStyle = '#8A8A70';
  ctx.fillRect(x - 6, y - 3, 12, 1);
  ctx.fillRect(x - 6, y + 1, 12, 1);

  // Vertical bands
  ctx.fillRect(x - 6, y - 5, 1, 9);
  ctx.fillRect(x + 5, y - 5, 1, 9);

  // Lock/clasp
  ctx.fillStyle = '#D4A830';
  ctx.fillRect(x - 1, y - 4, 2, 3);

  // Keyhole
  ctx.fillStyle = '#3A2A10';
  ctx.fillRect(x, y - 3, 1, 1);

  // Handle on top (what the hook grabs)
  ctx.strokeStyle = '#8A8A70';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y - 7, 2.5, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Shimmer/sparkle
  const sparkle = Math.sin(t * 0.003) * 0.5 + 0.5;
  ctx.fillStyle = `rgba(255, 215, 0, ${sparkle * 0.4})`;
  ctx.beginPath();
  ctx.arc(x + 3, y - 5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - 4, y - 1, 1, 0, Math.PI * 2);
  ctx.fill();
}
