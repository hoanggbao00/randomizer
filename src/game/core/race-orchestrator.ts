import { Application } from "pixi.js";
import { RaceSimulator } from "@/game/simulation/race-simulator";
import { useCameraStore } from "@/game/stores/camera-store";
import { useConfigStore } from "@/game/stores/config-store";
import { useDebugStore } from "@/game/stores/debug-store";
import { usePlaybackStore } from "@/game/stores/playback-store";
import { useRacerStore } from "@/game/stores/racer-store";
import { useScenarioStore } from "@/game/stores/scenario-store";
import { useUIStore } from "@/game/stores/ui-store";
import type { RacerInput } from "@/game/types/racer";
import { computeTrackLength } from "@/game/utils/coordinate-utils";
import { GameRuntime } from "./game-runtime";

/**
 * RaceOrchestrator coordinates the full race flow:
 * 1. Parse racer input
 * 2. Simulate scenario
 * 3. Setup game runtime
 * 4. Start playback
 *
 * Reads from stores, writes to stores.
 * Does NOT import from React — pure game logic.
 */
export class RaceOrchestrator {
  private readonly simulator = new RaceSimulator();
  private runtime: GameRuntime | null = null;
  private app: Application | null = null;

  async mountPixi(host: HTMLDivElement): Promise<void> {
    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;

    this.app = new Application();
    await this.app.init({
      width,
      height,
      backgroundColor: 0x1a_1a_2e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    host.appendChild(this.app.canvas);

    this.runtime = new GameRuntime({
      app: this.app,
      viewportWidth: width,
      viewportHeight: height,
    });

    // Handle tab visibility for performance
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  /**
   * Live preview: parse current textarea and render racers idle on canvas.
   * Does not start playback.
   */
  previewRacers(rawNames: string): void {
    const configStore = useConfigStore.getState();
    const racerStore = useRacerStore.getState();

    racerStore.setInputsFromTextarea(rawNames);
    const baseRacers = useRacerStore
      .getState()
      .inputs.slice(0, configStore.config.maxRacers);
    const racers = assignAssetsToRacers(
      baseRacers,
      configStore.config.selectedCharacterIds
    );

    const viewportWidth = this.app?.renderer.width ?? window.innerWidth;
    const viewportHeight = this.app?.renderer.height ?? window.innerHeight;
    const trackLengthPx = computeTrackLength(
      configStore.config.direction,
      viewportWidth,
      viewportHeight
    );

    this.runtime?.setupPreview({
      racers,
      direction: configStore.config.direction,
      trackLengthPx,
    });
  }

  startRace(): void {
    const uiStore = useUIStore.getState();
    const configStore = useConfigStore.getState();
    const racerStore = useRacerStore.getState();

    uiStore.clearMessages();
    useDebugStore.getState().reset();

    // Parse racers from textarea
    racerStore.setInputsFromTextarea(uiStore.textareaInput);
    const racers = useRacerStore.getState().inputs;

    if (racers.length === 0) {
      uiStore.addError("Please enter at least one racer name.");
      return;
    }

    if (racers.length > configStore.config.maxRacers) {
      uiStore.addWarning(
        `Too many racers. Using first ${configStore.config.maxRacers}.`
      );
    }

    const cappedBaseRacers = racers.slice(0, configStore.config.maxRacers);
    const cappedRacers = assignAssetsToRacers(
      cappedBaseRacers,
      configStore.config.selectedCharacterIds
    );

    // Compute track length from viewport
    const viewportWidth = this.app?.renderer.width ?? window.innerWidth;
    const viewportHeight = this.app?.renderer.height ?? window.innerHeight;
    const trackLengthPx = computeTrackLength(
      configStore.config.direction,
      viewportWidth,
      viewportHeight
    );

    // Ensure minimum duration
    const targetDurationMs = Math.max(
      configStore.config.minDurationMs,
      configStore.config.targetDurationMs
    );

    const config = {
      ...configStore.config,
      trackLengthPx,
      targetDurationMs,
      seed: configStore.config.seed || String(Date.now()),
    };

    usePlaybackStore.getState().setPhase("LOADING");

    try {
      const scenario =
        config.scenarioMode === "PRECOMPUTED"
          ? this.simulator.generateScenario({
              racers: cappedRacers,
              config,
            })
          : this.simulator.generateEventDrivenScenario({
              racers: cappedRacers,
              config,
            });

      useScenarioStore.getState().setScenario(scenario);

      // Setup runtime
      this.runtime?.setupRace(scenario, cappedRacers);

      // Start playback
      usePlaybackStore.getState().reset();
      usePlaybackStore.getState().setPhase("PLAYING");
      this.runtime?.startTicker();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      uiStore.addError(`Race failed to start: ${message}`);
      usePlaybackStore.getState().setPhase("IDLE");
    }
  }

  pauseRace(): void {
    const phase = usePlaybackStore.getState().phase;
    if (phase === "PLAYING") {
      usePlaybackStore.getState().setPhase("PAUSED");
    } else if (phase === "PAUSED") {
      usePlaybackStore.getState().setPhase("PLAYING");
    }
  }

  resetRace(): void {
    const configStore = useConfigStore.getState();
    const uiStore = useUIStore.getState();
    const racerStore = useRacerStore.getState();
    this.runtime?.stopTicker();
    useDebugStore.getState().reset();
    usePlaybackStore.getState().reset();
    useScenarioStore.getState().clearScenario();
    useCameraStore.getState().reset();
    uiStore.clearMessages();

    // Reset canvas back to initial idle racers (based on current textarea).
    racerStore.setInputsFromTextarea(uiStore.textareaInput);
    const racers = useRacerStore
      .getState()
      .inputs.slice(0, configStore.config.maxRacers);

    const viewportWidth = this.app?.renderer.width ?? window.innerWidth;
    const viewportHeight = this.app?.renderer.height ?? window.innerHeight;
    const trackLengthPx = computeTrackLength(
      configStore.config.direction,
      viewportWidth,
      viewportHeight
    );

    this.runtime?.setupPreview({
      racers,
      direction: configStore.config.direction,
      trackLengthPx,
    });
  }

  resize(width: number, height: number): void {
    this.runtime?.resize(width, height);
  }

  unmount(): void {
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );
    this.runtime?.destroy();
    this.runtime = null;

    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
  }

  private readonly handleVisibilityChange = (): void => {
    if (!this.app) {
      return;
    }
    if (document.hidden) {
      this.app.ticker.stop();
    } else {
      const phase = usePlaybackStore.getState().phase;
      if (phase === "PLAYING") {
        this.app.ticker.start();
      }
    }
  };
}

function assignAssetsToRacers(
  racers: RacerInput[],
  selectedCharacterIds?: string[]
): RacerInput[] {
  if (!selectedCharacterIds || selectedCharacterIds.length === 0) {
    return racers;
  }

  if (selectedCharacterIds.length === 1) {
    const assetId = selectedCharacterIds[0];
    return racers.map((racer) => ({ ...racer, assetId }));
  }

  const result: RacerInput[] = [];
  const count = selectedCharacterIds.length;
  const offset = Math.floor(Math.random() * count);

  for (let index = 0; index < racers.length; index += 1) {
    const assetId = selectedCharacterIds[(offset + index) % count];
    result.push({ ...racers[index], assetId });
  }

  return result;
}
