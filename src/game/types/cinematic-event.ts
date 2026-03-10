import type { RacerAnimState } from "./racer";

export type CinematicTargetRef =
  | { kind: "ABS"; worldMain: number; worldCross: number }
  | { kind: "RACER"; racerId: string; dMain?: number; dCross?: number };

export interface CinematicEventPrefab {
  name: string;
  prefabId: string;
  /** Placeholder for future spritesheet source */
  source?: string;
  /**
   * Scripted steps (time-based). Engine evaluates all steps with atMs <= t.
   * Keep it minimal for Phase B vertical slice.
   */
  steps: Array<{
    atMs: number;
    eventSprite?: {
      opacity?: number;
      position?: CinematicTargetRef;
    };
    racers?: Array<{
      racerId: string;
      animState?: RacerAnimState;
      /** 1 = no change, 0 = stop, <1 = slow, >1 = boost */
      velocityMultiplier?: number;
      /** If set, overrides racer position (pull/teleport) */
      position?: {
        opacity?: number;
        target: CinematicTargetRef;
      };
      isDestroyed?: boolean;
    }>;
  }>;
}

export interface CinematicEventInstance {
  affectedRacerIds: string[];
  durationMs: number;
  id: string;
  prefabId: string;
  startMs: number;
}

export interface CinematicEventSpriteState {
  id: string;
  opacity: number;
  worldCross: number;
  worldMain: number;
}

export interface CinematicRacerEffect {
  animState?: RacerAnimState;
  isDestroyed?: boolean;
  opacity?: number;
  positionOverride?: { worldMain: number; worldCross: number };
  velocityMultiplier?: number;
}

export interface CinematicFrame {
  /** Optional debug labels per active instance (prefab/targets). */
  debugLabels?: string[];
  racerEffects: Record<string, CinematicRacerEffect>;
  sprites: CinematicEventSpriteState[];
}
