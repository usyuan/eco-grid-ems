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
