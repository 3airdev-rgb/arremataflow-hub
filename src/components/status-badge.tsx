import { cn } from "@/lib/utils";
import { statusLabels, type StatusKey } from "@/lib/mock-data";

const styles: Record<StatusKey, string> = {
  concluido: "bg-success-soft text-success border-success/25",
  andamento: "bg-primary-soft text-brand border-brand/25",
  aguardando: "bg-warning/15 text-warning-foreground border-warning/40",
  pendente: "bg-pending/15 text-pending border-pending/30",
  atrasado: "bg-destructive/12 text-destructive border-destructive/25",
  nao_iniciado: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status, className }: { status: StatusKey; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}
