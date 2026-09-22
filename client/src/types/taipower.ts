/**
 * 依 2026-09-03 實測校正。台電開放資料的數值欄位一律是字串，
 * 且常混雜 "-"、"N/A"、負值（儲能負載＝充電中）與含 "(xx.xxx%)" 的小計列，
 * 使用時請透過 parseGeneratorUnits() 轉換，不要直接 parseFloat 原始欄位。
 */
export interface TaipowerGeneratorUnitRecord {
  /** 機組分類，如「燃氣」「太陽能」「水力」；少數分類字串內殘留來源網頁的 HTML 標籤（如 "</b>"），需自行清除 */
  "機組類型": string;
  /** 機組名稱；值為 "小計" 的列是該分類的小計列，不是實際機組，需過濾掉 */
  "機組名稱": string;
  /** 裝置容量 (MW)；可能是 "-"，小計列會附帶 "(佔比%)" 後綴 */
  "裝置容量(MW)": string;
  /** 淨發電量 (MW)；可能為負值（儲能充電）、"N/A"，小計列會附帶 "(佔比%)" 後綴 */
  "淨發電量(MW)": string;
  "淨發電量/裝置容量比(%)": string;
  "備註": string;
}

export interface TaipowerGeneratorUnitsResponse {
  /** 資料時間戳，格式 "2026-09-03T15:00:00" */
  DateTime: string;
  aaData: TaipowerGeneratorUnitRecord[];
}

/** 目前瞬時負載，單位「萬瓩」= 10 MW（換算 MW 需 ×10） */
export interface TaipowerCurrentLoadRecord {
  curr_load: string;
  curr_util_rate: string;
}

/** 今日預測尖峰 */
export interface TaipowerForecastPeakRecord {
  fore_maxi_sply_capacity: string;
  fore_peak_dema_load: string;
  fore_peak_resv_capacity: string;
  fore_peak_resv_rate: string;
  fore_peak_resv_indicator: string;
  fore_peak_hour_range: string;
  publish_time: string;
}

/** 昨日尖峰實績 */
export interface TaipowerYesterdayPeakRecord {
  yday_date: string;
  yday_maxi_sply_capacity: string;
  yday_peak_dema_load: string;
  yday_peak_resv_capacity: string;
  yday_peak_resv_rate: string;
  yday_peak_resv_indicator: string;
}

/** 今日即時尖峰紀錄 */
export interface TaipowerRealtimeHourlyPeakRecord {
  real_hr_maxi_sply_capacity: string;
  real_hr_peak_time: string;
}

/**
 * 電力供需摘要（d006020/001.json）的 records 是「4 種不同形狀物件」混在同一陣列裡（依索引固定順序，
 * 非依欄位名稱可靠區分），請用 parseLoadPara() 依欄位是否存在來分辨，不要用 records[n] 硬取索引。
 */
export type TaipowerLoadParaRecord =
  | TaipowerCurrentLoadRecord
  | TaipowerForecastPeakRecord
  | TaipowerYesterdayPeakRecord
  | TaipowerRealtimeHourlyPeakRecord;

export interface TaipowerLoadParaResponse {
  success: string;
  result: { resource_id: string };
  records: TaipowerLoadParaRecord[];
}
