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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ALERT_LEVEL_LABEL, ALERT_LEVEL_VARIANT } from "@/lib/alertMeta";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
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
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {formatDateTime(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "title",
        header: "標題",
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
      },
      {
        accessorKey: "message",
        header: "內容",
        cell: ({ getValue }) => (
          <span className="line-clamp-1 max-w-xs text-muted-foreground" title={getValue<string>()}>
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "source",
        header: "來源設備",
        cell: ({ getValue }) => {
          const id = getValue<string>();
          return <span className="text-muted-foreground">{equipmentNameById.get(id) ?? id}</span>;
        },
      },
      {
        id: "acknowledged",
        accessorKey: "acknowledged",
        header: "狀態",
        cell: ({ row }) =>
          row.original.acknowledged ? (
            <span className="text-xs text-muted-foreground">已處理</span>
          ) : (
            <Button variant="outline" size="sm" onClick={() => acknowledgeAlert(row.original.id)}>
              標記已處理
            </Button>
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
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋標題或內容"
          className="w-full sm:w-64"
        />

        <ToggleGroup
          value={[levelFilter]}
          onValueChange={(value: string[]) => {
            if (value[0]) setLevelFilter(value[0] as AlertLevel | "all");
          }}
          variant="outline"
          size="sm"
        >
          {LEVEL_FILTERS.map((level) => (
            <ToggleGroupItem key={level} value={level}>
              {level === "all" ? "全部等級" : ALERT_LEVEL_LABEL[level]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox checked={unacknowledgedOnly} onCheckedChange={(checked) => setUnacknowledgedOnly(checked === true)} />
          只顯示未處理
        </label>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={acknowledgeAll}>
            <CheckCheck data-icon="inline-start" />
            全部標記已處理
          </Button>
          <Button size="sm" onClick={handleExport}>
            <Download data-icon="inline-start" />
            匯出 CSV
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden [--card-spacing:0px]">
        {alerts.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertTriangle />
              </EmptyMedia>
              <EmptyTitle>目前沒有任何告警紀錄</EmptyTitle>
              <EmptyDescription>系統偵測到告警時會顯示在這裡。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const sortState = header.column.getIsSorted();
                      return (
                        <TableHead key={header.id}>
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
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      !row.original.acknowledged && row.original.level === "critical" && "bg-destructive/5",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {table.getRowModel().rows.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">沒有符合條件的告警</p>
            )}

            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>
                共 {filtered.length} 筆，第 {table.getState().pagination.pageIndex + 1} /{" "}
                {Math.max(1, table.getPageCount())} 頁
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  上一頁
                </Button>
                <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  下一頁
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
