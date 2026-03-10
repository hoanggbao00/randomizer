import type { EventTypeDefinition, RaceEvent, RaceEventTypeId } from "./event";
import type { RaceDirection } from "./race";
import type { RacerAnimState } from "./racer";

export interface TimelineKeyframe {
  activeEventIds: string[];
  animState: RacerAnimState;
  speedPxPerSec: number;
  tMs: number;
  /** Absolute world position in pixels, not 0-1 */
  worldMain: number;
}

export interface RacerTimeline {
  finalRank: number;
  /** Infinity if eliminated before finish */
  finishMs: number;
  keyframes: TimelineKeyframe[];
  racerId: string;
}

export interface PrecomputedScenario {
  direction: RaceDirection;
  durationMs: number;
  events: RaceEvent[];
  eventTypes: Record<RaceEventTypeId, EventTypeDefinition>;
  mode?: "PRECOMPUTED";
  racerTimelines: Record<string, RacerTimeline>;
  rankings: Array<{ racerId: string; rank: number; finishMs: number }>;
  seed: string;
  trackLengthPx: number;
  winnerRacerId: string;
}
