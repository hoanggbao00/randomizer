import { create } from "zustand";
import type { PlaybackPhase } from "@/game/stores/playback-store";

export interface PlannedCinematicInstanceInfo {
  affectedRacerIds: string[];
  id: string;
  prefabId: string;
  startMs: number;
}

export interface DebugFrameInfo {
  activeCinematicLabels: string[];
  activeCinematicSprites: number;
  elapsedMs: number;
  phase: PlaybackPhase;
}

interface DebugStore {
  frame: DebugFrameInfo | null;
  plannedCinematics: PlannedCinematicInstanceInfo[];
  reset: () => void;
  setFrame: (frame: DebugFrameInfo) => void;
  setPlannedCinematics: (items: PlannedCinematicInstanceInfo[]) => void;
}

export const useDebugStore = create<DebugStore>()((set) => ({
  frame: {
    elapsedMs: 0,
    phase: "IDLE",
    activeCinematicSprites: 0,
    activeCinematicLabels: [],
  },
  plannedCinematics: [],
  setFrame: (frame) => set({ frame }),
  setPlannedCinematics: (items) => set({ plannedCinematics: items }),
  reset: () => set({ frame: null, plannedCinematics: [] }),
}));
