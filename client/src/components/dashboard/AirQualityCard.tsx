import { MapPin, Wind } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAirQuality } from "@/api/moenv";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { haversineDistanceKm } from "@/lib/geo";
import { useGeolocation } from "@/lib/useGeolocation";
import type { AlertLevel } from "@/types/alerts";

const STATUS_VARIANT: Record<string, AlertLevel | "online"> = {
  良好: "online",
  普通: "warning",
  對敏感族群不健康: "warning",
  對所有族群不健康: "critical",
  非常不健康: "critical",
  危害: "critical",
};

export function AirQualityCard() {
  const { data, isLoading, isError } = useAirQuality();
  const geo = useGeolocation();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [autoSelected, setAutoSelected] = useState(false);

  const nearestSite = useMemo(() => {
    if (!data || !geo.coords) return null;
    let best: { siteid: string; distanceKm: number } | null = null;
    for (const r of data) {
      const lat = Number(r.latitude);
      const lon = Number(r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const distanceKm = haversineDistanceKm(geo.coords.latitude, geo.coords.longitude, lat, lon);
      if (!best || distanceKm < best.distanceKm) best = { siteid: r.siteid, distanceKm };
    }
    return best;
  }, [data, geo.coords]);

  useEffect(() => {
    if (selectedSiteId !== null || !data) return;
    if (nearestSite) {
      setSelectedSiteId(nearestSite.siteid);
      setAutoSelected(true);
    } else if (geo.status === "error" || geo.status === "unsupported") {
      setSelectedSiteId(data[0]?.siteid ?? null);
    }
  }, [nearestSite, data, geo.status, selectedSiteId]);

  const sortedSites = useMemo(
    () => (data ? [...data].sort((a, b) => (a.county + a.sitename).localeCompare(b.county + b.sitename)) : []),
    [data],
  );

  const selected = data?.find((r) => r.siteid === selectedSiteId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wind className="size-4" />
          空氣品質
        </CardTitle>
        {sortedSites.length > 0 && (
          <select
            value={selectedSiteId ?? ""}
            onChange={(e) => {
              setSelectedSiteId(e.target.value);
              setAutoSelected(false);
            }}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-primary"
          >
            {sortedSites.map((site) => (
              <option key={site.siteid} value={site.siteid}>
                {site.county}・{site.sitename}
              </option>
            ))}
          </select>
        )}
      </CardHeader>
      <CardContent>
        {isLoading || geo.status === "loading" ? (
          <p className="py-8 text-center text-sm text-muted">
            {geo.status === "loading" ? "正在定位中…" : "載入中…"}
          </p>
        ) : isError || !selected ? (
          <p className="py-8 text-center text-sm text-muted">目前無法取得空氣品質資料</p>
        ) : (
          <div className="flex flex-col gap-3">
            {autoSelected && nearestSite && (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <MapPin className="size-3" />
                依你目前位置自動選取最近測站（約 {nearestSite.distanceKm.toFixed(1)} 公里）
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {selected.county}・{selected.sitename}
                </p>
                <p className="text-xs text-muted">更新時間 {selected.publishtime}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums">{selected.aqi || "—"}</p>
                <Badge variant={STATUS_VARIANT[selected.status] ?? "info"}>{selected.status || "無資料"}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-center">
              <div>
                <p className="text-xs text-muted">PM2.5</p>
                <p className="text-sm font-medium tabular-nums">{selected["pm2.5"] || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">PM10</p>
                <p className="text-sm font-medium tabular-nums">{selected.pm10 || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">O3</p>
                <p className="text-sm font-medium tabular-nums">{selected.o3 || "—"}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
