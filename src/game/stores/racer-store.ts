import { create } from "zustand";
import type { RacerInput, RacerRuntimeState } from "@/game/types/racer";

function parseRacersFromTextarea(raw: string): RacerInput[] {
  const lines = raw.split("\n");
  const seen = new Set<string>();
  const result: RacerInput[] = [];

  for (const line of lines) {
    const name = line.trim();
    if (!name) {
      continue;
    }

    // Generate unique ID — deduplicate by appending index if name repeats
    let id = name.toLowerCase().replace(/\s+/g, "-");
    if (seen.has(id)) {
      id = `${id}-${result.length}`;
    }
    seen.add(id);

    result.push({ id, name });
  }

  return result;
}

interface RacerStore {
  /**
   * Batch update all racer runtime states in a single store update.
   * Called by PlaybackEngine each frame to sync positions.
   */
  batchUpdateRuntime: (
    updates: Record<string, Partial<RacerRuntimeState>>
  ) => void;
  inputs: RacerInput[];
  reset: () => void;
  runtimeStates: Record<string, RacerRuntimeState>;
  setInputsFromTextarea: (raw: string) => void;
  setRuntimeState: (racerId: string, state: Partial<RacerRuntimeState>) => void;
}

export const useRacerStore = create<RacerStore>()((set) => ({
  inputs: [],
  runtimeStates: {},

  setInputsFromTextarea: (raw) => set({ inputs: parseRacersFromTextarea(raw) }),

  setRuntimeState: (racerId, state) =>
    set((prev) => ({
      runtimeStates: {
        ...prev.runtimeStates,
        [racerId]: { ...prev.runtimeStates[racerId], ...state },
      },
    })),

  batchUpdateRuntime: (updates) =>
    set((prev) => {
      const next = { ...prev.runtimeStates };
      for (const [racerId, patch] of Object.entries(updates)) {
        next[racerId] = { ...next[racerId], ...patch };
      }
      return { runtimeStates: next };
    }),

  reset: () => set({ inputs: [], runtimeStates: {} }),
}));
