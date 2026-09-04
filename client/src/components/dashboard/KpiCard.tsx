import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  tone?: "primary" | "info" | "warning" | "destructive";
}

const TONE_CLASSES: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  primary: "bg-primary/15 text-primary",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
};

export function KpiCard({ label, value, unit, icon: Icon, tone = "primary" }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {value}
            {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
          </p>
        </div>
        <div className={cn("flex size-10 items-center justify-center rounded-lg", TONE_CLASSES[tone])}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
