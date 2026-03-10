import type {
  CinematicEventInstance,
  CinematicEventPrefab,
} from "./cinematic-event";
import type { RaceEvent } from "./event";
import type { RaceDirection } from "./race";

export type ScenarioMode = "PRECOMPUTED" | "EVENT_DRIVEN";

/**
 * Event-driven scenario: runtime simulation + scheduled gameplay events.
 * Winner is NOT predetermined; it emerges from simulation.
 */
export interface EventDrivenScenario {
  /**
   * Phase B: scripted/cinematic events (optional).
   * Scheduled at start; can move sprites and directly affect racer position/velocity.
   */
  cinematic?: {
    prefabs: CinematicEventPrefab[];
    instances: CinematicEventInstance[];
  };
  direction: RaceDirection;
  durationMs: number;
  /**
   * Scheduled events (time-based). Effects are applied by the simulation engine.
   * Rendering can independently listen to "eventTriggered" for VFX/SFX.
   */
  events: RaceEvent[];
  mode: "EVENT_DRIVEN";
  seed: string;
  trackLengthPx: number;
}
