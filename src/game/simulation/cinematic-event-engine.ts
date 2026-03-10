import type {
  CinematicEventInstance,
  CinematicEventPrefab,
  CinematicFrame,
  CinematicRacerEffect,
  CinematicTargetRef,
} from "@/game/types/cinematic-event";
import type { EventDrivenScenario } from "@/game/types/scenario";
import { clamp } from "@/game/utils/clamp";
import { easeInOutQuad } from "@/game/utils/easing";
import { lerp } from "@/game/utils/lerp";

interface SetupInput {
  scenario: EventDrivenScenario;
}

export class CinematicEventEngine {
  private prefabsById = new Map<string, CinematicEventPrefab>();
  private instances: CinematicEventInstance[] = [];
  /**
   * Anchor racer positions at the moment an instance first becomes active.
   * Used so RACER-relative targets don't drift as physics updates.
   */
  private anchors = new Map<
    string,
    Record<string, { worldMain: number; worldCross: number }>
  >();

  reset(): void {
    this.prefabsById = new Map();
    this.instances = [];
    this.anchors = new Map();
  }

  setup(input: SetupInput): void {
    this.reset();
    const cinematic = input.scenario.cinematic;
    if (!cinematic) {
      return;
    }
    for (const prefab of cinematic.prefabs) {
      this.prefabsById.set(prefab.prefabId, prefab);
    }
    this.instances = cinematic.instances;
  }

  computeFrame(params: {
    elapsedMs: number;
    racerPositions: Record<string, { worldMain: number; worldCross: number }>;
    trackLengthPx: number;
  }): CinematicFrame {
    const acc: CinematicFrame = {
      sprites: [],
      racerEffects: {},
      debugLabels: [],
    };
    for (const inst of this.instances) {
      this.applyInstanceFrame(inst, params, acc);
    }
    return acc;
  }

  private applyInstanceFrame(
    inst: CinematicEventInstance,
    params: {
      elapsedMs: number;
      racerPositions: Record<string, { worldMain: number; worldCross: number }>;
      trackLengthPx: number;
    },
    acc: CinematicFrame
  ): void {
    const localMs = params.elapsedMs - inst.startMs;
    if (localMs < 0 || localMs > inst.durationMs) {
      return;
    }

    const prefab = this.prefabsById.get(inst.prefabId);
    if (!prefab) {
      return;
    }

    const anchor =
      this.anchors.get(inst.id) ??
      this.snapshotAnchors(inst.id, params.racerPositions);

    const result = this.evaluatePrefab(prefab, localMs, anchor);

    if (result.spritePos) {
      acc.sprites.push({
        id: inst.id,
        opacity: clamp(result.spriteOpacity, 0, 1),
        worldMain: clamp(result.spritePos.worldMain, 0, params.trackLengthPx),
        worldCross: result.spritePos.worldCross,
      });
    }

    for (const [racerId, fx] of Object.entries(result.racerEffects)) {
      const prev = acc.racerEffects[racerId] ?? {};
      acc.racerEffects[racerId] = mergeEffects(prev, fx);
    }

    if (result.debugLabel) {
      acc.debugLabels?.push(result.debugLabel);
    }
  }

  private evaluatePrefab(
    prefab: CinematicEventPrefab,
    localMs: number,
    racerPositions: Record<string, { worldMain: number; worldCross: number }>
  ): {
    racerEffects: Record<string, CinematicRacerEffect>;
    spriteOpacity: number;
    spritePos: { worldMain: number; worldCross: number } | null;
    debugLabel?: string;
  } {
    const steps = [...prefab.steps].sort((a, b) => a.atMs - b.atMs);

    const sprite = sampleEventSprite(steps, localMs, racerPositions);
    const racerEffects = sampleRacerEffects(steps, localMs, racerPositions);

    const activeTargets = new Set<string>();
    for (const step of steps) {
      if (step.atMs > localMs) {
        break;
      }
      for (const r of step.racers ?? []) {
        activeTargets.add(r.racerId);
      }
    }

    const debugLabel =
      activeTargets.size > 0
        ? `${prefab.prefabId} → [${[...activeTargets].join(", ")}]`
        : undefined;

    return {
      spriteOpacity: sprite.opacity,
      spritePos: sprite.pos,
      racerEffects,
      debugLabel,
    };
  }

  private snapshotAnchors(
    instanceId: string,
    current: RacerPositions
  ): RacerPositions {
    const snapshot: RacerPositions = {};
    for (const [id, pos] of Object.entries(current)) {
      snapshot[id] = { worldMain: pos.worldMain, worldCross: pos.worldCross };
    }
    this.anchors.set(instanceId, snapshot);
    return snapshot;
  }
}

type Step = CinematicEventPrefab["steps"][number];

type RacerPositions = Record<string, { worldMain: number; worldCross: number }>;

function sampleEventSprite(
  steps: Step[],
  localMs: number,
  racerPositions: RacerPositions
): { opacity: number; pos: { worldMain: number; worldCross: number } | null } {
  const opacity = sampleKeyframedNumber({
    steps,
    localMs,
    get: (s) => s.eventSprite?.opacity,
  });

  const pos = sampleKeyframedPosition({
    steps,
    localMs,
    get: (s) => s.eventSprite?.position,
    racerPositions,
  });

  return { opacity: opacity ?? 1, pos };
}

function sampleRacerEffects(
  steps: Step[],
  localMs: number,
  racerPositions: RacerPositions
): Record<string, CinematicRacerEffect> {
  // For Phase B:
  // - animState/velocity/isDestroyed are discrete (last step <= t wins)
  // - position/opacity are keyframed (interpolated)
  const racers = collectMentionedRacers(steps);
  const out: Record<string, CinematicRacerEffect> = {};

  for (const racerId of racers) {
    const discrete = sampleDiscreteRacerFields(steps, localMs, racerId);
    const pos = sampleKeyframedPosition({
      steps,
      localMs,
      get: (s) => getRacerPositionTarget(s, racerId),
      racerPositions,
    });
    const opacity = sampleKeyframedNumber({
      steps,
      localMs,
      get: (s) => getRacerPositionOpacity(s, racerId),
    });

    const fx: CinematicRacerEffect = { ...discrete };
    if (pos) {
      fx.positionOverride = pos;
    }
    if (opacity !== undefined) {
      fx.opacity = opacity;
    }

    if (Object.keys(fx).length > 0) {
      out[racerId] = fx;
    }
  }

  return out;
}

function collectMentionedRacers(steps: Step[]): Set<string> {
  const set = new Set<string>();
  for (const step of steps) {
    for (const r of step.racers ?? []) {
      set.add(r.racerId);
    }
  }
  return set;
}

function sampleDiscreteRacerFields(
  steps: Step[],
  localMs: number,
  racerId: string
): Pick<
  CinematicRacerEffect,
  "animState" | "velocityMultiplier" | "isDestroyed"
> {
  let animState: CinematicRacerEffect["animState"];
  let velocityMultiplier: CinematicRacerEffect["velocityMultiplier"];
  let isDestroyed: CinematicRacerEffect["isDestroyed"];

  for (const step of steps) {
    if (step.atMs > localMs) {
      break;
    }
    const r = step.racers?.find((x) => x.racerId === racerId);
    if (!r) {
      continue;
    }
    if (r.animState) {
      animState = r.animState;
    }
    if (r.velocityMultiplier !== undefined) {
      velocityMultiplier = r.velocityMultiplier;
    }
    if (r.isDestroyed !== undefined) {
      isDestroyed = r.isDestroyed;
    }
  }

  return {
    ...(animState ? { animState } : {}),
    ...(velocityMultiplier !== undefined ? { velocityMultiplier } : {}),
    ...(isDestroyed !== undefined ? { isDestroyed } : {}),
  };
}

function getRacerPositionTarget(
  step: Step,
  racerId: string
): CinematicTargetRef | undefined {
  const r = step.racers?.find((x) => x.racerId === racerId);
  return r?.position?.target;
}

function getRacerPositionOpacity(
  step: Step,
  racerId: string
): number | undefined {
  const r = step.racers?.find((x) => x.racerId === racerId);
  return r?.position?.opacity;
}

function sampleKeyframedNumber(input: {
  steps: Step[];
  localMs: number;
  get: (s: Step) => number | undefined;
}): number | undefined {
  const kf = collectKeyframes(input.steps, input.get);
  return sampleNumberKeyframes(kf, input.localMs);
}

function sampleKeyframedPosition(input: {
  steps: Step[];
  localMs: number;
  get: (s: Step) => CinematicTargetRef | undefined;
  racerPositions: RacerPositions;
}): { worldMain: number; worldCross: number } | null {
  const kf = collectKeyframes(input.steps, (s) => input.get(s));
  if (kf.length === 0) {
    return null;
  }

  const a = findPrevKeyframe(kf, input.localMs);
  const b = findNextKeyframe(kf, input.localMs);

  const posA = resolveTarget(a.value, input.racerPositions);
  if (!b) {
    return posA;
  }
  const posB = resolveTarget(b.value, input.racerPositions);
  const t = clamp(
    (input.localMs - a.atMs) / Math.max(1, b.atMs - a.atMs),
    0,
    1
  );
  return {
    worldMain: lerp(posA.worldMain, posB.worldMain, easeInOutQuad(t)),
    worldCross: lerp(posA.worldCross, posB.worldCross, easeInOutQuad(t)),
  };
}

function collectKeyframes<T>(
  steps: Step[],
  get: (s: Step) => T | undefined
): Array<{ atMs: number; value: T }> {
  const out: Array<{ atMs: number; value: T }> = [];
  for (const step of steps) {
    const v = get(step);
    if (v !== undefined) {
      out.push({ atMs: step.atMs, value: v });
    }
  }
  return out;
}

function sampleNumberKeyframes(
  kf: Array<{ atMs: number; value: number }>,
  localMs: number
): number | undefined {
  if (kf.length === 0) {
    return undefined;
  }
  const a = findPrevKeyframe(kf, localMs);
  const b = findNextKeyframe(kf, localMs);
  if (!b) {
    return a.value;
  }
  const t = clamp((localMs - a.atMs) / Math.max(1, b.atMs - a.atMs), 0, 1);
  return lerp(a.value, b.value, easeInOutQuad(t));
}

function findPrevKeyframe<T>(
  kf: Array<{ atMs: number; value: T }>,
  localMs: number
): { atMs: number; value: T } {
  let prev = kf[0];
  for (const k of kf) {
    if (k.atMs <= localMs) {
      prev = k;
      continue;
    }
    break;
  }
  return prev;
}

function findNextKeyframe<T>(
  kf: Array<{ atMs: number; value: T }>,
  localMs: number
): { atMs: number; value: T } | null {
  for (const k of kf) {
    if (k.atMs > localMs) {
      return k;
    }
  }
  return null;
}

function mergeEffects(
  prev: CinematicRacerEffect,
  next: CinematicRacerEffect
): CinematicRacerEffect {
  // Last-write wins per field.
  return { ...prev, ...next };
}

function resolveTarget(
  ref: CinematicTargetRef,
  racerPositions: RacerPositions
): { worldMain: number; worldCross: number } {
  switch (ref.kind) {
    case "ABS":
      return { worldMain: ref.worldMain, worldCross: ref.worldCross };
    case "RACER": {
      const base = racerPositions[ref.racerId] ?? {
        worldMain: 0,
        worldCross: 0,
      };
      return {
        worldMain: base.worldMain + (ref.dMain ?? 0),
        worldCross: base.worldCross + (ref.dCross ?? 0),
      };
    }
    default: {
      const _exhaustive: never = ref;
      throw new Error(`Unknown target ref: ${_exhaustive}`);
    }
  }
}
