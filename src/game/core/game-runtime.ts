import type { Application, Ticker } from "pixi.js";
import { TypedEventBus } from "@/game/events/typed-event-bus";
import { PlaybackEngine } from "@/game/playback/playback-engine";
import { CameraController } from "@/game/rendering/camera-controller";
import type { CinematicSpriteFrame } from "@/game/rendering/cinematic-event-renderer";
import { CinematicEventRenderer } from "@/game/rendering/cinematic-event-renderer";
import { RacerRenderer } from "@/game/rendering/racer-renderer";
import type { SimulationBusEvents } from "@/game/simulation/race-simulation-engine";
import { RaceSimulationEngine } from "@/game/simulation/race-simulation-engine";
import { useCameraStore } from "@/game/stores/camera-store";
import { usePlaybackStore } from "@/game/stores/playback-store";
import { useRacerStore } from "@/game/stores/racer-store";
import type { RaceDirection } from "@/game/types/race";
import type { RaceScenario } from "@/game/types/race-scenario";
import { isEventDrivenScenario } from "@/game/types/race-scenario";
import type { RacerInput } from "@/game/types/racer";
import { computeLaneCross } from "@/game/utils/coordinate-utils";

interface GameRuntimeConfig {
  app: Application;
  viewportHeight: number;
  viewportWidth: number;
}

/**
 * GameRuntime owns the Pixi ticker loop and coordinates:
 * - PlaybackEngine: interpolates scenario → racer states
 * - CameraController: tracks leader
 * - RacerRenderer: updates Pixi display objects
 *
 * Stores are written from here, React reads from stores.
 */
export class GameRuntime {
  private readonly playbackEngine = new PlaybackEngine();
  private readonly simulationBus = new TypedEventBus<SimulationBusEvents>();
  // Rendering bus is intentionally separate from simulation bus.
  // (Currently unused, but reserved for VFX/SFX concerns.)
  private readonly renderingBus = new TypedEventBus<Record<string, never>>();
  private readonly simulationEngine = new RaceSimulationEngine(
    this.simulationBus
  );
  private cameraController: CameraController | null = null;
  private racerRenderer: RacerRenderer | null = null;
  private cinematicRenderer: CinematicEventRenderer | null = null;
  private scenario: RaceScenario | null = null;
  private racerNames: Record<string, string> = {};
  private viewportWidth: number;
  private viewportHeight: number;
  private readonly app: Application;
  private tickerCallback: ((ticker: Ticker) => void) | null = null;

  constructor(config: GameRuntimeConfig) {
    this.app = config.app;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
  }

  setupRace(scenario: RaceScenario, racers: RacerInput[]): void {
    this.scenario = scenario;
    this.racerNames = Object.fromEntries(racers.map((r) => [r.id, r.name]));

    // Initialize camera controller
    this.cameraController = new CameraController({
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
      finishWorldCoord: scenario.trackLengthPx,
      lookAheadPx: 100,
      clampMarginPx: 50,
    });

    // Initialize racer renderer
    if (!this.racerRenderer) {
      this.racerRenderer = new RacerRenderer(this.app);
    }
    if (!this.cinematicRenderer) {
      this.cinematicRenderer = new CinematicEventRenderer(this.app);
    }

    // Initialize runtime states in store
    const initialStates = Object.fromEntries(
      racers.map((racer, index) => [
        racer.id,
        {
          racerId: racer.id,
          laneIndex: index,
          worldMain: 0,
          worldCross: this.computeLaneCross(index, racers.length, scenario),
          speedPxPerSec: 0,
          accelPxPerSec2: 0,
          isEliminated: false,
          isFinished: false,
          animState: "idle" as const,
          activeEventIds: [],
        },
      ])
    );

    useRacerStore.getState().batchUpdateRuntime(initialStates);

    // Setup renderer with initial states
    this.racerRenderer.setup(
      initialStates,
      this.racerNames,
      scenario.direction,
      scenario.trackLengthPx
    );
    this.cinematicRenderer.setup(scenario.direction, scenario.trackLengthPx);

    this.playbackEngine.reset();
    this.simulationEngine.reset();
    this.cameraController.reset();

    if (isEventDrivenScenario(scenario)) {
      const initialLaneCross = Object.fromEntries(
        Object.entries(initialStates).map(([id, s]) => [id, s.worldCross])
      ) as Record<string, number>;
      this.simulationEngine.setup({ scenario, racers, initialLaneCross });
    }
  }

  /**
   * Preview mode: show racers on canvas in idle state (no scenario, no ticker).
   * Used for "type names → see racers immediately".
   */
  setupPreview(params: {
    racers: RacerInput[];
    direction: RaceDirection;
    trackLengthPx: number;
  }): void {
    this.scenario = null;
    this.racerNames = Object.fromEntries(
      params.racers.map((r) => [r.id, r.name])
    );

    if (!this.racerRenderer) {
      this.racerRenderer = new RacerRenderer(this.app);
    }
    if (!this.cinematicRenderer) {
      this.cinematicRenderer = new CinematicEventRenderer(this.app);
    }

    const racerCount = Math.max(params.racers.length, 1);
    const initialStates = Object.fromEntries(
      params.racers.map((racer, index) => [
        racer.id,
        {
          racerId: racer.id,
          laneIndex: index,
          worldMain: 0,
          worldCross: computeLaneCross(
            index,
            racerCount,
            params.direction,
            this.viewportWidth,
            this.viewportHeight
          ),
          speedPxPerSec: 0,
          accelPxPerSec2: 0,
          isEliminated: false,
          isFinished: false,
          animState: "idle" as const,
          activeEventIds: [],
        },
      ])
    );

    useRacerStore.getState().batchUpdateRuntime(initialStates);

    this.racerRenderer.setup(
      initialStates,
      this.racerNames,
      params.direction,
      params.trackLengthPx
    );
    this.cinematicRenderer.setup(params.direction, params.trackLengthPx);

    // Ensure no leftover loops from a previous race.
    this.stopTicker();
    this.playbackEngine.reset();
    this.simulationEngine.reset();
  }

  startTicker(): void {
    if (this.tickerCallback) {
      this.app.ticker.remove(this.tickerCallback);
    }

    this.tickerCallback = (ticker: Ticker) => {
      this.tick(ticker.deltaMS);
    };

    this.app.ticker.add(this.tickerCallback);
  }

  stopTicker(): void {
    if (this.tickerCallback) {
      this.app.ticker.remove(this.tickerCallback);
      this.tickerCallback = null;
    }
  }

  private tick(deltaMs: number): void {
    const playbackState = usePlaybackStore.getState();

    if (playbackState.phase !== "PLAYING") {
      return;
    }
    if (!this.scenario) {
      return;
    }

    // Advance elapsed time
    playbackState.tick(deltaMs);
    const elapsedMs = usePlaybackStore.getState().elapsedMs;

    const frame = isEventDrivenScenario(this.scenario)
      ? this.simulationEngine.step(deltaMs, {
          width: this.viewportWidth,
          height: this.viewportHeight,
        })
      : this.playbackEngine.computeFrame(
          this.scenario,
          elapsedMs,
          this.viewportWidth,
          this.viewportHeight
        );

    // Batch update racer states in store
    useRacerStore.getState().batchUpdateRuntime(frame.racerStates);

    // Update camera
    if (this.cameraController) {
      const cameraResult = this.cameraController.update(
        frame.racerStates,
        this.scenario.direction,
        deltaMs
      );
      useCameraStore
        .getState()
        .setPosition(cameraResult.worldMain, cameraResult.worldCross);
    }

    // Update renderer
    const cameraMain = useCameraStore.getState().worldMain;
    this.racerRenderer?.update(frame.racerStates, cameraMain);
    this.cinematicRenderer?.update(getCinematicSprites(frame), cameraMain);

    // Check race end
    if (frame.isFinished) {
      usePlaybackStore.getState().setPhase("ENDED");
      if (frame.winnerRacerId) {
        usePlaybackStore.getState().setWinner(frame.winnerRacerId);
      }
      this.stopTicker();
    }
  }

  resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.app.renderer.resize(width, height);
  }

  destroy(): void {
    this.stopTicker();
    this.racerRenderer?.destroy();
    this.racerRenderer = null;
    this.cinematicRenderer?.destroy();
    this.cinematicRenderer = null;
    this.scenario = null;
    this.simulationBus.clear();
    this.renderingBus.clear();
  }

  private computeLaneCross(
    laneIndex: number,
    racerCount: number,
    scenario: RaceScenario
  ): number {
    const crossAxisLength =
      scenario.direction === "LTR" || scenario.direction === "RTL"
        ? this.viewportHeight
        : this.viewportWidth;
    const spacing = crossAxisLength / Math.max(racerCount, 1);
    return spacing * (laneIndex + 0.5);
  }
}

function getCinematicSprites(frame: unknown): CinematicSpriteFrame[] {
  if (!frame || typeof frame !== "object") {
    return [];
  }
  if (!("cinematicSprites" in frame)) {
    return [];
  }
  const value = (frame as { cinematicSprites?: unknown }).cinematicSprites;
  return Array.isArray(value) ? (value as CinematicSpriteFrame[]) : [];
}
