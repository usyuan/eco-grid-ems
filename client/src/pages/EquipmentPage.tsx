import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { EquipmentDetail } from "@/components/equipment/EquipmentDetail";
import { EquipmentRow } from "@/components/equipment/EquipmentRow";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { STATUS_LABEL } from "@/lib/equipmentMeta";
import { selectEquipmentList, useEMSStore } from "@/store/useEMSStore";
import type { EquipmentStatus } from "@/types/equipment";

const ROW_HEIGHT = 60;
const STATUS_FILTERS: Array<EquipmentStatus | "all"> = ["all", "online", "warning", "critical", "offline"];

export function EquipmentPage() {
  const equipment = useEMSStore(useShallow(selectEquipmentList));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return equipment
      .filter((n) => statusFilter === "all" || n.status === statusFilter)
      .filter((n) => !term || n.name.toLowerCase().includes(term) || n.location.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [equipment, search, statusFilter]);

  const selected = selectedId ? equipment.find((n) => n.id === selectedId) : undefined;

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: equipment.length };
    for (const n of equipment) counts[n.status] = (counts[n.status] ?? 0) + 1;
    return counts;
  }, [equipment]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋設備名稱或位置"
            className="pl-9"
          />
        </div>

        <ToggleGroup
          value={[statusFilter]}
          onValueChange={(value: string[]) => {
            if (value[0]) setStatusFilter(value[0] as EquipmentStatus | "all");
          }}
          variant="outline"
          size="sm"
        >
          {STATUS_FILTERS.map((status) => (
            <ToggleGroupItem key={status} value={status}>
              {status === "all" ? "全部" : STATUS_LABEL[status]} ({statusCounts[status] ?? 0})
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <span className="ml-auto text-xs text-muted-foreground">
          顯示 {filtered.length} / {equipment.length} 台設備
        </span>
      </div>

      <Card className="overflow-x-auto [--card-spacing:0px]">
        <div className="min-w-[720px]">
          <div className="flex items-center gap-4 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
            <span className="w-9 shrink-0" />
            <span className="w-40 shrink-0">設備</span>
            <span className="flex-1">輸出負載</span>
            <span className="w-16 shrink-0 text-right">SOC</span>
            <span className="w-20 shrink-0">狀態</span>
            <span className="w-20 shrink-0 text-right">更新時間</span>
          </div>

          <div ref={scrollRef} className="h-[calc(100vh-280px)] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">沒有符合條件的設備</p>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const node = filtered[virtualRow.index];
                  return (
                    <div
                      key={node.id}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <EquipmentRow node={node} onClick={() => setSelectedId(node.id)} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>設備詳細資訊</DialogTitle>
          </DialogHeader>
          {selected && <EquipmentDetail node={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
