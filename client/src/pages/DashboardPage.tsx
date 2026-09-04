import { Activity, AlertTriangle, Server, Zap } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { AirQualityCard } from "@/components/dashboard/AirQualityCard";
import { FrequencyChart } from "@/components/dashboard/FrequencyChart";
import { GenerationMixChart } from "@/components/dashboard/GenerationMixChart";
import { GeneratorMixCard } from "@/components/dashboard/GeneratorMixCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PowerSupplyCard } from "@/components/dashboard/PowerSupplyCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ALERT_LEVEL_LABEL, ALERT_LEVEL_VARIANT } from "@/lib/alertMeta";
import { selectUnacknowledgedCount, useAlertStore } from "@/store/useAlertStore";
import {
  selectEquipmentList,
  selectLatestFrequency,
  selectTotalOutputKw,
  useEMSStore,
} from "@/store/useEMSStore";

export function DashboardPage() {
  const equipment = useEMSStore(useShallow(selectEquipmentList));
  const totalOutputKw = useEMSStore(selectTotalOutputKw);
  const frequency = useEMSStore(selectLatestFrequency);
  const unacknowledged = useAlertStore(selectUnacknowledgedCount);
  const recentAlerts = useAlertStore(useShallow((s) => s.alerts.slice(0, 5)));

  const onlineCount = equipment.filter((e) => e.status === "online").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="總發電輸出" value={totalOutputKw.toLocaleString()} unit="kW" icon={Zap} tone="primary" />
        <KpiCard
          label="電網頻率"
          value={frequency.toFixed(3)}
          unit="Hz"
          icon={Activity}
          tone={Math.abs(frequency - 60) > 0.3 ? "warning" : "info"}
        />
        <KpiCard label="上線設備" value={`${onlineCount}/${equipment.length}`} icon={Server} tone="primary" />
        <KpiCard
          label="未處理告警"
          value={String(unacknowledged)}
          icon={AlertTriangle}
          tone={unacknowledged > 0 ? "critical" : "primary"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FrequencyChart />
        <GenerationMixChart />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>近期告警</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAlerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">目前沒有告警事件</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentAlerts.map((alert) => (
                <li key={alert.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                  <Badge variant={ALERT_LEVEL_VARIANT[alert.level]}>{ALERT_LEVEL_LABEL[alert.level]}</Badge>
                  <span className="text-sm">{alert.title}</span>
                  <span className="ml-auto text-xs text-muted">
                    {new Date(alert.timestamp).toLocaleTimeString("zh-TW", { hour12: false })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PowerSupplyCard />
        <AirQualityCard />
        <GeneratorMixCard />
      </div>
    </div>
  );
}
