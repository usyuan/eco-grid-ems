import { create } from "zustand";
import type { AlertEvent } from "@/types/alerts";

const MAX_ALERTS = 200;

interface AlertState {
  alerts: AlertEvent[];
  addAlert: (alert: AlertEvent) => void;
  acknowledgeAlert: (id: string) => void;
  acknowledgeAll: () => void;
  clearAll: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],

  addAlert: (alert) =>
    set((state) => {
      const next = [alert, ...state.alerts];
      if (next.length > MAX_ALERTS) next.length = MAX_ALERTS;
      return { alerts: next };
    }),

  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),

  acknowledgeAll: () =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.acknowledged ? a : { ...a, acknowledged: true })),
    })),

  clearAll: () => set({ alerts: [] }),
}));

export const selectUnacknowledgedCount = (state: AlertState) =>
  state.alerts.filter((a) => !a.acknowledged).length;
