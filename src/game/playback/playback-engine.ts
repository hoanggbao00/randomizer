import type { RacerRuntimeState } from "@/game/types/racer";
import type { PrecomputedScenario } from "@/game/types/timeline";
import { clamp } from "@/game/utils/clamp";
import { expSmooth } from "@/game/utils/lerp";
import { interpolateKeyframe } from "./race-math";

export interface PlaybackFrame {
  elapsedMs: number;
  isFinished: boolean;
  racerStates: Record<string, RacerRuntimeState>;
  winnerRacerId: string | null;
}

/**
 * PlaybackEngine interpolates the precomputed scenario at a given elapsed time.
 * Runs in the Pixi ticker — must be fast and allocation-minimal.
 *
 * Hot path: reads scenario from ref, writes to racer store via batchUpdateRuntime.
 */
export class PlaybackEngine {
  private smoothedSpeeds: Record<string, number> = {};

  reset(): void {
    this.smoothedSpeeds = {};
  }

  /**
   * Computes the current frame state from the precomputed scenario.
   * Called every tick with the current elapsed time.
   */
  computeFrame(
    scenario: PrecomputedScenario,
    elapsedMs: number,
    viewportWidth: number,
    viewportHeight: number
  ): PlaybackFrame {
    const racerStates: Record<string, RacerRuntimeState> = {};
    let winnerRacerId: string | null = null;
    const dtSec = 1 / 60; // Assume 60fps for smoothing

    for (const [racerId, timeline] of Object.entries(scenario.racerTimelines)) {
      const kf = interpolateKeyframe(timeline, elapsedMs);

      // Smooth speed for natural feel
      const prevSpeed = this.smoothedSpeeds[racerId] ?? kf.speedPxPerSec;
      const smoothedSpeed = expSmooth(prevSpeed, kf.speedPxPerSec, 6, dtSec);
      this.smoothedSpeeds[racerId] = smoothedSpeed;

      const isFinished = kf.worldMain >= scenario.trackLengthPx;
      const isEliminated = timeline.finishMs === Number.POSITIVE_INFINITY;

      if (isFinished && racerId === scenario.winnerRacerId) {
        winnerRacerId = racerId;
      }

      // Compute lane cross position
      const laneIndex = this.getLaneIndex(racerId, scenario);
      const racerCount = Object.keys(scenario.racerTimelines).length;
      const worldCross = this.computeLaneCross(
        laneIndex,
        racerCount,
        scenario.direction,
        viewportWidth,
        viewportHeight
      );

      racerStates[racerId] = {
        racerId,
        laneIndex,
        worldMain: clamp(kf.worldMain, 0, scenario.trackLengthPx),
        worldCross,
        speedPxPerSec: smoothedSpeed,
        accelPxPerSec2: 0,
        isEliminated,
        isFinished,
        animState: kf.animState,
        activeEventIds: kf.activeEventIds,
      };
    }

    const isFinished =
      elapsedMs >= scenario.durationMs ||
      winnerRacerId === scenario.winnerRacerId;

    return {
      elapsedMs,
      racerStates,
      isFinished,
      winnerRacerId: isFinished ? scenario.winnerRacerId : winnerRacerId,
    };
  }

  private getLaneIndex(racerId: string, scenario: PrecomputedScenario): number {
    const ids = Object.keys(scenario.racerTimelines);
    return ids.indexOf(racerId);
  }

  private computeLaneCross(
    laneIndex: number,
    racerCount: number,
    direction: PrecomputedScenario["direction"],
    viewportWidth: number,
    viewportHeight: number
  ): number {
    const crossAxisLength =
      direction === "LTR" || direction === "RTL"
        ? viewportHeight
        : viewportWidth;
    const spacing = crossAxisLength / Math.max(racerCount, 1);
    return spacing * (laneIndex + 0.5);
  }
}
