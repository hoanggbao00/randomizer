import { create } from "zustand";
import type { RaceScenario } from "@/game/types/race-scenario";

interface ScenarioStore {
  clearScenario: () => void;
  scenario: RaceScenario | null;
  setScenario: (s: RaceScenario) => void;
}

export const useScenarioStore = create<ScenarioStore>()((set) => ({
  scenario: null,
  setScenario: (s) => set({ scenario: s }),
  clearScenario: () => set({ scenario: null }),
}));
