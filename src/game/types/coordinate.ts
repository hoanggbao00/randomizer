/** World position in pixels, origin at track start */
export interface WorldCoord {
  /** Position along cross axis: lane position */
  cross: number;
  /** Position along race axis: 0 = start, trackLength = finish */
  main: number;
}

/** Maps WorldCoord to screen pixel based on direction */
export interface DirectionMapper {
  toScreen: (world: WorldCoord) => { x: number; y: number };
  toWorld: (screen: { x: number; y: number }) => WorldCoord;
}
