import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
  valueClassName,
  labelClassName,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
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
    <div className={cn("surface-card kpi-card transition-shadow hover:shadow-soft", className)}>
      <div className="kpi-label flex items-start justify-between gap-3">
        <p className={cn("text-sm font-medium text-muted-foreground", labelClassName)}>{label}</p>
        {Icon ? (
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tones[tone])}>
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
        ) : null}
      </div>
      <KpiValue className={cn(valueClassName)} value={value} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function KpiValue({ value, className }: { value: string | number; className?: string }) {
  return (
    <div className="min-w-0 self-end @container">
      <p
        className={cn(
          "kpi-value whitespace-nowrap font-semibold tracking-tight tabular-nums",
          className,
        )}
        style={{ "--kpi-value-length": Math.max(String(value).length, 1) } as CSSProperties}
      >
        {value}
      </p>
    </div>
  );
}
