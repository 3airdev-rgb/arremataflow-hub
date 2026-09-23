export function assertPlanLimit(limit: number | null, currentCount: number) {
  if (limit != null && currentCount >= limit)
    throw new Error(
      `Limite do plano atingido (${limit}). Os registros existentes foram preservados.`,
    );
}

export function assertPlanFeature(allowedFeatures: readonly string[] | null, feature: string) {
  if (allowedFeatures && !allowedFeatures.includes(feature))
    throw new Error("Recurso não disponível no plano da empresa.");
}
