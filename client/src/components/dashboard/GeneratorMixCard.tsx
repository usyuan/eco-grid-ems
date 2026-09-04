import { Factory } from "lucide-react";
import { useMemo } from "react";
import { parseGeneratorUnits, useGeneratorUnits } from "@/api/taipower";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORY_COLORS = ["#22c55e", "#38bdf8", "#f59e0b", "#a78bfa", "#f472b6", "#94a3b8", "#2dd4bf", "#fb923c"];

export function GeneratorMixCard() {
  const { data, isLoading, isError } = useGeneratorUnits();

  const categoryTotals = useMemo(() => {
    if (!data) return [];
    const totals = new Map<string, number>();
    for (const unit of parseGeneratorUnits(data)) {
      if (unit.outputMw === null || unit.outputMw <= 0) continue;
      totals.set(unit.category, (totals.get(unit.category) ?? 0) + unit.outputMw);
    }
    const sum = Array.from(totals.values()).reduce((a, b) => a + b, 0);
    return Array.from(totals.entries())
      .map(([category, outputMw]) => ({ category, outputMw, pct: sum > 0 ? (outputMw / sum) * 100 : 0 }))
      .sort((a, b) => b.outputMw - a.outputMw);
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Factory className="size-4" />
          全國機組發電結構
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-2 w-full" />
            ))}
          </div>
        ) : isError || categoryTotals.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">目前無法取得台電機組資料</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {categoryTotals.map((row, i) => (
              <div key={row.category} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">{row.category}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${row.pct}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {Math.round(row.outputMw).toLocaleString()} MW
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
