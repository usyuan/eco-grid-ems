import { TriangleAlert } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useAirQuality } from "@/api/moenv";
import { StationMap } from "@/components/map/StationMap";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { coordsOf, type MetricKey } from "@/lib/aqiScale";
import { haversineDistanceKm } from "@/lib/geo";
import { useGeolocation } from "@/lib/useGeolocation";

export function MapPage() {
  const { data, isLoading, isError } = useAirQuality();
  const geo = useGeolocation();
  const [metric, setMetric] = useState<MetricKey>("aqi");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [autoSelected, setAutoSelected] = useState(false);

  // 少數測站的經緯度欄位可能是空的，先濾掉才不會在地圖上落到 (0, 0)
  const stations = useMemo(() => (data ?? []).filter((r) => coordsOf(r) !== null), [data]);

  const nearest = useMemo(() => {
    if (!geo.coords || stations.length === 0) return null;
    let best: { siteid: string; distanceKm: number } | null = null;
    for (const record of stations) {
      const position = coordsOf(record);
      if (!position) continue;
      const distanceKm = haversineDistanceKm(
        geo.coords.latitude,
        geo.coords.longitude,
        position.lat,
        position.lng,
      );
      if (!best || distanceKm < best.distanceKm) best = { siteid: record.siteid, distanceKm };
    }
    return best;
  }, [geo.coords, stations]);

  // 進頁面拿到定位後自動選中最近的測站，行為和儀表板的空氣品質卡片一致
  useEffect(() => {
    if (selectedSiteId !== null || autoSelected || !nearest) return;
    setSelectedSiteId(nearest.siteid);
    setAutoSelected(true);
  }, [nearest, selectedSiteId, autoSelected]);

  const selectedDistanceKm = useMemo(() => {
    if (!geo.coords || !selectedSiteId) return null;
    const record = stations.find((r) => r.siteid === selectedSiteId);
    const position = record ? coordsOf(record) : null;
    if (!position) return null;
    return haversineDistanceKm(geo.coords.latitude, geo.coords.longitude, position.lat, position.lng);
  }, [geo.coords, selectedSiteId, stations]);

  const publishtime = stations[0]?.publishtime;

  return (
    <div className="flex h-full min-h-[32rem] flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="font-heading text-lg font-semibold">全台空氣品質地圖</h1>
        <p className="text-xs text-muted-foreground">
          {stations.length > 0 && `${stations.length} 個測站`}
          {publishtime && `・資料時間 ${publishtime}`}
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="min-h-0 w-full flex-1 rounded-xl" />
      ) : isError || stations.length === 0 ? (
        <MapPlaceholder
          icon={<TriangleAlert />}
          title="目前無法取得測站資料"
          description="環境部空氣品質開放資料暫時無法連線，稍後會自動重試。"
        />
      ) : (
        <div className="min-h-0 flex-1">
          <StationMap
            records={stations}
            metric={metric}
            onMetricChange={setMetric}
            selectedSiteId={selectedSiteId}
            onSelect={setSelectedSiteId}
            userCoords={geo.coords}
            selectedDistanceKm={selectedDistanceKm}
          />
        </div>
      )}
    </div>
  );
}

function MapPlaceholder({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription className="max-w-md">{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
