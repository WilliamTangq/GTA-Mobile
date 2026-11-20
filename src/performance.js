// Slow changes with a recovery cooldown prevent resolution oscillation.
export function createAdaptiveQuality() {
  let ema = 16.7,
    samples = 0,
    elapsed = 0,
    lastChange = -10;
  let scale = 1.1;
  return {
    get scale() {
      return scale;
    },
    get fps() {
      return Math.round(1000 / ema);
    },
    sample(frameMs) {
      if (!Number.isFinite(frameMs) || frameMs < 3 || frameMs > 180)
        return false;
      ema += 0.035 * (frameMs - ema);
      elapsed += frameMs / 1000;
      samples++;
      if (samples < 70 || elapsed - lastChange < 5) return false;
      if (ema > 29 && scale > 0.65) {
        scale = Math.max(0.65, +(scale - 0.1).toFixed(2));
        lastChange = elapsed;
        return true;
      }
      if (ema < 18.5 && scale < 1.1 && elapsed - lastChange > 9) {
        scale = Math.min(1.1, +(scale + 0.05).toFixed(2));
        lastChange = elapsed;
        return true;
      }
      return false;
    },
  };
}
