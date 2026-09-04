import { MapPin, Wind } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAirQuality } from "@/api/moenv";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { haversineDistanceKm } from "@/lib/geo";
import { useGeolocation } from "@/lib/useGeolocation";

const STATUS_VARIANT: Record<string, "online" | "warning" | "destructive" | "info"> = {
  良好: "online",
  普通: "warning",
  對敏感族群不健康: "warning",
  對所有族群不健康: "destructive",
  非常不健康: "destructive",
  危害: "destructive",
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

  const selectItems = useMemo(
    () => [
      { label: "選擇測站", value: null as string | null },
      ...sortedSites.map((site) => ({ label: `${site.county}・${site.sitename}`, value: site.siteid })),
    ],
    [sortedSites],
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
          <Select
            items={selectItems}
            value={selectedSiteId}
            onValueChange={(value: string | null) => {
              if (!value) return;
              setSelectedSiteId(value);
              setAutoSelected(false);
            }}
          >
            <SelectTrigger size="sm" className="max-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {sortedSites.map((site) => (
                  <SelectItem key={site.siteid} value={site.siteid}>
                    {site.county}・{site.sitename}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent>
        {isLoading || geo.status === "loading" ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError || !selected ? (
          <p className="py-8 text-center text-sm text-muted-foreground">目前無法取得空氣品質資料</p>
        ) : (
          <div className="flex flex-col gap-3">
            {autoSelected && nearestSite && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                依你目前位置自動選取最近測站（約 {nearestSite.distanceKm.toFixed(1)} 公里）
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {selected.county}・{selected.sitename}
                </p>
                <p className="text-xs text-muted-foreground">更新時間 {selected.publishtime}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums">{selected.aqi || "—"}</p>
                <Badge variant={STATUS_VARIANT[selected.status] ?? "info"}>{selected.status || "無資料"}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 border-t pt-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">PM2.5</p>
                <p className="text-sm font-medium tabular-nums">{selected["pm2.5"] || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PM10</p>
                <p className="text-sm font-medium tabular-nums">{selected.pm10 || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">O3</p>
                <p className="text-sm font-medium tabular-nums">{selected.o3 || "—"}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
