import type { RacerAnimState } from "@/game/types/racer";
import type { RacerTimeline, TimelineKeyframe } from "@/game/types/timeline";
import { lerp } from "@/game/utils/lerp";

const IDLE_KEYFRAME: TimelineKeyframe = {
  tMs: 0,
  worldMain: 0,
  speedPxPerSec: 0,
  animState: "idle" as RacerAnimState,
  activeEventIds: [],
};

/**
 * Finds the two keyframes surrounding a given time and returns interpolated values.
 */
export function interpolateKeyframe(
  timeline: RacerTimeline,
  atMs: number
): TimelineKeyframe {
  const { keyframes } = timeline;

  if (keyframes.length === 0) {
    return { ...IDLE_KEYFRAME, tMs: atMs };
  }

  const first = keyframes[0];
  const last = keyframes.at(-1);

  if (!first) {
    return { ...IDLE_KEYFRAME, tMs: atMs };
  }

  if (!last) {
    return { ...first };
  }

  if (atMs >= last.tMs) {
    return { ...last };
  }

  if (atMs <= first.tMs) {
    return { ...first };
  }

  // Binary search for surrounding keyframes
  let lo = 0;
  let hi = keyframes.length - 1;

  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if ((keyframes[mid]?.tMs ?? 0) <= atMs) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const kfA = keyframes[lo];
  const kfB = keyframes[hi];

  if (!kfA) {
    return { ...last };
  }

  if (!kfB) {
    return { ...kfA };
  }

  const t = (atMs - kfA.tMs) / (kfB.tMs - kfA.tMs);

  return {
    tMs: atMs,
    worldMain: lerp(kfA.worldMain, kfB.worldMain, t),
    speedPxPerSec: lerp(kfA.speedPxPerSec, kfB.speedPxPerSec, t),
    // Use kfA's discrete state (no interpolation for state)
    animState: kfA.animState,
    activeEventIds: kfA.activeEventIds,
  };
}
