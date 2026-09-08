import { AQI_LEVELS, METRICS, type MetricKey, rangeLabels } from "@/lib/aqiScale";

/**
 * 色階圖例。分級斷點會隨指標改變，但六個顏色代表的健康風險等級固定，
 * 所以切換指標時只有右側的數值區間會變。
 */
export function MapLegend({ metric }: { metric: MetricKey }) {
  const ranges = rangeLabels(metric);
  const meta = METRICS[metric];

  return (
    <div className="pointer-events-auto rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
      <p className="mb-2 text-[11px] font-medium text-muted-foreground">
        {meta.label}
        {meta.unit && ` (${meta.unit})`}
      </p>
      <ul className="flex flex-col gap-1">
        {AQI_LEVELS.map((level, i) => (
          <li key={level.key} className="flex items-center gap-2 text-[11px]">
            <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: level.color }} />
            <span className="text-muted-foreground tabular-nums">{ranges[i]}</span>
            <span className="ml-auto hidden pl-2 sm:inline">{level.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
