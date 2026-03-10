import { eventRegistry } from "@/game/events/event-registry";
import type {
  CinematicEventInstance,
  CinematicEventPrefab,
} from "@/game/types/cinematic-event";
import type { RaceEvent } from "@/game/types/event";
import type { RaceConfig } from "@/game/types/race";
import type { RacerAnimState, RacerInput } from "@/game/types/racer";
import type { EventDrivenScenario } from "@/game/types/scenario";
import type {
  PrecomputedScenario,
  RacerTimeline,
  TimelineKeyframe,
} from "@/game/types/timeline";
import { clamp } from "@/game/utils/clamp";
import { planEvents } from "./event-planner";
import { SeededRng } from "./seeded-rng";
import {
  generateSpeedCurve,
  integrateCurve,
  normalizeCurve,
} from "./speed-curve";

/** Keyframe sample interval in milliseconds */
const KEYFRAME_INTERVAL_MS = 50;

/** Number of speed curve control points */
const SEGMENT_COUNT = 60;

interface SimulatorInput {
  config: RaceConfig;
  racers: RacerInput[];
}

/**
 * Precomputes the full race scenario before playback begins.
 * Guarantees: correct winner, correct duration, natural-looking movement.
 */
export class RaceSimulator {
  /**
   * Legacy mode: precomputes full timelines and guarantees a predetermined winner.
   * Kept for backward compatibility.
   */
  generateScenario(input: SimulatorInput): PrecomputedScenario {
    const { racers, config } = input;

    if (racers.length === 0) {
      throw new Error("Cannot simulate race with no racers");
    }

    // Use timestamp as seed if none provided
    const seed = config.seed || String(Date.now());
    const rng = new SeededRng(seed);

    // Pick winner
    const winner = rng.pick(racers);
    const winnerRacerId = winner.id;

    // Assign finish times
    const finishTimes = this.assignFinishTimes(
      racers,
      winnerRacerId,
      config,
      rng
    );

    // Plan events
    const events = planEvents({
      racers,
      config,
      winnerRacerId,
      rng,
      finishTimes,
    });

    // Build timelines for each racer
    const racerTimelines: Record<string, RacerTimeline> = {};
    const segmentDurationMs = config.targetDurationMs / SEGMENT_COUNT;

    for (const racer of racers) {
      const finishMs = finishTimes[racer.id] ?? config.targetDurationMs;
      const isEliminated = finishMs === Number.POSITIVE_INFINITY;

      const racerEvents = events.filter((e) => e.racerId === racer.id);
      const timeline = this.buildRacerTimeline(
        racer.id,
        finishMs,
        isEliminated,
        config.trackLengthPx,
        segmentDurationMs,
        config.targetDurationMs,
        racerEvents,
        rng
      );

      racerTimelines[racer.id] = timeline;
    }

    // Compute rankings
    const rankings = this.computeRankings(racers, racerTimelines);

    // Collect event type definitions used
    const eventTypes = Object.fromEntries(
      eventRegistry.getAll().map((def) => [def.typeId, def])
    ) as PrecomputedScenario["eventTypes"];

    return {
      mode: "PRECOMPUTED",
      seed,
      winnerRacerId,
      durationMs: config.targetDurationMs,
      trackLengthPx: config.trackLengthPx,
      direction: config.direction,
      events,
      eventTypes,
      racerTimelines,
      rankings,
    };
  }

  /**
   * New mode: event-driven scenario (no predetermined winner).
   * Schedules events; winner emerges from runtime simulation.
   */
  generateEventDrivenScenario(input: SimulatorInput): EventDrivenScenario {
    const { racers, config } = input;

    if (racers.length === 0) {
      throw new Error("Cannot simulate race with no racers");
    }

    const seed = config.seed || String(Date.now());
    const rng = new SeededRng(seed);

    const events = planEvents({
      racers,
      config,
      rng,
    });

    const cinematic = buildTestPolicePullCinematic({
      racers,
      durationMs: config.targetDurationMs,
      rng,
    });

    return {
      mode: "EVENT_DRIVEN",
      seed,
      durationMs: config.targetDurationMs,
      trackLengthPx: config.trackLengthPx,
      direction: config.direction,
      events,
      cinematic,
    };
  }

  private assignFinishTimes(
    racers: RacerInput[],
    winnerRacerId: string,
    config: RaceConfig,
    rng: SeededRng
  ): Record<string, number> {
    const times: Record<string, number> = {};

    for (const racer of racers) {
      if (racer.id === winnerRacerId) {
        times[racer.id] = config.targetDurationMs;
        continue;
      }

      if (config.allowElimination && rng.float() < 0.15) {
        times[racer.id] = Number.POSITIVE_INFINITY;
        continue;
      }

      // Finish after winner by 0.5s to 3s
      times[racer.id] = config.targetDurationMs + rng.floatRange(500, 3000);
    }

    return times;
  }

  private buildRacerTimeline(
    racerId: string,
    finishMs: number,
    isEliminated: boolean,
    trackLengthPx: number,
    segmentDurationMs: number,
    totalDurationMs: number,
    racerEvents: RaceEvent[],
    rng: SeededRng
  ): RacerTimeline {
    const targetDistance = isEliminated
      ? trackLengthPx * rng.floatRange(0.3, 0.7)
      : trackLengthPx;

    const targetAvgSpeed = targetDistance / (finishMs / 1000);

    // Generate and normalize speed curve
    let speedCurve = generateSpeedCurve(rng, targetAvgSpeed, SEGMENT_COUNT);
    speedCurve = normalizeCurve(speedCurve, segmentDurationMs, targetDistance);

    // Build keyframes at fixed intervals
    const keyframes = this.sampleKeyframes(
      speedCurve,
      segmentDurationMs,
      totalDurationMs,
      trackLengthPx,
      isEliminated,
      racerEvents
    );

    // Determine final rank (will be overwritten by computeRankings)
    return {
      racerId,
      keyframes,
      finalRank: 0,
      finishMs,
    };
  }

  private sampleKeyframes(
    speedCurve: number[],
    segmentDurationMs: number,
    totalDurationMs: number,
    trackLengthPx: number,
    isEliminated: boolean,
    racerEvents: RaceEvent[]
  ): TimelineKeyframe[] {
    const positions = integrateCurve(speedCurve, segmentDurationMs);
    const keyframes: TimelineKeyframe[] = [];

    let tMs = 0;
    while (tMs <= totalDurationMs) {
      // Interpolate position from curve
      const segIndex = tMs / segmentDurationMs;
      const segFloor = Math.floor(segIndex);
      const segFrac = segIndex - segFloor;

      const posA = positions[Math.min(segFloor, positions.length - 1)] ?? 0;
      const posB =
        positions[Math.min(segFloor + 1, positions.length - 1)] ?? posA;
      const worldMain = clamp(posA + (posB - posA) * segFrac, 0, trackLengthPx);

      // Determine active events at this time
      const activeEventIds = racerEvents
        .filter((e) => e.startMs <= tMs && tMs < e.startMs + e.durationMs)
        .map((e) => e.id);

      // Determine animation state
      const animState = this.resolveAnimState(
        activeEventIds,
        racerEvents,
        isEliminated,
        worldMain >= trackLengthPx
      );

      // Interpolate speed
      const speedA = speedCurve[Math.min(segFloor, speedCurve.length - 1)] ?? 0;
      const speedB =
        speedCurve[Math.min(segFloor + 1, speedCurve.length - 1)] ?? speedA;
      const speedPxPerSec = speedA + (speedB - speedA) * segFrac;

      keyframes.push({
        tMs,
        worldMain,
        speedPxPerSec,
        animState,
        activeEventIds,
      });

      tMs += KEYFRAME_INTERVAL_MS;
    }

    return keyframes;
  }

  private resolveAnimState(
    activeEventIds: string[],
    racerEvents: RaceEvent[],
    isEliminated: boolean,
    isFinished: boolean
  ): RacerAnimState {
    if (isFinished) {
      return "win";
    }
    if (isEliminated && activeEventIds.length > 0) {
      return "lose";
    }

    // Check for event-driven state override
    for (const eventId of activeEventIds) {
      const event = racerEvents.find((e) => e.id === eventId);
      if (!event) {
        continue;
      }
      const def = eventRegistry.get(event.typeId);
      if (def?.animStateOverride) {
        return def.animStateOverride;
      }
    }

    return "running";
  }

  private computeRankings(
    racers: RacerInput[],
    timelines: Record<string, RacerTimeline>
  ): Array<{ racerId: string; rank: number; finishMs: number }> {
    const sorted = racers
      .map((r) => ({
        racerId: r.id,
        finishMs: timelines[r.id]?.finishMs ?? Number.POSITIVE_INFINITY,
      }))
      .sort((a, b) => a.finishMs - b.finishMs);

    return sorted.map((entry, index) => {
      const rank = index + 1;
      if (timelines[entry.racerId]) {
        timelines[entry.racerId].finalRank = rank;
      }
      return { ...entry, rank };
    });
  }
}

function buildTestPolicePullCinematic(input: {
  racers: RacerInput[];
  durationMs: number;
  rng: SeededRng;
}):
  | {
      prefabs: CinematicEventPrefab[];
      instances: CinematicEventInstance[];
    }
  | undefined {
  if (input.racers.length === 0) {
    return undefined;
  }

  // Keep it sparse so it doesn't dominate the race.
  const shouldSpawn = input.rng.float() < 0.45;
  if (!shouldSpawn) {
    return undefined;
  }

  const target = input.rng.pick(input.racers);
  const prefabId = "TEST_POLICE_PULL";

  const startMs = input.rng.floatRange(
    input.durationMs * 0.35,
    input.durationMs * 0.7
  );
  const durationMs = 1600;

  const prefab: CinematicEventPrefab = {
    prefabId,
    name: "Police Pull (test)",
    steps: [
      // Spawn near target, slightly behind.
      {
        atMs: 0,
        eventSprite: {
          position: {
            kind: "RACER",
            racerId: target.id,
            dMain: -180,
            dCross: 0,
          },
          opacity: 1,
        },
      },
      // Approach and stop behind racer.
      {
        atMs: 500,
        eventSprite: {
          position: {
            kind: "RACER",
            racerId: target.id,
            dMain: -50,
            dCross: 0,
          },
        },
        racers: [
          { racerId: target.id, velocityMultiplier: 0, animState: "idle" },
        ],
      },
      // Pull racer into the car (drag backward + fade).
      {
        atMs: 900,
        racers: [
          {
            racerId: target.id,
            velocityMultiplier: 0,
            animState: "lose",
            position: {
              target: {
                kind: "RACER",
                racerId: target.id,
                dMain: -60,
                dCross: 0,
              },
              opacity: 0.6,
            },
          },
        ],
      },
      // Destroy racer (eliminate) near the end.
      {
        atMs: 1400,
        racers: [{ racerId: target.id, isDestroyed: true, animState: "lose" }],
        eventSprite: { opacity: 0 },
      },
    ],
  };

  const inst: CinematicEventInstance = {
    id: `cin-${Math.floor(startMs)}-${target.id}`,
    prefabId,
    startMs,
    durationMs,
    affectedRacerIds: [target.id],
  };

  return {
    prefabs: [prefab],
    instances: [inst],
  };
}
