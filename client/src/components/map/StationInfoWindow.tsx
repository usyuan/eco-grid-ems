import { InfoWindow } from "@vis.gl/react-google-maps";
import { Clock, MapPin, Wind, X } from "lucide-react";
import { coordsOf, levelOf, METRICS, type MetricKey, parseMetric, windDirectionLabel } from "@/lib/aqiScale";
import type { AqiRecord } from "@/types/aqi";

/** 氣泡窄，六項污染物排成 2×3 而不是一列攤開 */
const POLLUTANTS: { key: keyof AqiRecord; label: string; unit: string }[] = [
  { key: "pm2.5", label: "PM2.5", unit: "μg/m³" },
  { key: "pm10", label: "PM10", unit: "μg/m³" },
  { key: "o3", label: "O₃", unit: "ppb" },
  { key: "no2", label: "NO₂", unit: "ppb" },
  { key: "so2", label: "SO₂", unit: "ppb" },
  { key: "co", label: "CO", unit: "ppm" },
];

interface StationInfoWindowProps {
  record: AqiRecord;
  metric: MetricKey;
  /** 使用者目前位置到這個測站的距離，未取得定位時為 null */
  distanceKm: number | null;
  onClose: () => void;
}

export function StationInfoWindow({ record, metric, distanceKm, onClose }: StationInfoWindowProps) {
  const position = coordsOf(record);
  if (!position) return null;

  const value = parseMetric(record, metric);
  const level = levelOf(value, metric);
  const meta = METRICS[metric];
  const wind = windDirectionLabel(record.wind_direc);

  return (
    <InfoWindow
      position={position}
      // 徽章半徑約 14px，往上讓開才不會蓋住被點選的 marker
      pixelOffset={[0, -18]}
      headerDisabled
      onCloseClick={onClose}
    >
      <div className="flex w-64 flex-col gap-3 text-foreground">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold">{record.sitename}</p>
            <p className="text-xs text-muted-foreground">{record.county}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="-mt-1 -mr-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">
              {meta.label}
              {meta.unit && `（${meta.unit}）`}
            </p>
            <p className="text-3xl leading-none font-semibold tabular-nums">
              {value === null ? "—" : metric === "aqi" ? Math.round(value) : value}
            </p>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: level.color, color: level.onColor }}
          >
            {level.label}
          </span>
        </div>

        {record.pollutant && (
          <p className="text-xs text-muted-foreground">
            主要污染物：<span className="text-foreground">{record.pollutant}</span>
          </p>
        )}

        <div className="grid grid-cols-3 gap-x-2 gap-y-2 border-t pt-3">
          {POLLUTANTS.map(({ key, label, unit }) => (
            <div key={key} title={unit}>
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-sm font-medium tabular-nums">{record[key] || "—"}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 border-t pt-3 text-[11px] text-muted-foreground">
          {record.wind_speed && (
            <p className="flex items-center gap-1.5">
              <Wind className="size-3 shrink-0" />
              風速 {record.wind_speed} m/s{wind && `・${wind}風`}
            </p>
          )}
          {distanceKm !== null && (
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3 shrink-0" />
              距離你約 {distanceKm.toFixed(1)} 公里
            </p>
          )}
          <p className="flex items-center gap-1.5">
            <Clock className="size-3 shrink-0" />
            {record.publishtime || "無更新時間"}
          </p>
        </div>
      </div>
    </InfoWindow>
  );
}
