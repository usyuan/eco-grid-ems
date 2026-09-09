import { AdvancedMarker, AdvancedMarkerAnchorPoint } from "@vis.gl/react-google-maps";
import { memo } from "react";
import { levelOf, type MetricKey } from "@/lib/aqiScale";
import type { CountyGroup } from "@/lib/countyGroups";

interface CountyMarkerProps {
  group: CountyGroup;
  metric: MetricKey;
  onSelect: (group: CountyGroup) => void;
}

function CountyMarkerComponent({ group, metric, onSelect }: CountyMarkerProps) {
  const level = levelOf(group.value, metric);
  // 小數點只在濃度類指標上有意義，AQI 本身是整數
  const text =
    group.value === null ? "—" : metric === "aqi" ? String(Math.round(group.value)) : group.value.toFixed(1);

  return (
    <AdvancedMarker
      position={group.center}
      anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
      // 平均值越高的縣市疊在上層，讓污染熱點不會被鄰近縣市蓋住
      zIndex={Math.round(group.value ?? 0)}
      title={`${group.county}・${group.count} 個測站`}
      onClick={() => onSelect(group)}
    >
      <div
        className="flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-white/70 py-1 pr-2.5 pl-1.5 shadow-md transition-transform hover:scale-105"
        style={{ backgroundColor: level.color, color: level.onColor }}
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-black/15 text-[11px] font-semibold tabular-nums">
          {text}
        </span>
        <span className="text-xs leading-none font-medium whitespace-nowrap">
          {group.county}
          <span className="ml-1 text-[10px] opacity-80 tabular-nums">{group.count}站</span>
        </span>
      </div>
    </AdvancedMarker>
  );
}

export const CountyMarker = memo(CountyMarkerComponent);
