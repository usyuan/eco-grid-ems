import { useQuery } from "@tanstack/react-query";
import type {
  TaipowerCurrentLoadRecord,
  TaipowerForecastPeakRecord,
  TaipowerGeneratorUnitsResponse,
  TaipowerLoadParaResponse,
  TaipowerYesterdayPeakRecord,
} from "@/types/taipower";

// 用 || 不用 ??：CI 在 repo variable 未設定時會把它帶成空字串，?? 不會退回預設值
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`請求失敗 (${res.status}): ${url}`);
  return res.json() as Promise<T>;
}

/**
 * 目前瞬時電力供需摘要（尖峰預測、昨日實績），非機組明細。
 * 上游 service.taipower.com.tw 沒有回 Access-Control-Allow-Origin，瀏覽器無法直連，
 * 所以走我們自己的後端代抓（見 server/src/taipowerProxy.ts）。開發與正式環境同一條路。
 */
export function usePowerSupply() {
  return useQuery({
    queryKey: ["powerSupply"],
    queryFn: () => fetchJson<TaipowerLoadParaResponse>(`${API_BASE_URL}/taipower/load-para`),
    // 台電每 10 分鐘才發布一次，輪詢太密只是重複拿同一份；
    // 也不直接設 10 分鐘，因為輪詢與發布時點沒對齊，畫面最壞會落後「10 分 + 輪詢間隔」
    refetchInterval: 300_000,
  });
}

/**
 * 各機組即時出力明細（含太陽能、風力等再生能源分類）。
 * 上游 service.taipower.com.tw 完全沒有回 Access-Control-Allow-Origin，瀏覽器無法直連，
 * 所以走我們自己的後端代抓（見 server/src/taipowerProxy.ts）。開發與正式環境同一條路。
 */
export function useGeneratorUnits() {
  return useQuery({
    queryKey: ["generatorUnits"],
    queryFn: () => fetchJson<TaipowerGeneratorUnitsResponse>(`${API_BASE_URL}/taipower/generator-units`),
    refetchInterval: 300_000,
  });
}

function parseTaipowerNumber(raw: string | undefined): number | null {
  if (!raw || raw === "-" || raw === "N/A") return null;
  // 小計列的數值會附帶 "(26.221%)" 佔比後綴，取 "(" 前面的部分
  const n = Number(raw.split("(")[0].trim());
  return Number.isFinite(n) ? n : null;
}

export interface ParsedGeneratorUnit {
  category: string;
  name: string;
  capacityMw: number | null;
  outputMw: number | null;
}

/** 過濾掉「小計」列、清除分類欄位殘留的 HTML 標籤，並把數值欄位轉成 number */
export function parseGeneratorUnits(data: TaipowerGeneratorUnitsResponse): ParsedGeneratorUnit[] {
  return data.aaData
    .filter((row) => row["機組名稱"] !== "小計")
    .map((row) => ({
      category: row["機組類型"].replace(/<[^>]+>/g, "").trim(),
      name: row["機組名稱"],
      capacityMw: parseTaipowerNumber(row["裝置容量(MW)"]),
      outputMw: parseTaipowerNumber(row["淨發電量(MW)"]),
    }));
}

export interface ParsedLoadPara {
  currLoadMw: number | null;
  currUtilRatePct: number | null;
  forecastPeakDemandMw: number | null;
  forecastReserveRatePct: number | null;
  yesterdayPeakDemandMw: number | null;
}

/**
 * records 是 4 種不同形狀物件混在同一陣列，依欄位是否存在判斷是哪一種，
 * 不要依索引位置存取。curr_load 單位是「萬瓩」，換算 MW 需 ×10。
 */
export function parseLoadPara(data: TaipowerLoadParaResponse): ParsedLoadPara {
  const current = data.records.find((r): r is TaipowerCurrentLoadRecord => "curr_load" in r);
  const forecast = data.records.find((r): r is TaipowerForecastPeakRecord => "fore_peak_dema_load" in r);
  const yesterday = data.records.find((r): r is TaipowerYesterdayPeakRecord => "yday_peak_dema_load" in r);

  return {
    currLoadMw: current ? Number(current.curr_load) * 10 : null,
    currUtilRatePct: current ? Number(current.curr_util_rate) : null,
    forecastPeakDemandMw: forecast ? Number(forecast.fore_peak_dema_load) * 10 : null,
    forecastReserveRatePct: forecast ? Number(forecast.fore_peak_resv_rate) : null,
    yesterdayPeakDemandMw: yesterday ? Number(yesterday.yday_peak_dema_load) * 10 : null,
  };
}
