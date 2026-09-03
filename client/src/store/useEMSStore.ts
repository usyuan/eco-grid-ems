import { create } from "zustand";
import type { EquipmentNode } from "@/types/equipment";
import type { GridFrequencyTick } from "@/types/socket";

const MAX_FREQUENCY_HISTORY = 120;

interface EMSState {
  connected: boolean;
  frequencyHistory: GridFrequencyTick[];
  equipment: Record<string, EquipmentNode>;

  setConnected: (connected: boolean) => void;
  pushFrequencyTick: (tick: GridFrequencyTick) => void;
  setEquipmentSnapshot: (nodes: EquipmentNode[]) => void;
  patchEquipment: (patch: Partial<EquipmentNode> & { id: string }) => void;
}

export const useEMSStore = create<EMSState>((set) => ({
  connected: false,
  frequencyHistory: [],
  equipment: {},

  setConnected: (connected) => set({ connected }),

  pushFrequencyTick: (tick) =>
    set((state) => {
      const next = [...state.frequencyHistory, tick];
      if (next.length > MAX_FREQUENCY_HISTORY) next.shift();
      return { frequencyHistory: next };
    }),

  setEquipmentSnapshot: (nodes) =>
    set({
      equipment: Object.fromEntries(nodes.map((n) => [n.id, n])),
    }),

  patchEquipment: (patch) =>
    set((state) => {
      const existing = state.equipment[patch.id];
      if (!existing) return state;
      return {
        equipment: {
          ...state.equipment,
          [patch.id]: { ...existing, ...patch },
        },
      };
    }),
}));

export const selectEquipmentList = (state: EMSState) => Object.values(state.equipment);
export const selectLatestFrequency = (state: EMSState) =>
  state.frequencyHistory.at(-1)?.frequency ?? 60;
export const selectTotalOutputKw = (state: EMSState) =>
  Object.values(state.equipment)
    .filter((e) => e.type !== "meter")
    .reduce((sum, e) => sum + e.outputKw, 0);
