import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { queryClient } from "@/lib/queryClient";
import { useSocketBridge } from "@/lib/useSocketBridge";
import { AlertLogsPage } from "@/pages/AlertLogsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { EquipmentPage } from "@/pages/EquipmentPage";

function AppRoutes() {
  useSocketBridge();
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/equipment" element={<EquipmentPage />} />
        <Route path="/alerts" element={<AlertLogsPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppRoutes />
      </Router>
    </QueryClientProvider>
  );
}
