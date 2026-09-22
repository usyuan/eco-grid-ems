import { Gauge } from "lucide-react";
import type { ReactNode } from "react";
import { parseLoadPara, usePowerSupply } from "@/api/taipower";
import { InfoTip } from "@/components/dashboard/InfoTip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({ label, value, info }: { label: string; value: string; info: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <InfoTip label={label}>{info}</InfoTip>
      </div>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// 台電原始值是「萬瓩」，畫面上已換成 MW；說明裡交代換算，免得使用者對照台電官網時以為數字差了 10 倍
const WAN_KW_NOTE = <p>台電原始值單位為「萬瓩」，×10 換算成 MW。</p>;
// 更新頻率寫的是台電發布資料的週期（data.gov.tw dataset 162595 標示每 10 分），不是前端的輪詢間隔
const SOURCE_NOTE = <p className="opacity-70">資料：台電電力供需摘要，台電每 10 分鐘更新一次。</p>;

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
                  info={
                    <>
                      <p>全國此刻的瞬間用電負載，單位 MW（百萬瓦，1 MW = 1,000 kW）。</p>
                      {WAN_KW_NOTE}
                      {SOURCE_NOTE}
                    </>
                  }
                />
                <Stat
                  label="今日預測尖峰"
                  value={parsed.forecastPeakDemandMw !== null ? `${parsed.forecastPeakDemandMw.toLocaleString()} MW` : "—"}
                  info={
                    <>
                      <p>台電預估今天用電最高時段的負載，單位 MW。</p>
                      {WAN_KW_NOTE}
                      {SOURCE_NOTE}
                    </>
                  }
                />
                <Stat
                  label="今日預測備轉率"
                  value={parsed.forecastReserveRatePct !== null ? `${parsed.forecastReserveRatePct}%` : "—"}
                  info={
                    <>
                      <p>預估今日尖峰時段的電力餘裕，單位 %。</p>
                      <p>備轉容量率 =（供電能力 − 尖峰負載）÷ 尖峰負載 × 100%</p>
                      <p>
                        台電燈號：≥ 10% 綠燈（供電充裕）、6–10% 黃燈（供電吃緊）、≤ 6% 橘燈（供電警戒）；備轉容量
                        ≤ 90 萬瓩為紅燈、≤ 50 萬瓩為黑燈。
                      </p>
                      {SOURCE_NOTE}
                    </>
                  }
                />
                <Stat
                  label="昨日尖峰實績"
                  value={parsed.yesterdayPeakDemandMw !== null ? `${parsed.yesterdayPeakDemandMw.toLocaleString()} MW` : "—"}
                  info={
                    <>
                      <p>昨天實際發生的最高用電負載，單位 MW，可與今日預測尖峰對照。</p>
                      {WAN_KW_NOTE}
                      {SOURCE_NOTE}
                    </>
                  }
                />
              </div>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}
