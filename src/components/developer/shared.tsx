import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { subscriptionStatusLabels, type SubscriptionStatus } from "@/lib/billing";
import { cn } from "@/lib/utils";

export function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="size-3" aria-hidden="true" /> estável
      </span>
    );
  if (previous === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600">
        <ArrowUpRight className="size-3" aria-hidden="true" /> novo
      </span>
    );
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="size-3" aria-hidden="true" /> estável
      </span>
    );
  const up = change > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs",
        up ? "text-emerald-600" : "text-red-600",
      )}
    >
      {up ? (
        <ArrowUpRight className="size-3" aria-hidden="true" />
      ) : (
        <ArrowDownRight className="size-3" aria-hidden="true" />
      )}
      {Math.abs(change)}% vs. período anterior
    </span>
  );
}

export function Metric({
  title,
  value,
  hint,
  tone = "default",
  onClick,
}: {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "good" | "warning" | "danger";
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p
        className={cn(
          "mt-1 break-words text-2xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-600",
          tone === "warning" && "text-amber-600",
          tone === "danger" && "text-red-600",
        )}
      >
        {value}
      </p>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </>
  );
  const className = "min-w-0 rounded-xl border bg-card p-4 text-left";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        className,
        "transition-colors hover:border-brand hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-ring",
      )}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-card p-4 sm:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

const statusStyles: Record<SubscriptionStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  trialing: "bg-sky-100 text-sky-800",
  past_due: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800",
  paused: "bg-slate-200 text-slate-700",
  canceled: "bg-zinc-200 text-zinc-700",
};

export function StatusBadge({ status }: { status: SubscriptionStatus | null }) {
  if (!status) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Sem plano</span>;
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        statusStyles[status],
      )}
    >
      {subscriptionStatusLabels[status]}
    </span>
  );
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "brand" | "good" | "warning" | "danger" | "info";
}) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    brand: "bg-primary-soft text-brand",
    good: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-sky-100 text-sky-800",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
