export type RaceDirection = "LTR" | "RTL" | "TTB" | "BTT";

export interface RaceConfig {
  allowElimination: boolean;
  backgroundImage?: string;
  direction: RaceDirection;
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
