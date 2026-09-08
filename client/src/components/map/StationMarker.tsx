import { AdvancedMarker, AdvancedMarkerAnchorPoint } from "@vis.gl/react-google-maps";
import { memo } from "react";
import { coordsOf, levelOf, type MetricKey, parseMetric } from "@/lib/aqiScale";
import { cn } from "@/lib/utils";
import type { AqiRecord } from "@/types/aqi";

interface StationMarkerProps {
  record: AqiRecord;
  metric: MetricKey;
  /** 目前縮放層級是否足以完整顯示數值徽章 */
  expanded: boolean;
  selected: boolean;
  onSelect: (siteid: string) => void;
}

function StationMarkerComponent({ record, metric, expanded, selected, onSelect }: StationMarkerProps) {
  const position = coordsOf(record);
  if (!position) return null;

  const value = parseMetric(record, metric);
  const level = levelOf(value, metric);
  // 小數點只在濃度類指標上有意義，AQI 本身是整數
  const text = value === null ? "—" : metric === "aqi" ? String(Math.round(value)) : String(value);
  // 選中的測站一律展開，否則使用者會看不出自己點了哪一顆
  const showBadge = expanded || selected;
  // 數值越高的測站疊在上層，讓污染熱點不會被鄰近的低值測站蓋住
  const zIndex = selected ? 10_000 : Math.round(value ?? 0);

  return (
    <AdvancedMarker
      position={position}
      anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
      zIndex={zIndex}
      title={`${record.county}・${record.sitename}`}
      onClick={() => onSelect(record.siteid)}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full border-2 font-semibold tabular-nums shadow-md transition-all",
          showBadge ? "min-w-8 px-1.5 py-0.5 text-xs" : "size-3",
          selected ? "scale-125 border-white ring-2 ring-primary" : "border-white/70",
        )}
        style={{ backgroundColor: level.color, color: level.onColor }}
      >
        {showBadge && text}
      </div>
    </AdvancedMarker>
  );
}

export const StationMarker = memo(StationMarkerComponent);
