import type { RacerRuntimeState } from "@/game/types/racer";
import type { characters } from "@/mock/racers";

interface RacerVisualStub {
  color: number;
}

const DEFAULT_COLORS = [
  0xe7_4c_3c, 0x34_98_db, 0x2e_cc_71, 0xf3_9c_12, 0x9b_59_b6, 0x1a_bc_9c,
  0xe6_7e_22, 0x34_49_5e, 0xf1_c4_0f, 0x16_a0_85,
];

export class AssetManager {
  private readonly racerColorCache = new Map<string, number>();
  private readonly colorCycle: number[];

  constructor() {
    this.colorCycle = [...DEFAULT_COLORS];
  }

  getRacerVisual(racerId: string): RacerVisualStub {
    const fromCache = this.racerColorCache.get(racerId);
    if (fromCache !== undefined) {
      return { color: fromCache };
    }

    // Simple deterministic color picking based on racerId hash.
    const index = this.hashToIndex(racerId, this.colorCycle.length);
    const fallbackColor = this.colorCycle[0] ?? 0x34_98_db;
    const color = this.colorCycle[index] ?? fallbackColor;
    this.racerColorCache.set(racerId, color);

    return { color };
  }

  // Placeholder for future racer → character mapping.
  // For now this just demonstrates how mock characters could be wired.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mapRacerToCharacter(state: RacerRuntimeState): string | null {
    return this.mapRacerIdToCharacter(state.racerId);
  }

  private hashToIndex(input: string, modulo: number): number {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
      hash = hash * 31 + input.charCodeAt(index);
    }
    const positiveHash = Math.abs(hash);
    return positiveHash % Math.max(1, modulo);
  }

  private mapRacerIdToCharacter(
    racerId: string
  ): keyof typeof characters | null {
    const normalized = racerId.toLowerCase();

    if (normalized.includes("knight")) {
      return "knight";
    }

    return null;
  }
}

export const assetManager = new AssetManager();
