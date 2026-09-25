export const maritalStatusOptions = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
  { value: "uniao-estavel", label: "União Estável" },
] as const;

export const maritalStatusValues = maritalStatusOptions.map((option) => option.value) as [
  (typeof maritalStatusOptions)[number]["value"],
  ...(typeof maritalStatusOptions)[number]["value"][],
];
