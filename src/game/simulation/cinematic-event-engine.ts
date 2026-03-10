import type {
  CinematicEventInstance,
  CinematicEventPrefab,
  CinematicFrame,
  CinematicRacerEffect,
  CinematicTargetRef,
} from "@/game/types/cinematic-event";
import type { RacerAnimState } from "@/game/types/racer";
import type { EventDrivenScenario } from "@/game/types/scenario";
import { clamp } from "@/game/utils/clamp";

interface SetupInput {
  scenario: EventDrivenScenario;
}

export class CinematicEventEngine {
  private prefabsById = new Map<string, CinematicEventPrefab>();
  private instances: CinematicEventInstance[] = [];

  reset(): void {
    this.prefabsById = new Map();
    this.instances = [];
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
    const acc: CinematicFrame = { sprites: [], racerEffects: {} };
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

    const result = this.evaluatePrefab(prefab, localMs, params.racerPositions);

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
  }

  private evaluatePrefab(
    prefab: CinematicEventPrefab,
    localMs: number,
    racerPositions: Record<string, { worldMain: number; worldCross: number }>
  ): {
    racerEffects: Record<string, CinematicRacerEffect>;
    spriteOpacity: number;
    spritePos: { worldMain: number; worldCross: number } | null;
  } {
    let spriteOpacity = 1;
    let spritePos: { worldMain: number; worldCross: number } | null = null;
    const racerEffects: Record<string, CinematicRacerEffect> = {};

    const steps = [...prefab.steps].sort((a, b) => a.atMs - b.atMs);
    for (const step of steps) {
      if (step.atMs > localMs) {
        break;
      }
      if (step.eventSprite?.opacity !== undefined) {
        spriteOpacity = step.eventSprite.opacity;
      }
      if (step.eventSprite?.position) {
        spritePos = resolveTarget(step.eventSprite.position, racerPositions);
      }
      this.applyRacerStep(step.racers ?? [], racerPositions, racerEffects);
    }

    return { spriteOpacity, spritePos, racerEffects };
  }

  private applyRacerStep(
    racers: Array<{
      racerId: string;
      animState?: RacerAnimState;
      velocityMultiplier?: number;
      position?: { opacity?: number; target: CinematicTargetRef };
      isDestroyed?: boolean;
    }>,
    racerPositions: Record<string, { worldMain: number; worldCross: number }>,
    racerEffects: Record<string, CinematicRacerEffect>
  ): void {
    for (const r of racers) {
      const prev = racerEffects[r.racerId] ?? {};
      const next: CinematicRacerEffect = { ...prev };

      if (r.animState) {
        next.animState = r.animState;
      }
      if (r.velocityMultiplier !== undefined) {
        next.velocityMultiplier = r.velocityMultiplier;
      }
      if (r.position) {
        next.positionOverride = resolveTarget(
          r.position.target,
          racerPositions
        );
        if (r.position.opacity !== undefined) {
          next.opacity = r.position.opacity;
        }
      }
      if (r.isDestroyed !== undefined) {
        next.isDestroyed = r.isDestroyed;
      }

      racerEffects[r.racerId] = next;
    }
  }
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
  racerPositions: Record<string, { worldMain: number; worldCross: number }>
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
