import { Gauge } from "lucide-react";
import { parseLoadPara, usePowerSupply } from "@/api/taipower";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function PowerSupplyCard() {
  const { data, isLoading, isError } = usePowerSupply();

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-4" />
          全國電力供需
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted">載入中…</p>
        ) : isError || !data ? (
          <p className="py-8 text-center text-sm text-muted">目前無法取得台電供需資料</p>
        ) : (
          (() => {
            const parsed = parseLoadPara(data);
            return (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat
                  label="目前負載"
                  value={parsed.currLoadMw !== null ? `${parsed.currLoadMw.toLocaleString()} MW` : "—"}
                />
                <Stat
                  label="今日預測尖峰"
                  value={parsed.forecastPeakDemandMw !== null ? `${parsed.forecastPeakDemandMw.toLocaleString()} MW` : "—"}
                />
                <Stat
                  label="今日預測備轉率"
                  value={parsed.forecastReserveRatePct !== null ? `${parsed.forecastReserveRatePct}%` : "—"}
                />
                <Stat
                  label="昨日尖峰實績"
                  value={parsed.yesterdayPeakDemandMw !== null ? `${parsed.yesterdayPeakDemandMw.toLocaleString()} MW` : "—"}
                />
              </div>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}
