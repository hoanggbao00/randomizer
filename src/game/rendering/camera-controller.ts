import type { CameraConfig } from "@/game/types/camera";
import type { RaceDirection } from "@/game/types/race";
import type { RacerRuntimeState } from "@/game/types/racer";
import { clamp } from "@/game/utils/clamp";
import { expSmooth } from "@/game/utils/lerp";

export interface CameraUpdateResult {
  worldCross: number;
  worldMain: number;
}

/**
 * CameraController tracks the race leader and smoothly follows them.
 * Clamps camera near finish line to prevent viewport overshoot.
 */
export class CameraController {
  private smoothedMain = 0;
  private maxLeaderMain = 0;
  private readonly config: CameraConfig;

  constructor(config: CameraConfig) {
    this.config = config;
  }

  reset(): void {
    this.smoothedMain = 0;
    this.maxLeaderMain = 0;
  }

  update(
    racerStates: Record<string, RacerRuntimeState>,
    direction: RaceDirection,
    deltaMs: number
  ): CameraUpdateResult {
    const dtSec = deltaMs / 1000;
    const {
      viewportWidth,
      viewportHeight,
      finishWorldCoord,
      lookAheadPx,
      clampMarginPx,
    } = this.config;

    const mainAxisLength =
      direction === "LTR" || direction === "RTL"
        ? viewportWidth
        : viewportHeight;

    // Find leader: racer with highest worldMain that is not eliminated
    let leaderMain = 0;
    for (const state of Object.values(racerStates)) {
      if (!state.isEliminated && state.worldMain > leaderMain) {
        leaderMain = state.worldMain;
      }
    }
    // Prevent camera from moving backwards when the leader is eliminated.
    this.maxLeaderMain = Math.max(this.maxLeaderMain, leaderMain);

    // Target camera position: center the leader in the viewport with a
    // look-ahead offset so the leader appears slightly behind center.
    // cameraMain is the world coordinate of the viewport's left/top edge.
    const halfViewport = mainAxisLength / 2;
    const maxCameraMain = finishWorldCoord - mainAxisLength + clampMarginPx;
    const targetMain = clamp(
      this.maxLeaderMain - halfViewport + lookAheadPx,
      0,
      maxCameraMain
    );

    // Smooth camera movement
    this.smoothedMain = expSmooth(this.smoothedMain, targetMain, 4, dtSec);

    // Cross axis stays centered
    const crossAxisLength =
      direction === "LTR" || direction === "RTL"
        ? viewportHeight
        : viewportWidth;
    const worldCross = crossAxisLength / 2;

    return {
      worldMain: this.smoothedMain,
      worldCross,
    };
  }
}
