import { Badge } from "@/components/ui/Badge";
import { STATUS_BADGE_VARIANT, STATUS_LABEL, TYPE_ICON, TYPE_LABEL, formatRelativeTime } from "@/lib/equipmentMeta";
import { cn } from "@/lib/cn";
import type { EquipmentNode } from "@/types/equipment";

export function EquipmentRow({ node, onClick }: { node: EquipmentNode; onClick: () => void }) {
  const Icon = TYPE_ICON[node.type];
  const loadPct = node.capacityKw > 0 ? Math.min(100, Math.round((node.outputKw / node.capacityKw) * 100)) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-hover"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-muted">
        <Icon className="size-4" />
      </div>

      <div className="w-40 shrink-0">
        <p className="truncate text-sm font-medium">{node.name}</p>
        <p className="text-xs text-muted">{TYPE_LABEL[node.type]} · {node.location}</p>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-surface-hover">
          <div
            className={cn("h-full rounded-full", node.status === "critical" ? "bg-critical" : "bg-primary")}
            style={{ width: `${loadPct}%` }}
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {node.outputKw.toLocaleString()} / {node.capacityKw.toLocaleString()} kW
        </span>
      </div>

      {node.soc !== undefined && (
        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">SOC {node.soc}%</span>
      )}

      <div className="w-20 shrink-0">
        <Badge variant={STATUS_BADGE_VARIANT[node.status]}>{STATUS_LABEL[node.status]}</Badge>
      </div>

      <span className="w-20 shrink-0 text-right text-xs text-muted">{formatRelativeTime(node.lastUpdated)}</span>
    </button>
  );
}
