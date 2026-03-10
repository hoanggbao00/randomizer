import type { RacerVisualProfile } from "./asset";
import type { RacerAnimState } from "./racer";

export interface AnimationBinding {
  currentState: RacerAnimState;
  profile: RacerVisualProfile;
  racerId: string;
}

/**
 * State fallback chain when resolving animation frames:
 * 1. requested state
 * 2. 'running'
 * 3. 'idle'
 */
export type AnimationFallbackChain = readonly ["running", "idle"];
