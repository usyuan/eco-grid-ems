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
