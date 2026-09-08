import { AlertTriangle, LayoutDashboard, Leaf, MapPinned, Moon, Server, Sun, Wifi, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { selectUnacknowledgedCount, useAlertStore } from "@/store/useAlertStore";
import { useEMSStore } from "@/store/useEMSStore";

const NAV_ITEMS = [
  { to: "/", label: "儀表板", icon: LayoutDashboard, end: true },
  { to: "/map", label: "環境地圖", icon: MapPinned, end: false },
  { to: "/equipment", label: "設備管理", icon: Server, end: false },
  { to: "/alerts", label: "告警紀錄", icon: AlertTriangle, end: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const connected = useEMSStore((s) => s.connected);
  const unacknowledged = useAlertStore(selectUnacknowledgedCount);
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Leaf className="size-5 shrink-0 text-primary" />
            <span className="truncate font-heading text-base font-semibold group-data-[collapsible=icon]:hidden">
              EcoGrid EMS
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => {
                  const isActive = end ? pathname === to : pathname.startsWith(to);
                  return (
                    <SidebarMenuItem key={to}>
                      <SidebarMenuButton render={<NavLink to={to} />} isActive={isActive} tooltip={label}>
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                      {label === "告警紀錄" && unacknowledged > 0 && (
                        <SidebarMenuBadge className="bg-destructive text-white peer-hover/menu-button:text-white peer-data-active/menu-button:text-white">
                          {unacknowledged}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger />
            <div className="hidden truncate text-sm text-muted-foreground sm:block">
              智慧綠能與 IoT 即時監控平台
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                connected ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive",
              )}
            >
              {connected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
              <span className="hidden sm:inline">{connected ? "即時連線中" : "連線中斷"}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={theme === "dark" ? "切換為淺色模式" : "切換為深色模式"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
