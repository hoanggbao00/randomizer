import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type PlaybackPhase =
  | "IDLE"
  | "LOADING"
  | "READY"
  | "COUNTDOWN"
  | "PLAYING"
  | "PAUSED"
  | "ENDED";

interface PlaybackStore {
  elapsedMs: number;
  phase: PlaybackPhase;
  reset: () => void;
  setPhase: (phase: PlaybackPhase) => void;
  setTimeScale: (scale: number) => void;
  setWinner: (racerId: string) => void;
  tick: (deltaMs: number) => void;
  timeScale: number;
  winnerRacerId: string | null;
}

export const usePlaybackStore = create<PlaybackStore>()(
  subscribeWithSelector((set) => ({
    phase: "IDLE",
    elapsedMs: 0,
    timeScale: 1,
    winnerRacerId: null,

    setPhase: (phase) => set({ phase }),

    tick: (deltaMs) =>
      set((state) => ({
        elapsedMs: state.elapsedMs + deltaMs * state.timeScale,
      })),

    setTimeScale: (scale) => set({ timeScale: scale }),

    setWinner: (racerId) => set({ winnerRacerId: racerId }),

    reset: () =>
      set({
        phase: "IDLE",
        elapsedMs: 0,
        timeScale: 1,
        winnerRacerId: null,
      }),
  }))
);
