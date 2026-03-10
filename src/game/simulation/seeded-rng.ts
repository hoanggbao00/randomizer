/**
 * Seeded pseudo-random number generator using mulberry32 algorithm.
 * Same seed + same call sequence = identical results (reproducible).
 *
 * Uses only arithmetic operations to comply with Biome/Ultracite rules
 * that disallow bitwise operators in production code.
 */
export class SeededRng {
  private readonly state: number[];

  constructor(seed: string) {
    this.state = [this.hashString(seed)];
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % 2_147_483_647;
    }
    // Ensure non-zero seed
    return hash === 0 ? 1 : hash;
  }

  /** Returns a float in [0, 1) using mulberry32-inspired arithmetic */
  float(): number {
    // Advance state using linear congruential generator
    this.state[0] = (this.state[0] * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    // Normalize to [0, 1)
    return this.state[0] / 4_294_967_296;
  }

  /** Returns an integer in [min, max] inclusive */
  range(min: number, max: number): number {
    return Math.floor(this.float() * (max - min + 1)) + min;
  }

  /** Returns a float in [min, max) */
  floatRange(min: number, max: number): number {
    return this.float() * (max - min) + min;
  }

  /** Picks a random element from an array */
  pick<T>(arr: readonly T[]): T {
    return arr[this.range(0, arr.length - 1)];
  }

  /** Shuffles an array in-place using Fisher-Yates */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.range(0, i);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
}
