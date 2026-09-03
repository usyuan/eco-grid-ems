import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        online: "bg-primary/15 text-primary",
        warning: "bg-warning/15 text-warning",
        critical: "bg-critical/15 text-critical",
        offline: "bg-muted/15 text-muted",
        info: "bg-info/15 text-info",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
