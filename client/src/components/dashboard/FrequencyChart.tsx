import * as echarts from "echarts";
import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useEMSStore } from "@/store/useEMSStore";

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("zh-TW", { hour12: false, minute: "2-digit", second: "2-digit" });

export function FrequencyChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, undefined, { renderer: "svg" });
    chartRef.current = chart;

    chart.setOption({
      grid: { left: 48, right: 16, top: 16, bottom: 28 },
      xAxis: {
        type: "category",
        data: [],
        axisLine: { lineStyle: { color: "#22304a" } },
        axisLabel: { color: "#8996ac", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        min: 59.5,
        max: 60.5,
        axisLabel: { color: "#8996ac", fontSize: 11 },
        splitLine: { lineStyle: { color: "#172034" } },
      },
      series: [
        {
          type: "line",
          data: [],
          showSymbol: false,
          smooth: true,
          lineStyle: { color: "#22c55e", width: 2 },
          areaStyle: { color: "rgba(34,197,94,0.08)" },
          markLine: {
            symbol: "none",
            silent: true,
            lineStyle: { color: "#8996ac", type: "dashed" },
            data: [{ yAxis: 60, label: { formatter: "60Hz", color: "#8996ac" } }],
          },
        },
      ],
      tooltip: { trigger: "axis", valueFormatter: (v: number) => `${v} Hz` },
    });

    const resize = () => chart.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = useEMSStore.subscribe((state, prevState) => {
      if (state.frequencyHistory === prevState.frequencyHistory) return;
      const history = state.frequencyHistory;
      chartRef.current?.setOption({
        xAxis: { data: history.map((t) => fmtTime(t.timestamp)) },
        series: [{ data: history.map((t) => t.frequency) }],
      });
    });
    return unsubscribe;
  }, []);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>電網頻率即時波動</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}
