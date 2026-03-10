import { resolveEventEffects } from "@/game/events/event-effect-resolver";
import { eventRegistry } from "@/game/events/event-registry";
import type { TypedEventBus } from "@/game/events/typed-event-bus";
import type {
  CinematicFrame,
  CinematicRacerEffect,
} from "@/game/types/cinematic-event";
import type { RaceEvent } from "@/game/types/event";
import type { RacerInput, RacerRuntimeState } from "@/game/types/racer";
import type { EventDrivenScenario } from "@/game/types/scenario";
import { clamp } from "@/game/utils/clamp";
import { CinematicEventEngine } from "./cinematic-event-engine";
import { ValueNoise1D } from "./value-noise";

export interface SimulationBusEvents {
  eventTriggered: { event: RaceEvent };
  racerEliminated: { racerId: string; elapsedMs: number };
  racerFinished: { racerId: string; elapsedMs: number; rank: number };
  tick: { deltaMs: number; elapsedMs: number };
}

export interface SimulationFrame {
  cinematicSprites?: Array<{
    id: string;
    opacity: number;
    worldCross: number;
    worldMain: number;
  }>;
  elapsedMs: number;
  isFinished: boolean;
  racerStates: Record<string, RacerRuntimeState>;
  rankings: Array<{ racerId: string; rank: number; finishMs: number }>;
  winnerRacerId: string | null;
}

interface RacerSimState {
  accelPxPerSec2: number;
  baseSpeedPxPerSec: number;
  finishMs: number | null;
  isEliminated: boolean;
  isFinished: boolean;
  laneIndex: number;
  noise: ValueNoise1D;
  speedPxPerSec: number;
  worldCross: number;
  worldMain: number;
}

export class RaceSimulationEngine {
  // Safety caps to keep motion readable (avoid racers teleporting).
  // Raw speed is the intrinsic runner speed; effective speed includes event multipliers.
  private static readonly MAX_RAW_SPEED_MULTIPLIER = 1.35;
  private static readonly MAX_EFFECTIVE_SPEED_MULTIPLIER = 1.5;
  private static readonly MIN_RAW_SPEED_PX_PER_SEC = 25;
  // Competition tuning: reduce "born fast wins forever", encourage overtakes.
  private static readonly BASE_SPEED_MIN_MULT = 0.985;
  private static readonly BASE_SPEED_MAX_MULT = 1.015;
  private static readonly CATCHUP_ACCEL_MAX = 220; // px/s^2
  private static readonly LEADER_DRAG_MAX = 160; // px/s^2
  private elapsedMs = 0;
  private scenario: EventDrivenScenario | null = null;
  private racers: RacerInput[] = [];
  private sim: Record<string, RacerSimState> = {};
  private firedEventIds = new Set<string>();
  private readonly cinematicEngine = new CinematicEventEngine();

  private readonly bus: TypedEventBus<SimulationBusEvents>;

  constructor(bus: TypedEventBus<SimulationBusEvents>) {
    this.bus = bus;
  }

  reset(): void {
    this.elapsedMs = 0;
    this.scenario = null;
    this.racers = [];
    this.sim = {};
    this.firedEventIds = new Set();
    this.cinematicEngine.reset();
  }

  setup(params: {
    scenario: EventDrivenScenario;
    racers: RacerInput[];
    initialLaneCross: Record<string, number>;
  }): void {
    this.reset();
    this.scenario = params.scenario;
    this.racers = params.racers;
    this.cinematicEngine.setup({ scenario: params.scenario });

    const avgSpeed =
      params.scenario.trackLengthPx / (params.scenario.durationMs / 1000);

    for (const [index, racer] of params.racers.entries()) {
      // Give each racer a slightly different base speed; winner emerges.
      const bias = this.hashToUnit(params.scenario.seed, racer.id);
      const base =
        avgSpeed *
        lerp(
          RaceSimulationEngine.BASE_SPEED_MIN_MULT,
          RaceSimulationEngine.BASE_SPEED_MAX_MULT,
          bias
        );

      this.sim[racer.id] = {
        laneIndex: index,
        worldMain: 0,
        worldCross: params.initialLaneCross[racer.id] ?? 0,
        speedPxPerSec: base * 0.85,
        accelPxPerSec2: 0,
        baseSpeedPxPerSec: base,
        isFinished: false,
        isEliminated: false,
        finishMs: null,
        noise: new ValueNoise1D(params.scenario.seed, racer.id),
      };
    }
  }

  step(
    deltaMs: number,
    _viewport: { width: number; height: number }
  ): SimulationFrame {
    const scenario = this.scenario;
    if (!scenario) {
      return {
        elapsedMs: this.elapsedMs,
        isFinished: true,
        racerStates: {},
        winnerRacerId: null,
        rankings: [],
      };
    }

    this.elapsedMs += deltaMs;
    this.bus.emit("tick", { deltaMs, elapsedMs: this.elapsedMs });

    const tSec = this.elapsedMs / 1000;
    const { racerStates, racerPositions } = this.buildBaseRacerStates({
      deltaMs,
      tSec,
    });

    const cinematicFrame = scenario.cinematic
      ? this.cinematicEngine.computeFrame({
          elapsedMs: this.elapsedMs,
          racerPositions,
          trackLengthPx: scenario.trackLengthPx,
        })
      : null;

    this.applyCinematicEffects({
      cinematicFrame,
      racerStates,
      trackLengthPx: scenario.trackLengthPx,
    });

    this.emitNewlyTriggeredEvents();

    const rankings = this.computeRankings();
    const winnerRacerId = this.findWinnerRacerId(rankings);
    const isFinished =
      Boolean(winnerRacerId) || this.elapsedMs >= scenario.durationMs;

    return {
      elapsedMs: this.elapsedMs,
      isFinished,
      racerStates,
      cinematicSprites: cinematicFrame?.sprites,
      winnerRacerId,
      rankings,
    };
  }

  private buildBaseRacerStates(input: { deltaMs: number; tSec: number }): {
    racerPositions: Record<string, { worldMain: number; worldCross: number }>;
    racerStates: Record<string, RacerRuntimeState>;
  } {
    const racerStates: Record<string, RacerRuntimeState> = {};
    const racerPositions: Record<
      string,
      { worldMain: number; worldCross: number }
    > = {};

    for (const racer of this.racers) {
      const next = this.updateRacer({
        racerId: racer.id,
        deltaMs: input.deltaMs,
        tSec: input.tSec,
      });
      if (!next) {
        continue;
      }
      racerStates[racer.id] = next;
      racerPositions[racer.id] = {
        worldMain: next.worldMain,
        worldCross: next.worldCross,
      };
    }

    return { racerStates, racerPositions };
  }

  private applyCinematicEffects(input: {
    cinematicFrame: CinematicFrame | null;
    racerStates: Record<string, RacerRuntimeState>;
    trackLengthPx: number;
  }): void {
    if (!input.cinematicFrame) {
      return;
    }
    for (const [racerId, fx] of Object.entries(
      input.cinematicFrame.racerEffects
    )) {
      const state = input.racerStates[racerId];
      if (!state) {
        continue;
      }
      this.applyOneCinematicEffect(state, fx, input.trackLengthPx);
    }
  }

  private applyOneCinematicEffect(
    state: RacerRuntimeState,
    fx: CinematicRacerEffect,
    trackLengthPx: number
  ): void {
    if (fx.isDestroyed) {
      state.isEliminated = true;
      state.speedPxPerSec = 0;
      state.accelPxPerSec2 = 0;
      state.animState = fx.animState ?? "lose";
    }

    if (fx.velocityMultiplier !== undefined) {
      state.speedPxPerSec *= fx.velocityMultiplier;
    }

    if (fx.positionOverride) {
      state.worldMain = clamp(fx.positionOverride.worldMain, 0, trackLengthPx);
      state.worldCross = fx.positionOverride.worldCross;
    }

    if (fx.animState) {
      state.animState = fx.animState;
    }

    if (fx.opacity !== undefined) {
      state.opacity = fx.opacity;
    }
  }

  private findWinnerRacerId(
    rankings: Array<{ racerId: string; rank: number; finishMs: number }>
  ): string | null {
    // Winner emerges as the first racer to have a finite finish time.
    const firstFinished = rankings.find((r) => Number.isFinite(r.finishMs));
    return firstFinished?.racerId ?? null;
  }

  private updateRacer(input: {
    racerId: string;
    deltaMs: number;
    tSec: number;
  }): RacerRuntimeState | null {
    const scenario = this.scenario;
    if (!scenario) {
      return null;
    }
    const s = this.sim[input.racerId];
    if (!s) {
      return null;
    }

    const activeEventIds = this.getActiveEventIds(
      input.racerId,
      this.elapsedMs
    );
    const effects = resolveEventEffects(
      activeEventIds,
      scenario.events,
      eventRegistry
    );

    if (s.isFinished || s.isEliminated) {
      return {
        racerId: input.racerId,
        laneIndex: s.laneIndex,
        worldMain: s.worldMain,
        worldCross: s.worldCross,
        speedPxPerSec: 0,
        accelPxPerSec2: 0,
        isEliminated: s.isEliminated,
        isFinished: s.isFinished,
        animState: s.isFinished ? "win" : "lose",
        activeEventIds,
      };
    }

    const dt = input.deltaMs / 1000;
    const noiseAccel = this.computeNoiseAccel(s, input.tSec);
    const reversionAccel = this.computeReversionAccel(s);
    const competitionAccel = this.computeCompetitionAccel(input.racerId, s);

    const accel =
      noiseAccel +
      reversionAccel +
      competitionAccel +
      effects.accelDelta +
      (effects.speedMultiplier - 1) * 180;

    s.accelPxPerSec2 = accel;
    s.speedPxPerSec = clamp(
      s.speedPxPerSec + s.accelPxPerSec2 * dt,
      RaceSimulationEngine.MIN_RAW_SPEED_PX_PER_SEC,
      s.baseSpeedPxPerSec * RaceSimulationEngine.MAX_RAW_SPEED_MULTIPLIER
    );

    if (effects.progressLock) {
      s.speedPxPerSec = 0;
      if (this.isEliminateActive(activeEventIds, scenario.events)) {
        s.isEliminated = true;
        s.finishMs = Number.POSITIVE_INFINITY;
        this.bus.emit("racerEliminated", {
          racerId: input.racerId,
          elapsedMs: this.elapsedMs,
        });
      }
    } else {
      const effectiveSpeed = clamp(
        s.speedPxPerSec * effects.speedMultiplier,
        0,
        s.baseSpeedPxPerSec *
          RaceSimulationEngine.MAX_EFFECTIVE_SPEED_MULTIPLIER
      );
      s.worldMain = clamp(
        s.worldMain + effectiveSpeed * dt,
        0,
        scenario.trackLengthPx
      );
    }

    const isFinishedNow = s.worldMain >= scenario.trackLengthPx - 0.001;
    if (isFinishedNow) {
      s.isFinished = true;
      s.finishMs = this.elapsedMs;
      const rank = this.computeRankNow();
      this.bus.emit("racerFinished", {
        racerId: input.racerId,
        elapsedMs: this.elapsedMs,
        rank,
      });
    }

    const animState = this.resolveAnimState({
      isEliminated: s.isEliminated,
      isFinished: s.isFinished,
      override: effects.animStateOverride,
    });

    return {
      racerId: input.racerId,
      laneIndex: s.laneIndex,
      worldMain: s.worldMain,
      worldCross: s.worldCross,
      speedPxPerSec: s.speedPxPerSec,
      accelPxPerSec2: s.accelPxPerSec2,
      isEliminated: s.isEliminated,
      isFinished: s.isFinished,
      animState,
      activeEventIds,
    };
  }

  private computeNoiseAccel(state: RacerSimState, tSec: number): number {
    const wave = state.noise.sample(tSec, 0.7);
    const wave2 = state.noise.sample(tSec + 100, 0.23);
    return (wave * 0.7 + wave2 * 0.3) * 260;
  }

  private computeReversionAccel(state: RacerSimState): number {
    const speedError = state.baseSpeedPxPerSec - state.speedPxPerSec;
    return clamp(speedError * 0.8, -250, 250);
  }

  private computeCompetitionAccel(
    _racerId: string,
    state: RacerSimState
  ): number {
    // Rubber-banding: trailing racers get small catch-up accel, leader gets small drag.
    // Uses current progress snapshot (worldMain), so it's stable and deterministic.
    const all = Object.entries(this.sim)
      .map(([id, s]) => ({ id, s }))
      .filter((x) => !x.s.isEliminated);

    if (all.length <= 1) {
      return 0;
    }

    let leaderMain = 0;
    for (const { s } of all) {
      leaderMain = Math.max(leaderMain, s.worldMain);
    }

    const gapToLeader = leaderMain - state.worldMain; // >= 0 for non-leader
    const normalizedGap = clamp(gapToLeader / 320, 0, 1); // ~320px to max assist

    // Determine if this racer is currently the leader (ties treated as leader).
    const isLeader = Math.abs(state.worldMain - leaderMain) < 0.001;

    if (isLeader) {
      // Drag scales up slightly when the pack is close (prevents runaway).
      const packTightness =
        1 - clamp(this.computeSecondLeaderGap(leaderMain, all) / 260, 0, 1);
      return -RaceSimulationEngine.LEADER_DRAG_MAX * packTightness;
    }

    // Catch-up accel for trailing racers, scaled by gap.
    // Also reduce assist late-race to avoid "slingshot" finish.
    const progress01 = clamp(state.worldMain / Math.max(1, leaderMain), 0, 1);
    const lateFade = 1 - clamp((progress01 - 0.8) / 0.2, 0, 1);
    return RaceSimulationEngine.CATCHUP_ACCEL_MAX * normalizedGap * lateFade;
  }

  private computeSecondLeaderGap(
    leaderMain: number,
    all: Array<{ id: string; s: RacerSimState }>
  ): number {
    let second = 0;
    for (const { s } of all) {
      if (s.worldMain < leaderMain) {
        second = Math.max(second, s.worldMain);
      }
    }
    return leaderMain - second;
  }

  private resolveAnimState(input: {
    isEliminated: boolean;
    isFinished: boolean;
    override: RacerRuntimeState["animState"] | null;
  }): RacerRuntimeState["animState"] {
    if (input.override) {
      return input.override;
    }
    if (input.isFinished) {
      return "win";
    }
    if (input.isEliminated) {
      return "lose";
    }
    return "running";
  }

  private isEliminateActive(
    activeEventIds: string[],
    events: RaceEvent[]
  ): boolean {
    for (const id of activeEventIds) {
      const evt = events.find((e) => e.id === id);
      if (evt?.typeId === "ELIMINATE") {
        return true;
      }
    }
    return false;
  }

  private emitNewlyTriggeredEvents(): void {
    const scenario = this.scenario;
    if (!scenario) {
      return;
    }
    for (const evt of scenario.events) {
      if (this.firedEventIds.has(evt.id)) {
        continue;
      }
      if (
        evt.startMs <= this.elapsedMs &&
        this.elapsedMs < evt.startMs + evt.durationMs
      ) {
        this.firedEventIds.add(evt.id);
        this.bus.emit("eventTriggered", { event: evt });
      }
    }
  }

  private getActiveEventIds(racerId: string, tMs: number): string[] {
    if (!this.scenario) {
      return [];
    }
    return this.scenario.events
      .filter(
        (e) =>
          e.racerId === racerId &&
          e.startMs <= tMs &&
          tMs < e.startMs + e.durationMs
      )
      .map((e) => e.id);
  }

  private computeRankNow(): number {
    const finished = Object.values(this.sim)
      .filter((s) => s.isFinished && typeof s.finishMs === "number")
      .sort((a, b) => (a.finishMs ?? 0) - (b.finishMs ?? 0));
    return finished.length;
  }

  private computeRankings(): Array<{
    racerId: string;
    rank: number;
    finishMs: number;
  }> {
    const entries = Object.entries(this.sim).map(([racerId, s]) => ({
      racerId,
      finishMs: s.finishMs ?? Number.POSITIVE_INFINITY,
      progress: s.worldMain,
    }));

    entries.sort((a, b) => {
      if (a.finishMs !== b.finishMs) {
        return a.finishMs - b.finishMs;
      }
      return b.progress - a.progress;
    });

    return entries.map((e, idx) => ({
      racerId: e.racerId,
      rank: idx + 1,
      finishMs: e.finishMs,
    }));
  }

  private hashToUnit(seed: string, key: string): number {
    const s = `${seed}|${key}`;
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = (hash * 31 + s.charCodeAt(i)) % 2_147_483_647;
    }
    return (hash % 1_000_000) / 1_000_000;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
