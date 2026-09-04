import { Battery, Cpu, Gauge, Sun, Wind, type LucideIcon } from "lucide-react";
import type { EquipmentStatus, EquipmentType } from "@/types/equipment";

export const TYPE_ICON: Record<EquipmentType, LucideIcon> = {
  solar: Sun,
  wind: Wind,
  battery: Battery,
  inverter: Cpu,
  meter: Gauge,
};

export const TYPE_LABEL: Record<EquipmentType, string> = {
  solar: "太陽能",
  wind: "風力",
  battery: "儲能",
  inverter: "逆變器",
  meter: "電錶",
};

export const STATUS_LABEL: Record<EquipmentStatus, string> = {
  online: "運轉中",
  warning: "警告",
  critical: "嚴重",
  offline: "離線",
};

export const STATUS_BADGE_VARIANT: Record<EquipmentStatus, "online" | "warning" | "destructive" | "offline"> = {
  online: "online",
  warning: "warning",
  critical: "destructive",
  offline: "offline",
};

export function formatRelativeTime(ts: number): string {
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 5) return "剛剛";
  if (diffSec < 60) return `${diffSec} 秒前`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr} 小時前`;
}
