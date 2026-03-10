import { create } from "zustand";
import type { PlaybackPhase } from "@/game/stores/playback-store";

export interface DebugFrameInfo {
  activeCinematicLabels: string[];
  activeCinematicSprites: number;
  elapsedMs: number;
  phase: PlaybackPhase;
}

interface DebugStore {
  frame: DebugFrameInfo | null;
  reset: () => void;
  setFrame: (frame: DebugFrameInfo) => void;
}

export const useDebugStore = create<DebugStore>()((set) => ({
  frame: null,
  setFrame: (frame) => set({ frame }),
  reset: () => set({ frame: null }),
}));
