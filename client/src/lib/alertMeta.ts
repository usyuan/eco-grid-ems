import type { AlertLevel } from "@/types/alerts";

export const ALERT_LEVEL_LABEL: Record<AlertLevel, string> = {
  info: "資訊",
  warning: "警告",
  critical: "嚴重",
};

export const ALERT_LEVEL_VARIANT: Record<AlertLevel, "info" | "warning" | "critical"> = {
  info: "info",
  warning: "warning",
  critical: "critical",
};
