import type {
  CinematicEventPrefab,
  CinematicTargetRef,
} from "@/game/types/cinematic-event";

type PrefabStep = CinematicEventPrefab["steps"][number];

export interface TimeSegment {
  durationMs: number;
  startMs: number;
}

export interface SpriteMoveSegment extends TimeSegment {
  from: CinematicTargetRef;
  fromOpacity?: number;
  to: CinematicTargetRef;
  toOpacity?: number;
}

export interface RacerMoveSegment extends TimeSegment {
  from?: CinematicTargetRef;
  fromOpacity?: number;
  racerId: string;
  to: CinematicTargetRef;
  toOpacity?: number;
}

/**
 * Build steps for moving a cinematic sprite from A → B over a duration.
 * Engine-level easing is applied when sampling between these keyframes.
 */
export function buildSpriteMoveSteps(segment: SpriteMoveSegment): PrefabStep[] {
  const endMs = segment.startMs + segment.durationMs;

  const startStep: PrefabStep = {
    atMs: segment.startMs,
    eventSprite: {
      position: segment.from,
      ...(segment.fromOpacity !== undefined
        ? { opacity: segment.fromOpacity }
        : {}),
    },
  };

  const endStep: PrefabStep = {
    atMs: endMs,
    eventSprite: {
      position: segment.to,
      ...(segment.toOpacity !== undefined
        ? { opacity: segment.toOpacity }
        : {}),
    },
  };

  return normalizeSteps([startStep, endStep]);
}

/**
 * Build steps for moving a specific racer via position override over time.
 * This is useful for scripted pulls/teleports relative to anchors.
 */
export function buildRacerMoveSteps(segment: RacerMoveSegment): PrefabStep[] {
  const endMs = segment.startMs + segment.durationMs;

  const steps: PrefabStep[] = [];

  if (segment.from) {
    const startStep: PrefabStep = {
      atMs: segment.startMs,
      racers: [
        {
          racerId: segment.racerId,
          position: {
            target: segment.from,
            ...(segment.fromOpacity !== undefined
              ? { opacity: segment.fromOpacity }
              : {}),
          },
        },
      ],
    };
    steps.push(startStep);
  }

  const endStep: PrefabStep = {
    atMs: endMs,
    racers: [
      {
        racerId: segment.racerId,
        position: {
          target: segment.to,
          ...(segment.toOpacity !== undefined
            ? { opacity: segment.toOpacity }
            : {}),
        },
      },
    ],
  };
  steps.push(endStep);

  return normalizeSteps(steps);
}

/**
 * Merge multiple step arrays, sort by time, and merge compatible entries
 * at the same timestamp so prefab authors can compose segments ergonomically.
 */
export function mergeStepArrays(
  ...arrays: PrefabStep[][]
): CinematicEventPrefab["steps"] {
  const flat = arrays.flat();
  return normalizeSteps(flat);
}

export function makeSpriteStep(params: {
  atMs: number;
  target: CinematicTargetRef;
  opacity?: number;
}): PrefabStep {
  return {
    atMs: params.atMs,
    eventSprite: {
      position: params.target,
      ...(params.opacity !== undefined ? { opacity: params.opacity } : {}),
    },
  };
}

export function makeRacerVelocityStep(params: {
  atMs: number;
  racerId: string;
  velocityMultiplier: number;
  animState?: string;
}): PrefabStep {
  return {
    atMs: params.atMs,
    racers: [
      {
        racerId: params.racerId,
        velocityMultiplier: params.velocityMultiplier,
        ...(params.animState ? { animState: params.animState } : {}),
      },
    ],
  };
}

export function makeRacerPositionStep(params: {
  atMs: number;
  racerId: string;
  target: CinematicTargetRef;
  opacity?: number;
  animState?: string;
  velocityMultiplier?: number;
  isDestroyed?: boolean;
}): PrefabStep {
  return {
    atMs: params.atMs,
    racers: [
      {
        racerId: params.racerId,
        ...(params.velocityMultiplier !== undefined
          ? { velocityMultiplier: params.velocityMultiplier }
          : {}),
        ...(params.animState ? { animState: params.animState } : {}),
        position: {
          target: params.target,
          ...(params.opacity !== undefined ? { opacity: params.opacity } : {}),
        },
        ...(params.isDestroyed ? { isDestroyed: params.isDestroyed } : {}),
      },
    ],
  };
}

function normalizeSteps(steps: PrefabStep[]): PrefabStep[] {
  const sorted = [...steps].sort((a, b) => a.atMs - b.atMs);
  const out: PrefabStep[] = [];

  for (const step of sorted) {
    const last = out.at(-1);
    if (!last || last.atMs !== step.atMs) {
      out.push({ ...step });
      continue;
    }
    out[out.length - 1] = mergeSteps(last, step);
  }

  return out;
}

function mergeSteps(a: PrefabStep, b: PrefabStep): PrefabStep {
  const mergedRacers = mergeRacerArrays(a.racers, b.racers);

  return {
    atMs: a.atMs,
    eventSprite: {
      ...(a.eventSprite ?? {}),
      ...(b.eventSprite ?? {}),
    },
    ...(mergedRacers.length > 0 ? { racers: mergedRacers } : {}),
  };
}

function mergeRacerArrays(
  a: PrefabStep["racers"],
  b: PrefabStep["racers"]
): NonNullable<PrefabStep["racers"]> {
  const byId = new Map<string, NonNullable<PrefabStep["racers"]>[number]>();

  for (const src of [a, b]) {
    for (const r of src ?? []) {
      const prev = byId.get(r.racerId);
      if (prev) {
        byId.set(r.racerId, {
          racerId: r.racerId,
          animState: r.animState ?? prev.animState,
          velocityMultiplier: r.velocityMultiplier ?? prev.velocityMultiplier,
          position: {
            ...(prev.position ?? {}),
            ...(r.position ?? {}),
          },
          isDestroyed: r.isDestroyed ?? prev.isDestroyed,
        });
      } else {
        byId.set(r.racerId, { ...r });
      }
    }
  }

  return [...byId.values()];
}
