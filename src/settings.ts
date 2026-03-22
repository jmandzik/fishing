// Settings panel — toggle ambient sounds

import { ambientSettings } from './sounds.ts';

interface SettingsState {
  open: boolean;
}

export function createSettings(): SettingsState {
  return { open: false };
}

const BUTTON_W = 16;
const BUTTON_H = 10;
const BUTTON_MARGIN = 4;

function getButtonRect(w: number, h: number) {
  // Above the shop button, bottom-right
  return { x: w - BUTTON_W - BUTTON_MARGIN, y: h - BUTTON_H - BUTTON_MARGIN - 14, w: BUTTON_W, h: BUTTON_H };
}

export function isSettingsOpen(s: SettingsState): boolean {
  return s.open;
}

export function drawSettingsButton(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const btn = getButtonRect(w, h);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
  ctx.strokeStyle = '#AAAAAA';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

  // Gear icon (simple)
  ctx.fillStyle = '#AAAAAA';
  ctx.font = 'bold 7px sans-serif';
  ctx.fillText('\u2699', btn.x + 4, btn.y + 8); // ⚙
}

interface ToggleItem {
  key: keyof typeof ambientSettings;
  label: string;
}

const toggles: ToggleItem[] = [
  { key: 'frogs', label: 'Frog Croaks' },
  { key: 'crickets', label: 'Crickets' },
  { key: 'waterLap', label: 'Water Lapping' },
  { key: 'birds', label: 'Birds & Owl' },
  { key: 'wind', label: 'Wind' },
];

export function drawSettings(ctx: CanvasRenderingContext2D, settings: SettingsState, w: number, h: number) {
  if (!settings.open) return;

  const panelW = Math.min(w * 0.35, 80);
  const panelH = 20 + toggles.length * 14;
  const panelX = w - panelW - 4;
  const panelY = h - panelH - 30; // opens upward from buttons

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = '#AAAAAA';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  // Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 7px sans-serif';
  ctx.fillText('Sounds', panelX + 5, panelY + 10);

  // Toggles
  for (let i = 0; i < toggles.length; i++) {
    const item = toggles[i];
    const iy = panelY + 16 + i * 14;
    const enabled = ambientSettings[item.key];

    // Checkbox
    ctx.strokeStyle = '#AAAAAA';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(panelX + 5, iy, 6, 6);

    if (enabled) {
      ctx.fillStyle = '#44CC44';
      ctx.fillRect(panelX + 6, iy + 1, 4, 4);
    }

    // Label
    ctx.fillStyle = enabled ? '#FFFFFF' : '#777777';
    ctx.font = '6px sans-serif';
    ctx.fillText(item.label, panelX + 14, iy + 6);
  }

  // panel uses w and h above
}

export function handleSettingsClick(settings: SettingsState, x: number, y: number, w: number, h: number): boolean {
  const btn = getButtonRect(w, h);

  // Check button click
  if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
    settings.open = !settings.open;
    return true;
  }

  if (!settings.open) return false;

  const panelW = Math.min(w * 0.35, 80);
  const panelH = 20 + toggles.length * 14;
  const panelX = w - panelW - 4;
  const panelY = h - panelH - 30;

  // Check toggle clicks
  for (let i = 0; i < toggles.length; i++) {
    const iy = panelY + 16 + i * 14;
    if (x >= panelX + 3 && x <= panelX + panelW - 3 && y >= iy - 1 && y <= iy + 8) {
      const key = toggles[i].key;
      ambientSettings[key] = !ambientSettings[key];
      return true;
    }
  }

  // Click inside panel but not on a toggle — still consume it
  if (x >= panelX && x <= panelX + panelW && y >= panelY && y <= panelY + 20 + toggles.length * 14) {
    return true;
  }

  // Click outside panel — close it
  settings.open = false;
  return true;
}
