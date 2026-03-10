export type CameraMode = "LEADER_TRACK" | "LOCKED_BY_MINIMAP" | "FREE";

export interface CameraState {
  /** Racer to focus on when mode is LOCKED_BY_MINIMAP */
  focusRacerId: string | null;
  mode: CameraMode;
  /** Camera position along cross axis in world pixels */
  worldCross: number;
  /** Camera position along main race axis in world pixels */
  worldMain: number;
  zoom: number;
}

export interface CameraConfig {
  /** Margin before finish where camera stops tracking */
  clampMarginPx: number;
  /** World coordinate of finish line */
  finishWorldCoord: number;
  /** How far ahead of leader to look */
  lookAheadPx: number;
  viewportHeight: number;
  viewportWidth: number;
}
