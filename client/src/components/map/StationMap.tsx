import { APIProvider, Map, type MapCameraChangedEvent, useMap } from "@vis.gl/react-google-maps";
import { Crosshair, Layers } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MapLegend } from "@/components/map/MapLegend";
import { StationInfoWindow } from "@/components/map/StationInfoWindow";
import { StationMarker } from "@/components/map/StationMarker";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTheme } from "@/hooks/useTheme";
import { coordsOf, METRIC_ORDER, METRICS, type MetricKey } from "@/lib/aqiScale";
import {
  BADGE_ZOOM_THRESHOLD,
  DEFAULT_ZOOM,
  FOCUS_ZOOM,
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
  TAIWAN_CENTER,
} from "@/lib/mapConfig";
import type { AqiRecord } from "@/types/aqi";

interface StationMapProps {
  records: AqiRecord[];
  metric: MetricKey;
  onMetricChange: (metric: MetricKey) => void;
  selectedSiteId: string | null;
  onSelect: (siteid: string | null) => void;
  userCoords: { latitude: number; longitude: number } | null;
  /** 選中測站與使用者位置的距離，未取得定位時為 null */
  selectedDistanceKm: number | null;
}

export function StationMap(props: StationMapProps) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} language="zh-TW" region="TW">
      <MapSurface {...props} />
    </APIProvider>
  );
}

/**
 * 地圖本體與浮層。浮層放在 <Map> 外面、共用一個 relative 容器，
 * 這樣不必依賴 vis.gl 內部容器的定位方式。
 */
function MapSurface({
  records,
  metric,
  onMetricChange,
  selectedSiteId,
  onSelect,
  userCoords,
  selectedDistanceKm,
}: StationMapProps) {
  const map = useMap();
  const { theme } = useTheme();
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const selected = records.find((r) => r.siteid === selectedSiteId) ?? null;

  // 從清單或自動定位選到畫面外的測站時才移動地圖；直接點 marker 選取時
  // 該點本來就在視野內，不移動才不會有惱人的跳動。
  useEffect(() => {
    if (!map || !selected) return;
    const position = coordsOf(selected);
    if (!position) return;
    if (map.getBounds()?.contains(position)) return;
    map.panTo(position);
    if ((map.getZoom() ?? 0) < FOCUS_ZOOM) map.setZoom(FOCUS_ZOOM);
  }, [map, selected]);

  const panToUser = useCallback(() => {
    if (!map || !userCoords) return;
    map.panTo({ lat: userCoords.latitude, lng: userCoords.longitude });
    map.setZoom(FOCUS_ZOOM);
  }, [map, userCoords]);

  const expanded = zoom >= BADGE_ZOOM_THRESHOLD;

  return (
    <div className="relative size-full overflow-hidden rounded-xl border">
      <Map
        mapId={GOOGLE_MAPS_MAP_ID}
        defaultCenter={TAIWAN_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        // 地圖跟著全站主題切換，不然深色模式下會是一大塊刺眼的白。
        // colorScheme 只能在建構地圖時指定，切換主題等於重建一次地圖實例。
        colorScheme={theme === "dark" ? "DARK" : "LIGHT"}
        // 快取地圖實例：Maps JavaScript API 是以「map load」計費，而開發時的
        // StrictMode 雙重掛載、每次進出本頁、主題切換都各算一次。開啟後
        // 相同設定的實例會被重複使用，可觀地省下配額。
        reuseMaps
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        // 關掉 Google 自家的餐廳、車站等圖示，避免和測站 marker 混淆
        clickableIcons={false}
        onZoomChanged={(e: MapCameraChangedEvent) => setZoom(e.detail.zoom)}
        onClick={() => onSelect(null)}
        className="size-full"
      >
        {records.map((record) => (
          <StationMarker
            key={record.siteid}
            record={record}
            metric={metric}
            expanded={expanded}
            selected={record.siteid === selectedSiteId}
            onSelect={onSelect}
          />
        ))}

        {selected && (
          <StationInfoWindow
            record={selected}
            metric={metric}
            distanceKm={selectedDistanceKm}
            onClose={() => onSelect(null)}
          />
        )}
      </Map>

      {/* 浮層容器本身不吃滑鼠事件，只有內部控制項可點，才不會擋住地圖拖曳 */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
        <div className="flex flex-wrap items-start gap-2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg border bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur-sm">
            <Layers className="size-3.5 shrink-0 text-muted-foreground" />
            <ToggleGroup
              value={[metric]}
              onValueChange={(value: string[]) => {
                if (value[0]) onMetricChange(value[0] as MetricKey);
              }}
              variant="outline"
              size="sm"
            >
              {METRIC_ORDER.map((key) => (
                <ToggleGroupItem key={key} value={key}>
                  {METRICS[key].label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {userCoords && (
            <Button
              variant="outline"
              size="sm"
              onClick={panToUser}
              className="pointer-events-auto bg-card/95 shadow-lg backdrop-blur-sm"
            >
              <Crosshair data-icon="inline-start" />
              回到我的位置
            </Button>
          )}
        </div>

        <div className="w-fit">
          <MapLegend metric={metric} />
        </div>
      </div>
    </div>
  );
}
