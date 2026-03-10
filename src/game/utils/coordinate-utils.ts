import type { DirectionMapper, WorldCoord } from "@/game/types/coordinate";
import type { RaceDirection } from "@/game/types/race";

/**
 * Creates a DirectionMapper that converts between world coordinates
 * (main axis = race direction, cross axis = lane) and screen pixels.
 *
 * World coordinate system:
 * - main: 0 = start, trackLengthPx = finish
 * - cross: 0 = top/left edge, viewportCrossAxis = bottom/right edge
 */
export function createDirectionMapper(
  direction: RaceDirection,
  trackLengthPx: number
): DirectionMapper {
  switch (direction) {
    case "LTR":
      return {
        toScreen: (w: WorldCoord) => ({ x: w.main, y: w.cross }),
        toWorld: (s: { x: number; y: number }) => ({
          main: s.x,
          cross: s.y,
        }),
      };
    case "RTL":
      return {
        toScreen: (w: WorldCoord) => ({
          x: trackLengthPx - w.main,
          y: w.cross,
        }),
        toWorld: (s: { x: number; y: number }) => ({
          main: trackLengthPx - s.x,
          cross: s.y,
        }),
      };
    case "TTB":
      return {
        toScreen: (w: WorldCoord) => ({ x: w.cross, y: w.main }),
        toWorld: (s: { x: number; y: number }) => ({
          main: s.y,
          cross: s.x,
        }),
      };
    case "BTT":
      return {
        toScreen: (w: WorldCoord) => ({
          x: w.cross,
          y: trackLengthPx - w.main,
        }),
        toWorld: (s: { x: number; y: number }) => ({
          main: trackLengthPx - s.y,
          cross: s.x,
        }),
      };
    default: {
      // Exhaustive check — TypeScript ensures all cases are handled
      const _exhaustive: never = direction;
      throw new Error(`Unknown race direction: ${_exhaustive}`);
    }
  }
}

/**
 * Computes track length from viewport dimensions and direction.
 * Track runs along the main axis.
 */
export function computeTrackLength(
  direction: RaceDirection,
  viewportWidth: number,
  viewportHeight: number,
  minLength = 500
): number {
  const mainAxisLength =
    direction === "LTR" || direction === "RTL" ? viewportWidth : viewportHeight;
  return Math.max(mainAxisLength, minLength);
}

/**
 * Computes lane cross-axis position for a racer.
 * Divides viewport cross axis evenly among all racers.
 */
export function computeLaneCross(
  laneIndex: number,
  racerCount: number,
  direction: RaceDirection,
  viewportWidth: number,
  viewportHeight: number
): number {
  const crossAxisLength =
    direction === "LTR" || direction === "RTL" ? viewportHeight : viewportWidth;
  const spacing = crossAxisLength / racerCount;
  return spacing * (laneIndex + 0.5);
}
