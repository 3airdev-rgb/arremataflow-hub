type Participant = { nome: string; percentual: number };

const participant = (item: unknown): Participant => {
  const entry = (item ?? {}) as { nome?: unknown; percentual?: unknown };
  return { nome: String(entry.nome || ""), percentual: Number(entry.percentual) || 0 };
};

export type DistributionInput = {
  finalSaleValue: number | null | undefined;
  taxValue: number | null | undefined;
  originCommission: number;
  acquisition: number;
  expenses: number;
  participants: unknown[];
  advisors: unknown[];
};

export function computeDistribution(input: DistributionInput) {
  const investedCapital = input.acquisition + input.expenses;
  const result =
    Number(input.finalSaleValue) -
    Number(input.taxValue || 0) -
    input.originCommission -
    investedCapital;
  const advisoryShare = result * 0.5,
    investorShare = result * 0.5;
  const withValue = (items: unknown[], share: number) =>
    items
      .map(participant)
      .filter((p) => p.nome)
      .map((p) => ({ ...p, valor: (share * p.percentual) / 100 }));
  return {
    result,
    advisoryShare,
    investorShare,
    investors: withValue(input.participants, investorShare),
    assessors: withValue(input.advisors, advisoryShare),
    finalSaleValue: Number(input.finalSaleValue),
    taxValue: Number(input.taxValue || 0),
    commissionValue: input.originCommission,
    investedCapital,
  };
}
