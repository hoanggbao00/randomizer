import { create } from "zustand";
import type { RaceConfig } from "@/game/types/race";

const DEFAULT_CONFIG: RaceConfig = {
  seed: "",
  minDurationMs: 10_000,
  targetDurationMs: 15_000,
  trackLengthPx: 0,
  direction: "LTR",
  eventDensity: 0.5,
  allowElimination: false,
  maxRacers: 30,
  scenarioMode: "EVENT_DRIVEN",
};

interface ConfigStore {
  config: RaceConfig;
  resetConfig: () => void;
  setConfig: (patch: Partial<RaceConfig>) => void;
}

export const useConfigStore = create<ConfigStore>()((set) => ({
  config: { ...DEFAULT_CONFIG },

  setConfig: (patch) =>
    set((state) => ({
      config: { ...state.config, ...patch },
    })),

  resetConfig: () => set({ config: { ...DEFAULT_CONFIG } }),
}));
