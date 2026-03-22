// Haptic feedback via the Vibration API (Android Chrome, no-op elsewhere)
//
// The Vibration API requires a recent user gesture. Calls from rAF (game loop)
// won't fire on Android Chrome, so we queue patterns and flush them on the
// next touchstart/touchend/mousedown which provides a fresh gesture context.

let pending: Array<number | number[]> = [];

function vibrate(pattern: number | number[]) {
  if (typeof navigator.vibrate !== 'function') return;
  // Try immediately — works if called during a gesture handler
  if (!navigator.vibrate(pattern)) {
    // Queue for next gesture
    pending.push(pattern);
  }
}

/** Call from touchstart/touchend/mousedown to flush queued haptics */
export function flushHaptics() {
  if (pending.length === 0) return;
  if (typeof navigator.vibrate !== 'function') return;
  // Merge into a single pattern
  const merged: number[] = [];
  for (const p of pending) {
    if (Array.isArray(p)) {
      merged.push(...p);
    } else {
      merged.push(p);
    }
  }
  pending = [];
  navigator.vibrate(merged);
}

/** Light tap — pellet drop, reel click */
export function hapticTap() { vibrate(15); }

/** Medium pulse — fish bite, cast */
export function hapticBite() { vibrate(50); }

/** Strong thud — fish caught, treasure landed */
export function hapticCatch() { vibrate([60, 40, 100]); }

/** Sharp snap — line broke */
export function hapticSnap() { vibrate([120, 60, 120]); }

/** Coins reward */
export function hapticCoins() { vibrate([30, 20, 30, 20, 50]); }
