import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_VARIANT, STATUS_LABEL, TYPE_ICON, TYPE_LABEL, formatRelativeTime } from "@/lib/equipmentMeta";
import type { EquipmentNode } from "@/types/equipment";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function EquipmentDetail({ node }: { node: EquipmentNode }) {
  const Icon = TYPE_ICON[node.type];
  const loadPct = node.capacityKw > 0 ? Math.min(100, Math.round((node.outputKw / node.capacityKw) * 100)) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-primary">
          <Icon className="size-6" />
        </div>
        <div>
          <p className="text-lg font-semibold">{node.name}</p>
          <p className="text-sm text-muted-foreground">{TYPE_LABEL[node.type]} · {node.location}</p>
        </div>
        <Badge className="ml-auto" variant={STATUS_BADGE_VARIANT[node.status]}>
          {STATUS_LABEL[node.status]}
        </Badge>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>輸出負載</span>
          <span>{loadPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={node.status === "critical" ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-primary"}
            style={{ width: `${loadPct}%` }}
          />
        </div>
      </div>

      {node.soc !== undefined && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>電池 SOC</span>
            <span>{node.soc}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-info" style={{ width: `${node.soc}%` }} />
          </div>
        </div>
      )}

      <div className="divide-y rounded-lg border px-4">
        <DetailRow label="設備編號" value={node.id} />
        <DetailRow label="目前輸出" value={`${node.outputKw.toLocaleString()} kW`} />
        <DetailRow label="裝置容量" value={`${node.capacityKw.toLocaleString()} kW`} />
        <DetailRow label="最後更新" value={formatRelativeTime(node.lastUpdated)} />
      </div>
    </div>
  );
}
