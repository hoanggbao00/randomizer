import type {
  EventEffect,
  RaceEvent,
  RaceEventTypeId,
} from "@/game/types/event";
import type { RacerAnimState } from "@/game/types/racer";
import { clamp } from "@/game/utils/clamp";
import type { EventRegistry } from "./event-registry";

const MAX_SPEED_MULTIPLIER = 3.0;
const MIN_SPEED_MULTIPLIER = 0.05;
const MAX_ACCEL_DELTA = 200;

export interface ResolvedEventEffect {
  accelDelta: number;
  animStateOverride: RacerAnimState | null;
  progressLock: boolean;
  speedMultiplier: number;
}

/**
 * Resolves the combined effect of multiple active events on a racer.
 *
 * Stacking rules:
 * 1. Sort by priority descending.
 * 2. If highest priority event has progressLock = true → lock, ignore rest.
 * 3. If highest priority event has animStateOverride → use it.
 * 4. Multiply all speedMultiplier values, capped at [MIN, MAX].
 * 5. Sum all accelDelta values, capped at [-MAX, MAX].
 */
export function resolveEventEffects(
  activeEventIds: string[],
  allEvents: RaceEvent[],
  registry: EventRegistry
): ResolvedEventEffect {
  if (activeEventIds.length === 0) {
    return {
      speedMultiplier: 1,
      accelDelta: 0,
      progressLock: false,
      animStateOverride: null,
    };
  }

  // Collect active event definitions sorted by priority descending
  const activeWithDefs = activeEventIds
    .map((id) => {
      const event = allEvents.find((e) => e.id === id);
      if (!event) {
        return null;
      }
      const def = registry.get(event.typeId as RaceEventTypeId);
      if (!def) {
        return null;
      }
      return { event, def };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.def.priority - a.def.priority);

  if (activeWithDefs.length === 0) {
    return {
      speedMultiplier: 1,
      accelDelta: 0,
      progressLock: false,
      animStateOverride: null,
    };
  }

  const highest = activeWithDefs[0];

  // If highest priority locks progress, return immediately
  if (highest.def.effect.progressLock) {
    return {
      speedMultiplier: 0,
      accelDelta: 0,
      progressLock: true,
      animStateOverride: highest.def.animStateOverride,
    };
  }

  // Combine effects
  let combinedMultiplier = 1;
  let combinedAccelDelta = 0;
  const animStateOverride = highest.def.animStateOverride;

  for (const { event, def } of activeWithDefs) {
    const scaledEffect = scaleEffect(def.effect, event.magnitude);
    combinedMultiplier *= scaledEffect.speedMultiplier;
    combinedAccelDelta += scaledEffect.accelDelta;
  }

  return {
    speedMultiplier: clamp(
      combinedMultiplier,
      MIN_SPEED_MULTIPLIER,
      MAX_SPEED_MULTIPLIER
    ),
    accelDelta: clamp(combinedAccelDelta, -MAX_ACCEL_DELTA, MAX_ACCEL_DELTA),
    progressLock: false,
    animStateOverride,
  };
}

function scaleEffect(effect: EventEffect, magnitude: number): EventEffect {
  // magnitude 1.0 = full effect, 0.5 = half effect
  const scaledMultiplier = 1 + (effect.speedMultiplier - 1) * magnitude;
  return {
    speedMultiplier: scaledMultiplier,
    accelDelta: effect.accelDelta * magnitude,
    progressLock: effect.progressLock,
  };
}
