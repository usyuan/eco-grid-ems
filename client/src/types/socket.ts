import type { AlertEvent } from "./alerts";
import type { EquipmentNode } from "./equipment";

export interface GridFrequencyTick {
  frequency: number;
  timestamp: number;
}

export interface ServerToClientEvents {
  "grid:frequency_tick": (payload: GridFrequencyTick) => void;
  "equipment:status_update": (payload: Partial<EquipmentNode> & { id: string }) => void;
  "alert:broadcast": (payload: AlertEvent) => void;
  "equipment:snapshot": (payload: EquipmentNode[]) => void;
}

export interface ClientToServerEvents {
  "equipment:request_snapshot": () => void;
}
