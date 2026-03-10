/** Linear interpolation between a and b by t in [0, 1] */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Exponential smoothing — natural feel for speed transitions.
 * k controls smoothing speed: higher k = faster response.
 */
export function expSmooth(
  current: number,
  target: number,
  k: number,
  dtSec: number
): number {
  const alpha = 1 - Math.exp(-k * dtSec);
  return current + alpha * (target - current);
}
