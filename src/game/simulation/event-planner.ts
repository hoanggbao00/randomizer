import type { BuiltinEventTypeId, RaceEvent } from "@/game/types/event";
import type { RaceConfig } from "@/game/types/race";
import type { RacerInput } from "@/game/types/racer";
import type { SeededRng } from "./seeded-rng";

const BUILTIN_NEGATIVE_EVENTS: BuiltinEventTypeId[] = ["SLOW", "STUN"];
const BUILTIN_POSITIVE_EVENTS: BuiltinEventTypeId[] = ["BOOST"];

interface PlanEventsInput {
  config: RaceConfig;
  /**
   * Legacy-only: map of racerId to planned finish time.
   * Used mainly to decide elimination scheduling.
   */
  finishTimes?: Record<string, number>;
  racers: RacerInput[];
  rng: SeededRng;
  /**
   * Legacy-only: if provided, planner may bias events
   * (e.g. fewer negative events for winner).
   */
  winnerRacerId?: string;
}

let eventIdCounter = 0;

function generateEventId(): string {
  eventIdCounter += 1;
  return `evt-${eventIdCounter}`;
}

/**
 * Plans random events distributed across the race timeline.
 *
 * Rules:
 * - No events in first 1s or last 1s of race.
 * - Winner gets fewer negative events.
 * - Eliminated racers get ELIMINATE event after 40% progress.
 * - Community event types can be injected via EventRegistry.
 */
export function planEvents(input: PlanEventsInput): RaceEvent[] {
  const { racers, config, winnerRacerId, rng, finishTimes } = input;
  const events: RaceEvent[] = [];

  const safeStart = 1000;
  const safeEnd = config.targetDurationMs - 1000;

  for (const racer of racers) {
    const isWinner = winnerRacerId ? racer.id === winnerRacerId : false;
    const finishMs = finishTimes?.[racer.id] ?? config.targetDurationMs;
    const isEliminated = shouldEliminate({
      allowElimination: config.allowElimination,
      finishMs,
      hasFinishTimes: Boolean(finishTimes),
      rng,
    });

    // Handle elimination event
    if (isEliminated && config.allowElimination) {
      const eliminateAt = rng.floatRange(
        config.targetDurationMs * 0.4,
        config.targetDurationMs * 0.8
      );
      events.push({
        id: generateEventId(),
        typeId: "ELIMINATE",
        racerId: racer.id,
        startMs: eliminateAt,
        durationMs: Number.POSITIVE_INFINITY,
        magnitude: 1,
      });
      continue;
    }

    // Number of events for this racer
    const baseEventCount = Math.round(config.eventDensity * rng.range(2, 5));
    const eventCount = isWinner
      ? Math.max(1, Math.floor(baseEventCount * 0.5))
      : baseEventCount;

    for (let i = 0; i < eventCount; i++) {
      const startMs = rng.floatRange(safeStart, safeEnd);
      const durationMs = rng.floatRange(500, 2000);

      const usePositive = choosePositiveEvent({
        isWinner,
        rng,
        winnerRacerId,
      });
      const typeId = usePositive
        ? rng.pick(BUILTIN_POSITIVE_EVENTS)
        : rng.pick(BUILTIN_NEGATIVE_EVENTS);

      events.push({
        id: generateEventId(),
        typeId,
        racerId: racer.id,
        startMs,
        durationMs,
        magnitude: rng.floatRange(0.7, 1.0),
      });
    }
  }

  return events;
}

function shouldEliminate(input: {
  allowElimination: boolean;
  finishMs: number;
  hasFinishTimes: boolean;
  rng: SeededRng;
}): boolean {
  if (!input.allowElimination) {
    return false;
  }
  if (input.finishMs === Number.POSITIVE_INFINITY) {
    return true;
  }
  // Event-driven mode: elimination is decided here (no finishTimes map).
  if (!input.hasFinishTimes) {
    return input.rng.float() < 0.12;
  }
  return false;
}

function choosePositiveEvent(input: {
  isWinner: boolean;
  rng: SeededRng;
  winnerRacerId?: string;
}): boolean {
  // If winner is known (legacy), bias them toward positives.
  // In event-driven mode (no winner), keep it neutral.
  if (!input.winnerRacerId) {
    return input.rng.float() > 0.5;
  }
  if (input.isWinner) {
    return input.rng.float() > 0.3;
  }
  return input.rng.float() > 0.6;
}
