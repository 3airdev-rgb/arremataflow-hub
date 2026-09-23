type AdvisoryMode = "completa" | "parcial" | "juridica" | "operacional" | "consultiva" | "nenhuma";

const advisoryModeContent: Record<
  AdvisoryMode,
  { title: string; characteristic: string; rule: string }
> = {
  completa: {
    title: "Assessoria Completa",
    characteristic: "Assessoria contempla o processo de arrematação até a venda do imóvel.",
    rule: "Honorários apurados sobre o Resultado Líquido (Venda - Despesas). Distribuição: 50% Assessoria / 50% Investidores.",
  },
  parcial: {
    title: "Assessoria Parcial",
    characteristic:
      "Assessoria contempla o processo de arrematação até a emissão do registro em nome dos contratantes.",
    rule: "Honorários apurados com percentual sobre o Valor da Aquisição, podendo ser estabelecido um valor mínimo.",
  },
  juridica: {
    title: "Assessoria Jurídica",
    characteristic:
      "Assessoria contempla o processo de análise jurídica de um leilão ou aquisição. Assim como serviços relacionados à posse do imóvel via judicial.",
    rule: "Honorários apurados com percentual sobre o Valor da Aquisição, podendo ser estabelecido um valor mínimo.",
  },
  operacional: {
    title: "Assessoria Operacional",
    characteristic:
      "Assessoria contempla o processo de regularização do imóvel, obras, venda do imóvel e outros.",
    rule: "Honorários apurados com percentual sobre o Valor da Aquisição, podendo ser estabelecido um valor mínimo.",
  },
  consultiva: {
    title: "Consultoria Específica",
    characteristic:
      "Contempla qualquer serviço não relacionado à Assessoria Completa, Parcial ou Operacional.",
    rule: "Honorários apurados com percentual sobre o Valor da Aquisição, podendo ser estabelecido um valor mínimo.",
  },
  nenhuma: {
    title: "Sem Assessoria",
    characteristic:
      "Não são executados serviços de assessoria no projeto, geralmente utilizado em casos de aquisição própria de um imóvel.",
    rule: "Não são aplicadas despesas com Honorários de Assessoria ao projeto.",
  },
};

export function AdvisoryModeInfo({ mode }: { mode: string }) {
  const content = advisoryModeContent[mode as AdvisoryMode];
  if (!content) return null;

  return (
    <div className="rounded-lg border border-brand/20 bg-primary-soft p-4 md:col-span-2">
      <p className="text-sm font-semibold text-brand">Regra de {content.title}</p>
      <div className="mt-2 space-y-2 text-xs leading-relaxed text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Característica:</span>{" "}
          {content.characteristic}
        </p>
        <p>
          <span className="font-semibold text-foreground">Regra:</span> {content.rule}
        </p>
      </div>
    </div>
  );
}
