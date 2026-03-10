import type { RacerAnimState } from "./racer";

/** Built-in event type IDs */
export type BuiltinEventTypeId = "BOOST" | "SLOW" | "STUN" | "ELIMINATE";

/** Community event type IDs are prefixed with community: */
export type CommunityEventTypeId = `community:${string}`;

export type RaceEventTypeId = BuiltinEventTypeId | CommunityEventTypeId;

export interface EventEffect {
  /** Added to acceleration in px/s² */
  accelDelta: number;
  /** true = freeze progress, used by ELIMINATE */
  progressLock: boolean;
  /** 1.0 = no change, 1.5 = 50% faster, 0 = stopped */
  speedMultiplier: number;
}

export interface EventTypeDefinition {
  /**
   * Animation state override during event.
   * Can point to any state key from racer spritesheet, including core states.
   * null = keep current animation state.
   */
  animStateOverride: RacerAnimState | null;
  description: string;
  displayName: string;
  /** Effect applied to racer during event */
  effect: EventEffect;
  icon?: string;
  /** Priority for stacking resolution: higher wins */
  priority: number;
  /** Can this event stack with same type? */
  selfStackable: boolean;
  /** SFX key to play on trigger */
  sfxKey?: string;
  typeId: RaceEventTypeId;
  /** Visual particle effect key */
  vfxKey?: string;
}

export interface RaceEvent {
  durationMs: number;
  id: string;
  /** Scales the effect intensity */
  magnitude: number;
  racerId: string;
  startMs: number;
  typeId: RaceEventTypeId;
}
