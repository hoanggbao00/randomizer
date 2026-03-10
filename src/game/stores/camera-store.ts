import { create } from "zustand";
import type { CameraMode } from "@/game/types/camera";

interface CameraStore {
  focusRacerId: string | null;
  mode: CameraMode;
  reset: () => void;
  setFocusRacer: (racerId: string | null) => void;
  setMode: (mode: CameraMode) => void;
  setPosition: (main: number, cross: number) => void;
  /** Camera position along cross axis in world pixels */
  worldCross: number;
  /** Camera position along main race axis in world pixels */
  worldMain: number;
  zoom: number;
}

export const useCameraStore = create<CameraStore>()((set) => ({
  worldMain: 0,
  worldCross: 0,
  zoom: 1,
  mode: "LEADER_TRACK",
  focusRacerId: null,

  setPosition: (main, cross) => set({ worldMain: main, worldCross: cross }),
  setMode: (mode) => set({ mode }),
  setFocusRacer: (racerId) => set({ focusRacerId: racerId }),

  reset: () =>
    set({
      worldMain: 0,
      worldCross: 0,
      zoom: 1,
      mode: "LEADER_TRACK",
      focusRacerId: null,
    }),
}));
