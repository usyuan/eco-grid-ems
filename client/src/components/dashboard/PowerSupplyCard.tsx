import { Gauge } from "lucide-react";
import { parseLoadPara, usePowerSupply } from "@/api/taipower";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : isError || !data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">目前無法取得台電供需資料</p>
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
