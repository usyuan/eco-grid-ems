import type { AqiRecord } from "@/types/aqi";

/**
 * 空氣品質指標分級。顏色沿用環境部空氣品質監測網的官方六級色階，
 * 因為是既定標準（民眾在別處也看得到同一套配色），不跟著 light/dark 主題變動，
 * 只切換疊在上面的文字顏色以維持對比。
 */
export type AqiLevelKey = "good" | "moderate" | "sensitive" | "unhealthy" | "veryUnhealthy" | "hazardous";

export interface AqiLevel {
  key: AqiLevelKey;
  label: string;
  /** 色塊背景（官方色） */
  color: string;
  /** 疊在 color 上仍有足夠對比的文字色 */
  onColor: string;
  description: string;
}

export const AQI_LEVELS: AqiLevel[] = [
  { key: "good", label: "良好", color: "#009865", onColor: "#ffffff", description: "空氣品質為良好，污染程度低或無污染" },
  { key: "moderate", label: "普通", color: "#fffb26", onColor: "#1a1a1a", description: "空氣品質普通，對非常少數的敏感族群可能有輕微影響" },
  { key: "sensitive", label: "對敏感族群不健康", color: "#ff9835", onColor: "#1a1a1a", description: "敏感族群可能會有健康影響，一般大眾不太會受影響" },
  { key: "unhealthy", label: "對所有族群不健康", color: "#ca0034", onColor: "#ffffff", description: "所有人都可能開始感到不適，敏感族群影響較明顯" },
  { key: "veryUnhealthy", label: "非常不健康", color: "#670099", onColor: "#ffffff", description: "健康警報，所有人都可能受到較嚴重的健康影響" },
  { key: "hazardous", label: "危害", color: "#7e0123", onColor: "#ffffff", description: "健康威脅達到緊急狀況，所有人都可能受到影響" },
];

/** 無資料（測站當下缺測）時的樣式，不屬於任何一級 */
export const AQI_LEVEL_UNKNOWN: AqiLevel = {
  key: "good",
  label: "無資料",
  color: "#9ca3af",
  onColor: "#ffffff",
  description: "此測站目前無有效測值",
};

export type MetricKey = "aqi" | "pm2.5" | "pm10" | "o3_8hr";

export interface MetricMeta {
  key: MetricKey;
  label: string;
  unit: string;
  /** 六級的分級上界，長度固定為 5；超過最後一個上界即為「危害」 */
  breakpoints: [number, number, number, number, number];
}

/**
 * 各指標的分級斷點取自環境部 AQI 副指標濃度對照表，因此切換指標後
 * 圖例的六個級距顏色仍然代表同一套健康風險等級。
 * O3 用 8 小時移動平均（o3_8hr）而非小時值，AQI 也是這樣算的。
 */
export const METRICS: Record<MetricKey, MetricMeta> = {
  aqi: { key: "aqi", label: "AQI", unit: "", breakpoints: [50, 100, 150, 200, 300] },
  "pm2.5": { key: "pm2.5", label: "PM2.5", unit: "μg/m³", breakpoints: [15.4, 35.4, 54.4, 150.4, 250.4] },
  pm10: { key: "pm10", label: "PM10", unit: "μg/m³", breakpoints: [54, 125, 254, 354, 424] },
  o3_8hr: { key: "o3_8hr", label: "O₃ 8小時", unit: "ppb", breakpoints: [54, 70, 85, 105, 200] },
};

export const METRIC_ORDER: MetricKey[] = ["aqi", "pm2.5", "pm10", "o3_8hr"];

/** 環境部回傳的數值欄位一律是字串，缺測時為空字串 */
export function parseMetric(record: AqiRecord, metric: MetricKey): number | null {
  const raw = record[metric];
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function levelOf(value: number | null, metric: MetricKey): AqiLevel {
  if (value === null) return AQI_LEVEL_UNKNOWN;
  const { breakpoints } = METRICS[metric];
  const index = breakpoints.findIndex((limit) => value <= limit);
  return AQI_LEVELS[index === -1 ? AQI_LEVELS.length - 1 : index];
}

/** 圖例用：把某指標的斷點展開成「0–50」「51–100」…這類可讀區間 */
export function rangeLabels(metric: MetricKey): string[] {
  const { breakpoints } = METRICS[metric];
  return AQI_LEVELS.map((_, i) => {
    const lower = i === 0 ? 0 : breakpoints[i - 1];
    if (i === AQI_LEVELS.length - 1) return `> ${breakpoints[i - 1]}`;
    return `${lower === 0 ? 0 : lower} – ${breakpoints[i]}`;
  });
}

/** 測站座標。經緯度同樣是字串欄位，少數測站可能缺值 */
export function coordsOf(record: AqiRecord): { lat: number; lng: number } | null {
  const lat = Number(record.latitude);
  const lng = Number(record.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

const WIND_DIRECTIONS = ["北", "北北東", "東北", "東北東", "東", "東南東", "東南", "南南東", "南", "南南西", "西南", "西南西", "西", "西北西", "西北", "北北西"];

/** 風向欄位是 0–360 的角度字串，轉成 16 方位中文 */
export function windDirectionLabel(degree: string): string | null {
  if (!degree) return null;
  const value = Number(degree);
  if (!Number.isFinite(value)) return null;
  return WIND_DIRECTIONS[Math.round(value / 22.5) % 16];
}
