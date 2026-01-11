import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LayoutMode = "fixed" | "adaptive";

interface LayoutModeState {
  mode: LayoutMode;
  setMode: (mode: LayoutMode) => void;
  toggle: () => void;
}

export const useLayoutMode = create<LayoutModeState>()(
  persist(
    (set) => ({
      mode: "adaptive", // 默认自适应
      setMode: (mode) => set({ mode }),
      toggle: () =>
        set((state) => ({
          mode: state.mode === "fixed" ? "adaptive" : "fixed",
        })),
    }),
    {
      name: "cc-switch-layout-mode",
    },
  ),
);
