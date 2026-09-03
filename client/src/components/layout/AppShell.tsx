import { AlertTriangle, LayoutDashboard, Leaf, Menu, Server, Wifi, WifiOff, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";
import { selectUnacknowledgedCount, useAlertStore } from "@/store/useAlertStore";
import { useEMSStore } from "@/store/useEMSStore";

const NAV_ITEMS = [
  { to: "/", label: "儀表板", icon: LayoutDashboard },
  { to: "/equipment", label: "設備管理", icon: Server },
  { to: "/alerts", label: "告警紀錄", icon: AlertTriangle },
];

export function AppShell({ children }: { children: ReactNode }) {
  const connected = useEMSStore((s) => s.connected);
  const unacknowledged = useAlertStore(selectUnacknowledgedCount);
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setNavOpen(false)}
          role="presentation"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 md:static md:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <div className="flex items-center gap-2">
            <Leaf className="size-6 shrink-0 text-primary" />
            <span className="text-lg font-semibold">EcoGrid EMS</span>
          </div>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            className="rounded-md p-1 text-muted hover:bg-surface-hover hover:text-foreground md:hidden"
            aria-label="關閉選單"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground",
                  isActive && "bg-surface-hover text-foreground",
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              {label}
              {label === "告警紀錄" && unacknowledged > 0 && (
                <span className="ml-auto rounded-full bg-critical px-2 py-0.5 text-xs text-white">
                  {unacknowledged}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="shrink-0 rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-foreground md:hidden"
              aria-label="開啟選單"
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden truncate text-sm text-muted sm:block">智慧綠能與 IoT 即時監控平台</div>
          </div>
          <div
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
              connected ? "bg-primary/15 text-primary" : "bg-critical/15 text-critical",
            )}
          >
            {connected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
            <span className="hidden sm:inline">{connected ? "即時連線中" : "連線中斷"}</span>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
