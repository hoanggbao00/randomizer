export interface RacerInput {
  assetId?: string;
  id: string;
  name: string;
}

/** Core animation states always supported by default profile */
export type CoreRacerAnimState = "idle" | "running" | "lose" | "win";

/**
 * Animation state is extensible.
 * - Core states are fixed and always supported.
 * - Community can provide additional arbitrary states via spritesheet manifest.
 * - Events can map to any state key defined in the racer's spritesheet.
 */
export type RacerAnimState = CoreRacerAnimState | (string & {});

export interface RacerRuntimeState {
  accelPxPerSec2: number;
  activeEventIds: string[];
  animState: RacerAnimState;
  isEliminated: boolean;
  isFinished: boolean;
  laneIndex: number;
  /** Optional render hint, used by cinematic events */
  opacity?: number;
  racerId: string;
  speedPxPerSec: number;
  /** World position along cross axis: lane center */
  worldCross: number;
  /** World position along main axis: 0 → trackLength */
  worldMain: number;
}
