export const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const formatBRLWithCents = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
