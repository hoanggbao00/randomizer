export type RaceDirection = "LTR" | "RTL" | "TTB" | "BTT";

export interface RaceConfig {
  allowElimination: boolean;
  backgroundImage?: string;
  direction: RaceDirection;
  /**
   * Enabled cinematic event packs (by prefab id).
   * If undefined, all built-in packs are considered enabled.
   */
  enabledCinematicPacks?: string[];
  /** 0-1, controls how many events per racer */
  eventDensity: number;
  maxRacers: number;
  minDurationMs: number;
  /**
   * Scenario architecture.
   * - PRECOMPUTED: legacy (winner pre-scripted via timelines)
   * - EVENT_DRIVEN: new (runtime simulation; winner emerges)
   */
  scenarioMode?: "PRECOMPUTED" | "EVENT_DRIVEN";
  seed: string;
  /**
   * Selected character sprite ids (from mock/characters or real assets).
   * Used to assign assetIds to racers at race start.
   */
  selectedCharacterIds?: string[];
  targetDurationMs: number;
  /** Computed from viewport at race start */
  trackLengthPx: number;
}

export interface RaceResult {
  durationMs: number;
  rankings: Array<{ racerId: string; rank: number; finishMs: number }>;
  seed: string;
  winnerRacerId: string;
}

export interface StartRaceInput {
  config: RaceConfig;
  rawNames: string;
}
