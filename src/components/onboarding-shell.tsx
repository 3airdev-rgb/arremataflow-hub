import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Moldura simples das telas de cadastro e de planos (fora do layout principal do sistema). */
export function OnboardingShell({
  children,
  wide = false,
  actions,
}: {
  children: ReactNode;
  wide?: boolean;
  actions?: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className={cn("mx-auto w-full", wide ? "max-w-6xl" : "max-w-md")}>
        <header className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-5" />
            </span>
            <span className="text-lg font-semibold">ArremataFlow</span>
          </div>
          {actions}
        </header>
        {children}
      </div>
    </main>
  );
}
