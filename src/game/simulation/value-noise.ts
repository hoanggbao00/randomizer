import { clamp } from "@/game/utils/clamp";

/**
 * Deterministic 1D value noise (smooth pseudo-random over time).
 * - No dependencies
 * - No bitwise ops
 * - Stable across runs for same seed + key
 */
export class ValueNoise1D {
  private readonly seed: string;
  private readonly key: string;

  constructor(seed: string, key: string) {
    this.seed = seed;
    this.key = key;
  }

  /**
   * Returns noise in [-1, 1] for a given time (seconds).
   * frequencyHz controls how quickly it changes.
   */
  sample(tSec: number, frequencyHz: number): number {
    const x = tSec * Math.max(0.0001, frequencyHz);
    const i0 = Math.floor(x);
    const i1 = i0 + 1;
    const f = x - i0;

    const v0 = this.randUnit(i0);
    const v1 = this.randUnit(i1);
    const u = fade(f);
    const v = v0 + (v1 - v0) * u; // [0,1]
    return v * 2 - 1; // [-1,1]
  }

  private randUnit(i: number): number {
    // Hash (seed + key + i) to [0,1)
    const s = `${this.seed}|${this.key}|${i}`;
    let hash = 0;
    for (let c = 0; c < s.length; c++) {
      hash = (hash * 31 + s.charCodeAt(c)) % 2_147_483_647;
    }
    const unit = (hash % 1_000_000) / 1_000_000;
    return clamp(unit, 0, 0.999_999);
  }
}

function fade(t: number): number {
  // Smoothstep-ish: 6t^5 - 15t^4 + 10t^3
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;
  return 6 * t5 - 15 * t4 + 10 * t3;
}
