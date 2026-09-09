import { coordsOf, type MetricKey, parseMetric } from "@/lib/aqiScale";
import type { AqiRecord } from "@/types/aqi";

export interface CountyGroup {
  county: string;
  /** 該縣市所有測站座標的平均，聚合 marker 就落在這裡 */
  center: { lat: number; lng: number };
  /** 點擊聚合時要框住的範圍（單一測站的縣市會是零面積，呼叫端需自行處理） */
  bounds: { north: number; south: number; east: number; west: number };
  /** 目前指標下的縣市平均值，全部缺測時為 null */
  value: number | null;
  /** 縣市內有座標的測站數 */
  count: number;
  /** 其中實際有測值、納入平均的測站數 */
  measured: number;
}

/**
 * 把測站依縣市聚合。平均值只計入有測值的測站，缺測的站不會把平均拉低；
 * 一個縣市全部缺測時 value 為 null，marker 會以「無資料」的灰色呈現。
 */
export function groupByCounty(records: AqiRecord[], metric: MetricKey): CountyGroup[] {
  const accumulators = new Map<
    string,
    {
      latSum: number;
      lngSum: number;
      count: number;
      valueSum: number;
      measured: number;
      north: number;
      south: number;
      east: number;
      west: number;
    }
  >();

  for (const record of records) {
    const position = coordsOf(record);
    if (!position) continue;

    // 少數測站的 county 欄位可能是空的，歸到「其他」而不是被丟掉
    const county = record.county || "其他";
    const value = parseMetric(record, metric);
    const existing = accumulators.get(county);

    if (!existing) {
      accumulators.set(county, {
        latSum: position.lat,
        lngSum: position.lng,
        count: 1,
        valueSum: value ?? 0,
        measured: value === null ? 0 : 1,
        north: position.lat,
        south: position.lat,
        east: position.lng,
        west: position.lng,
      });
      continue;
    }

    existing.latSum += position.lat;
    existing.lngSum += position.lng;
    existing.count += 1;
    if (value !== null) {
      existing.valueSum += value;
      existing.measured += 1;
    }
    existing.north = Math.max(existing.north, position.lat);
    existing.south = Math.min(existing.south, position.lat);
    existing.east = Math.max(existing.east, position.lng);
    existing.west = Math.min(existing.west, position.lng);
  }

  return Array.from(accumulators, ([county, acc]) => ({
    county,
    center: { lat: acc.latSum / acc.count, lng: acc.lngSum / acc.count },
    bounds: { north: acc.north, south: acc.south, east: acc.east, west: acc.west },
    value: acc.measured === 0 ? null : acc.valueSum / acc.measured,
    count: acc.count,
    measured: acc.measured,
  }));
}
