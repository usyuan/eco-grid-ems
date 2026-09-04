import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useShallow } from "zustand/react/shallow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { selectEquipmentList, useEMSStore } from "@/store/useEMSStore";
import type { EquipmentType } from "@/types/equipment";

const TYPE_LABEL: Partial<Record<EquipmentType, string>> = {
  solar: "太陽能",
  wind: "風力",
  battery: "儲能放電",
};

const TYPE_COLOR: Partial<Record<EquipmentType, string>> = {
  solar: "#f59e0b",
  wind: "#38bdf8",
  battery: "#22c55e",
};

export function GenerationMixChart() {
  const equipment = useEMSStore(useShallow(selectEquipmentList));

  const data = useMemo(() => {
    const totals = new Map<EquipmentType, number>();
    for (const node of equipment) {
      if (!TYPE_LABEL[node.type]) continue;
      totals.set(node.type, (totals.get(node.type) ?? 0) + node.outputKw);
    }
    return Array.from(totals.entries()).map(([type, value]) => ({
      type,
      name: TYPE_LABEL[type]!,
      value,
      color: TYPE_COLOR[type]!,
    }));
  }, [equipment]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>發電結構占比</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {data.map((entry) => (
                  <Cell key={entry.type} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${Number(value).toLocaleString()} kW`, ""]}
                contentStyle={{ background: "#121a2b", border: "1px solid #22304a", borderRadius: 8 }}
                labelStyle={{ color: "#e6ecf5" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#8996ac" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
