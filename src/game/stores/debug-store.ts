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
  showOverlay: boolean;
  toggleOverlay: () => void;
}

const DEFAULT_FRAME: DebugFrameInfo = {
  elapsedMs: 0,
  phase: "IDLE",
  activeCinematicSprites: 0,
  activeCinematicLabels: [],
};

export const useDebugStore = create<DebugStore>()((set) => ({
  frame: DEFAULT_FRAME,
  plannedCinematics: [],
  showOverlay: true,
  setFrame: (frame) => set({ frame }),
  setPlannedCinematics: (items) => set({ plannedCinematics: items }),
  toggleOverlay: () => set((prev) => ({ showOverlay: !prev.showOverlay })),
  reset: () => set({ frame: DEFAULT_FRAME, plannedCinematics: [] }),
}));
