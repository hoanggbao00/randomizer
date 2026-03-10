import { create } from "zustand";

interface UIStore {
  addError: (msg: string) => void;
  addWarning: (msg: string) => void;
  clearMessages: () => void;
  errors: string[];
  resetAll: () => void;
  setTextarea: (value: string) => void;
  textareaInput: string;
  warnings: string[];
}

export const useUIStore = create<UIStore>()((set) => ({
  textareaInput: "",
  errors: [],
  warnings: [],

  setTextarea: (value) => set({ textareaInput: value }),

  addError: (msg) => set((state) => ({ errors: [...state.errors, msg] })),

  addWarning: (msg) => set((state) => ({ warnings: [...state.warnings, msg] })),

  clearMessages: () => set({ errors: [], warnings: [] }),

  resetAll: () => set({ textareaInput: "", errors: [], warnings: [] }),
}));
