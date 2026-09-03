export type EquipmentType = "solar" | "wind" | "battery" | "inverter" | "meter";
export type EquipmentStatus = "online" | "offline" | "warning" | "critical";

export interface EquipmentNode {
  id: string;
  name: string;
  type: EquipmentType;
  status: EquipmentStatus;
  outputKw: number;
  capacityKw: number;
  soc?: number;
  location: string;
  lastUpdated: number;
}

export type AlertLevel = "info" | "warning" | "critical";

export interface AlertEvent {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  source: string;
  timestamp: number;
  acknowledged: boolean;
}

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
