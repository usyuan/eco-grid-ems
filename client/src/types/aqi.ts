/**
 * 依 2026-09-03 實測校正。環境部 aqx_p_432 直接回傳「裸陣列」，
 * 沒有 records 外層包裝；數值欄位一律是字串，缺測時為空字串 ""。
 */
export interface AqiRecord {
  sitename: string;
  county: string;
  aqi: string;
  pollutant: string;
  status: string;
  so2: string;
  co: string;
  o3: string;
  o3_8hr: string;
  pm10: string;
  "pm2.5": string;
  no2: string;
  nox: string;
  no: string;
  wind_speed: string;
  wind_direc: string;
  /** 格式 "2026/09/03 15:00:00" */
  publishtime: string;
  co_8hr: string;
  "pm2.5_avg": string;
  pm10_avg: string;
  so2_avg: string;
  longitude: string;
  latitude: string;
  siteid: string;
}

export type AqiResponse = AqiRecord[];
