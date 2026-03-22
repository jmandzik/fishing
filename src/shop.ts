// Shop system: buy upgrades with coins earned from treasure chests

import type { FishingState } from './fishing.ts';

export interface ShopItem {
  name: string;
  description: string;
  cost: number;
  purchased: boolean;
  effect: string;
}

export interface ShopState {
  open: boolean;
  items: ShopItem[];
  selectedIndex: number;
}

// Module-level set of active upgrade effects
const activeUpgrades = new Set<string>();

export function hasEffect(effect: string): boolean {
  return activeUpgrades.has(effect);
}

export function createShop(): ShopState {
  return {
    open: false,
    selectedIndex: -1,
    items: [
      { name: 'Better Bait', description: 'Fish attracted from further', cost: 3, purchased: false, effect: 'better_bait' },
      { name: 'Strong Line', description: 'Line harder to snap', cost: 5, purchased: false, effect: 'strong_line' },
      { name: 'Deep Hook', description: 'Hook sinks faster', cost: 4, purchased: false, effect: 'deep_hook' },
      { name: 'Lily Pads', description: 'Decorative lily pads', cost: 2, purchased: false, effect: 'lily_pads' },
      { name: 'Extra Pellets', description: '3 pellets per click', cost: 3, purchased: false, effect: 'extra_pellets' },
    ],
  };
}

export function isShopOpen(shop: ShopState): boolean {
  return shop.open;
}

export function toggleShop(shop: ShopState): void {
  shop.open = !shop.open;
}

export function tryBuyItem(shop: ShopState, index: number, fishingState: FishingState): boolean {
  const item = shop.items[index];
  if (!item || item.purchased) return false;
  if (fishingState.totalCoins < item.cost) return false;
  fishingState.totalCoins -= item.cost;
  item.purchased = true;
  activeUpgrades.add(item.effect);
  return true;
}

export function hasUpgrade(shop: ShopState, effect: string): boolean {
  return shop.items.some(i => i.effect === effect && i.purchased);
}

// --- Drawing ---

const BUTTON_W = 28;
const BUTTON_H = 10;
const BUTTON_PAD = 4;

function getButtonRect(w: number) {
  return { x: w - BUTTON_W - BUTTON_PAD, y: BUTTON_PAD, w: BUTTON_W, h: BUTTON_H };
}

export function drawShopButton(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
  const btn = getButtonRect(w);

  // Button background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(btn.x, btn.y, btn.w, btn.h);

  // Border
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

  // Text
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 8px sans-serif';
  ctx.fillText('SHOP', btn.x + 3, btn.y + 8);
}

export function drawShop(ctx: CanvasRenderingContext2D, shop: ShopState, fishingState: FishingState, w: number, h: number): void {
  if (!shop.open) return;

  const panelX = Math.floor(w * 0.6);
  const panelW = w - panelX;

  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(panelX, 0, panelW, h);

  // Border
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(panelX + 1, 1, panelW - 2, h - 2);

  // Title
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('SHOP', panelX + 8, 14);

  // Coins display
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 7px sans-serif';
  ctx.fillText(`Coins: ${fishingState.totalCoins}`, panelX + 8, 24);

  // Divider
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(panelX + 6, 28);
  ctx.lineTo(panelX + panelW - 6, 28);
  ctx.stroke();

  // Items
  const itemStartY = 34;
  const itemH = 32;

  for (let i = 0; i < shop.items.length; i++) {
    const item = shop.items[i];
    const iy = itemStartY + i * itemH;

    // Item background
    if (item.purchased) {
      ctx.fillStyle = 'rgba(40, 80, 40, 0.5)';
    } else if (fishingState.totalCoins >= item.cost) {
      ctx.fillStyle = 'rgba(60, 60, 100, 0.5)';
    } else {
      ctx.fillStyle = 'rgba(40, 40, 40, 0.5)';
    }
    ctx.fillRect(panelX + 4, iy, panelW - 8, itemH - 3);

    // Item border
    ctx.strokeStyle = item.purchased ? '#66CC66' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.3;
    ctx.strokeRect(panelX + 4, iy, panelW - 8, itemH - 3);

    // Item name
    ctx.fillStyle = item.purchased ? '#66CC66' : '#FFFFFF';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText(item.name, panelX + 7, iy + 10);

    // Cost or OWNED
    if (item.purchased) {
      ctx.fillStyle = '#66CC66';
      ctx.font = 'bold 6px sans-serif';
      ctx.fillText('OWNED', panelX + panelW - 35, iy + 10);
    } else {
      ctx.fillStyle = fishingState.totalCoins >= item.cost ? '#FFD700' : '#886644';
      ctx.font = 'bold 6px sans-serif';
      ctx.fillText(`${item.cost} coins`, panelX + panelW - 38, iy + 10);
    }

    // Description
    ctx.fillStyle = '#BBBBBB';
    ctx.font = '6px sans-serif';
    ctx.fillText(item.description, panelX + 7, iy + 21);
  }
}

// --- Click handling ---

export function handleShopClick(shop: ShopState, fishingState: FishingState, x: number, y: number, w: number, h: number): boolean {
  const btn = getButtonRect(w);

  // Check shop button click
  if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
    toggleShop(shop);
    return true;
  }

  // If shop is open, handle panel clicks
  if (shop.open) {
    const panelX = Math.floor(w * 0.6);

    // Click outside panel closes shop
    if (x < panelX) {
      shop.open = false;
      return true;
    }

    // Check item clicks
    const itemStartY = 36;
    const itemH = 28;

    for (let i = 0; i < shop.items.length; i++) {
      const iy = itemStartY + i * itemH;
      if (x >= panelX + 4 && x <= panelX + (w - panelX) - 4 && y >= iy && y <= iy + itemH - 3) {
        tryBuyItem(shop, i, fishingState);
        return true;
      }
    }

    // Click was inside panel but not on an item - still consume it
    void h;
    return true;
  }

  return false;
}
