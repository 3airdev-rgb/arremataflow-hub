import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    default: "bg-primary-soft text-brand",
    success: "bg-success-soft text-success",
    warning: "bg-warning/15 text-warning-foreground",
    danger: "bg-destructive/12 text-destructive",
    info: "bg-info/12 text-info",
  } as const;

  return (
    <div className="surface-card p-5 transition-shadow hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tones[tone])}>
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
      </div>
    </div>
  );
}
