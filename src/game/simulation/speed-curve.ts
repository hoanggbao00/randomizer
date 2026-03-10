import type { SeededRng } from "./seeded-rng";

/**
 * Generates a smooth speed curve for a racer as an array of speed values.
 * Each value represents speed in px/s at that control point.
 *
 * Uses smooth noise by averaging adjacent random values.
 */
export function generateSpeedCurve(
  rng: SeededRng,
  targetAvgSpeed: number,
  segmentCount: number,
  perturbFactor = 0.3
): number[] {
  // Generate raw random values
  const raw: number[] = [];
  for (let i = 0; i <= segmentCount; i++) {
    raw.push(rng.floatRange(1 - perturbFactor, 1 + perturbFactor));
  }

  // Smooth by averaging neighbors (simple box filter)
  const smoothed: number[] = [];
  for (let i = 0; i <= segmentCount; i++) {
    const prev = i > 0 ? raw[i - 1] : raw[i];
    const next = i < segmentCount ? raw[i + 1] : raw[i];
    smoothed.push((prev + raw[i] + next) / 3);
  }

  // Scale to target average speed
  const avg = smoothed.reduce((sum, v) => sum + v, 0) / smoothed.length;
  const scale = targetAvgSpeed / avg;

  return smoothed.map((v) => Math.max(v * scale, 10));
}

/**
 * Integrates a speed curve to compute cumulative distance at each segment.
 * Returns array of worldMain positions at each segment boundary.
 */
export function integrateCurve(
  speedCurve: number[],
  segmentDurationMs: number
): number[] {
  const positions: number[] = [0];
  let cumulative = 0;

  for (let i = 0; i < speedCurve.length - 1; i++) {
    const avgSpeed = (speedCurve[i] + speedCurve[i + 1]) / 2;
    cumulative += avgSpeed * (segmentDurationMs / 1000);
    positions.push(cumulative);
  }

  return positions;
}

/**
 * Scales a speed curve so that the racer reaches exactly targetDistance
 * at the end of the timeline.
 */
export function normalizeCurve(
  speedCurve: number[],
  segmentDurationMs: number,
  targetDistance: number
): number[] {
  const positions = integrateCurve(speedCurve, segmentDurationMs);
  const actualDistance = positions.at(-1) ?? 0;

  if (actualDistance <= 0) {
    return speedCurve;
  }

  const scale = targetDistance / actualDistance;
  return speedCurve.map((v) => v * scale);
}
