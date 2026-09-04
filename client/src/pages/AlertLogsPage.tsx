import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCheck, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ALERT_LEVEL_LABEL, ALERT_LEVEL_VARIANT } from "@/lib/alertMeta";
import { cn } from "@/lib/cn";
import { downloadCsv } from "@/lib/csv";
import { selectEquipmentList, useEMSStore } from "@/store/useEMSStore";
import { useAlertStore } from "@/store/useAlertStore";
import type { AlertEvent, AlertLevel } from "@/types/alerts";

const LEVEL_FILTERS: Array<AlertLevel | "all"> = ["all", "critical", "warning", "info"];

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("zh-TW", { hour12: false });
}

export function AlertLogsPage() {
  const alerts = useAlertStore((s) => s.alerts);
  const acknowledgeAlert = useAlertStore((s) => s.acknowledgeAlert);
  const acknowledgeAll = useAlertStore((s) => s.acknowledgeAll);
  const equipment = useEMSStore(useShallow(selectEquipmentList));
  const equipmentNameById = useMemo(
    () => new Map(equipment.map((e) => [e.id, e.name])),
    [equipment],
  );

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<AlertLevel | "all">("all");
  const [unacknowledgedOnly, setUnacknowledgedOnly] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "timestamp", desc: true }]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return alerts
      .filter((a) => levelFilter === "all" || a.level === levelFilter)
      .filter((a) => !unacknowledgedOnly || !a.acknowledged)
      .filter((a) => !term || a.title.toLowerCase().includes(term) || a.message.toLowerCase().includes(term));
  }, [alerts, search, levelFilter, unacknowledgedOnly]);

  const columns = useMemo<ColumnDef<AlertEvent>[]>(
    () => [
      {
        accessorKey: "level",
        header: "等級",
        cell: ({ getValue }) => {
          const level = getValue<AlertLevel>();
          return <Badge variant={ALERT_LEVEL_VARIANT[level]}>{ALERT_LEVEL_LABEL[level]}</Badge>;
        },
      },
      {
        accessorKey: "timestamp",
        header: "時間",
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap tabular-nums text-muted">{formatDateTime(getValue<number>())}</span>
        ),
      },
      { accessorKey: "title", header: "標題", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
      {
        accessorKey: "message",
        header: "內容",
        cell: ({ getValue }) => (
          <span className="line-clamp-1 max-w-xs text-muted" title={getValue<string>()}>
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "source",
        header: "來源設備",
        cell: ({ getValue }) => {
          const id = getValue<string>();
          return <span className="text-muted">{equipmentNameById.get(id) ?? id}</span>;
        },
      },
      {
        id: "acknowledged",
        accessorKey: "acknowledged",
        header: "狀態",
        cell: ({ row }) =>
          row.original.acknowledged ? (
            <span className="text-xs text-muted">已處理</span>
          ) : (
            <button
              type="button"
              onClick={() => acknowledgeAlert(row.original.id)}
              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              標記已處理
            </button>
          ),
      },
    ],
    [acknowledgeAlert, equipmentNameById],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  const handleExport = () => {
    const rows = table
      .getSortedRowModel()
      .rows.map((r) => r.original)
      .map((a) => [
        formatDateTime(a.timestamp),
        ALERT_LEVEL_LABEL[a.level],
        a.title,
        a.message,
        equipmentNameById.get(a.source) ?? a.source,
        a.acknowledged ? "已處理" : "未處理",
      ]);
    downloadCsv(
      `ecogrid-alerts-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`,
      ["時間", "等級", "標題", "內容", "來源設備", "狀態"],
      rows,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋標題或內容"
          className="w-full rounded-lg border border-border bg-surface py-2 px-3 text-sm outline-none placeholder:text-muted focus:border-primary sm:w-64"
        />

        <div className="flex items-center gap-1.5">
          {LEVEL_FILTERS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setLevelFilter(level)}
              className={cn(
                "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground",
                levelFilter === level && "border-primary bg-primary/10 text-primary",
              )}
            >
              {level === "all" ? "全部等級" : ALERT_LEVEL_LABEL[level]}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={unacknowledgedOnly}
            onChange={(e) => setUnacknowledgedOnly(e.target.checked)}
            className="accent-primary"
          />
          只顯示未處理
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={acknowledgeAll}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            <CheckCheck className="size-3.5" />
            全部標記已處理
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Download className="size-3.5" />
            匯出 CSV
          </button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted">
            <AlertTriangle className="size-8" />
            <p className="text-sm">目前沒有任何告警紀錄</p>
          </div>
        ) : (
          <div className="min-w-[820px]">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-border">
                    {headerGroup.headers.map((header) => {
                      const sortState = header.column.getIsSorted();
                      return (
                        <th key={header.id} className="px-4 py-2.5 text-left text-xs font-medium text-muted">
                          {header.isPlaceholder ? null : (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="flex items-center gap-1 hover:text-foreground"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sortState === "asc" ? (
                                <ArrowUp className="size-3" />
                              ) : sortState === "desc" ? (
                                <ArrowDown className="size-3" />
                              ) : (
                                <ArrowUpDown className="size-3 opacity-40" />
                              )}
                            </button>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border last:border-0 hover:bg-surface-hover",
                      !row.original.acknowledged && row.original.level === "critical" && "bg-critical/5",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {table.getRowModel().rows.length === 0 && (
              <p className="py-12 text-center text-sm text-muted">沒有符合條件的告警</p>
            )}

            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted">
              <span>
                共 {filtered.length} 筆，第 {table.getState().pagination.pageIndex + 1} /{" "}
                {Math.max(1, table.getPageCount())} 頁
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="rounded-md border border-border px-2.5 py-1 font-medium disabled:opacity-40"
                >
                  上一頁
                </button>
                <button
                  type="button"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="rounded-md border border-border px-2.5 py-1 font-medium disabled:opacity-40"
                >
                  下一頁
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
