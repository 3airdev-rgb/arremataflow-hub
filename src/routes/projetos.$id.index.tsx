import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MapPin, Wallet, TrendingUp, BadgeDollarSign, ExternalLink, Pencil } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  projetos,
  tarefas,
  documentos,
  receitas,
  despesas,
  formatBRL,
} from "@/lib/mock-data";

export const Route = createFileRoute("/projetos/$id/")({
  loader: ({ params }) => {
    const projeto = projetos.find((p) => p.id === params.id);
    if (!projeto) throw notFound();
    return { projeto };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Projeto indisponível | ArremataFlow" }, { name: "robots", content: "noindex" }] };
    }
    const { projeto } = loaderData;
    return {
      meta: [
        { title: `${projeto.nome} | ArremataFlow` },
        {
          name: "description",
          content: `Ficha central do projeto ${projeto.codigo}: regularização, posse, financeiro, documentos, obra, venda e resultado.`,
        },
        { property: "og:title", content: `${projeto.nome} | ArremataFlow` },
        { property: "og:description", content: `${projeto.endereco} — ${projeto.modalidade}` },
        { property: "og:image", content: projeto.foto },
        { name: "twitter:image", content: projeto.foto },
      ],
    };
  },
  component: FichaProjeto,
});

const abas = [
  "Visão Geral",
  "Regularização",
  "Posse",
  "Financeiro",
  "Documentos",
  "Tarefas",
  "Obra",
  "Venda",
  "Resultado",
  "Distribuição de Resultados",
  "Histórico",
];

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-");

function Bloco({ titulo, itens }: { titulo: string; itens: { label: string; valor: string }[] }) {
  return (
    <div className="surface-card p-5">
      <h3 className="mb-4 text-base font-semibold">{titulo}</h3>
      <dl className="space-y-3 text-sm">
        {itens.map((i) => (
          <div key={i.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{i.label}</dt>
            <dd className="text-right font-medium">{i.valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FichaProjeto() {
  const { projeto } = Route.useLoaderData();
  const tarefasProjeto = tarefas.filter((t) => t.projeto === projeto.codigo);

  return (
    <AppLayout title={projeto.nome} subtitle={`${projeto.codigo} · ${projeto.modalidade}`}>
      <div className="surface-card overflow-hidden">
        <div className="relative h-52 sm:h-64">
          <img
            src={projeto.foto}
            alt={`Foto principal do imóvel ${projeto.nome}`}
            className="size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/85 to-primary/10" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-white/20 px-2.5 py-1 font-medium">
                  {projeto.codigo}
                </span>
                <span className="rounded-full bg-white/20 px-2.5 py-1 font-medium">
                  {projeto.modalidade}
                </span>
                <StatusBadge status={projeto.status} className="bg-white/90" />
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-white">{projeto.nome}</h2>
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${projeto.endereco}, ${projeto.cidade}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-white/85 hover:text-white hover:underline transition-colors w-fit"
              >
                <MapPin className="size-4" /> {projeto.endereco} — {projeto.cidade}
              </a>
            </div>
            
            <Button asChild className="bg-white text-brand hover:bg-white/90 font-medium">
              <Link to="/projetos/novo">
                <Pencil className="mr-2 size-4" />
                Editar Projeto
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs text-muted-foreground">Investidores</p>
            <p className="text-sm font-medium">{projeto.investidores.length > 0 ? projeto.investidores.join(", ") : "Nenhum investidor vinculado"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Assessores</p>
            <p className="text-sm font-medium">{projeto.assessores.length > 0 ? projeto.assessores.join(", ") : "Nenhum assessor vinculado"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Responsáveis</p>
            <p className="text-sm font-medium">{projeto.responsavel || "Nenhum responsável"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Etapa atual</p>
            <p className="text-sm font-medium">{projeto.etapa}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Progresso {projeto.progresso}%</p>
            <Progress value={projeto.progresso} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Capital investido", v: formatBRL(projeto.capitalInvestido), i: Wallet },
          { l: "Valor de aquisição", v: formatBRL(projeto.valorAquisicao), i: BadgeDollarSign },
          { l: "Honorários", v: formatBRL(projeto.honorarios), i: BadgeDollarSign },
          { l: "Resultado projetado", v: formatBRL(projeto.resultadoProjetado), i: TrendingUp },
        ].map((k) => (
          <div key={k.l} className="surface-card p-4">
            <p className="text-sm text-muted-foreground">{k.l}</p>
            <p className="mt-1 text-xl font-semibold">{k.v}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="visao-geral" className="mt-8">
        <div className="flex flex-col gap-2">
          {/* Primeira linha (6 botões) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {abas.slice(0, 6).map((a) => (
              <TabsTrigger
                key={a}
                value={slug(a)}
                className="w-full h-11 px-4 py-2 text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-brand border border-border bg-white hover:bg-muted/50 data-[state=active]:hover:bg-brand"
              >
                {a}
              </TabsTrigger>
            ))}
          </div>
          {/* Segunda linha (5 botões) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {abas.slice(6).map((a) => (
              <TabsTrigger
                key={a}
                value={slug(a)}
                className="w-full h-11 px-4 py-2 text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-brand border border-border bg-white hover:bg-muted/50 data-[state=active]:hover:bg-brand"
              >
                {a}
              </TabsTrigger>
            ))}
          </div>
        </div>

        <TabsContent value="visao-geral" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Bloco
            titulo="Imóvel"
            itens={[
              { label: "Endereço", valor: projeto.endereco },
              { label: "Cidade", valor: projeto.cidade },
              { label: "Área Privativa", valor: projeto.area || "-" },
              { label: "Área do Terreno", valor: projeto.land_area ? `${projeto.land_area.toLocaleString('pt-BR')} m²` : "-" },
              { label: "Área Construída", valor: projeto.built_area ? `${projeto.built_area.toLocaleString('pt-BR')} m²` : "-" },
              { label: "Área Total", valor: projeto.total_area ? `${projeto.total_area.toLocaleString('pt-BR')} m²` : "-" },
              { label: "Matrícula", valor: projeto.matricula },
            ]}
          />
          <Bloco
            titulo="Aquisição"
            itens={[
              { label: "Data", valor: projeto.dataAquisicao },
              { label: "Valor", valor: formatBRL(projeto.valorAquisicao) },
              { label: "Modalidade", valor: projeto.modalidade },
              { label: "Responsável", valor: projeto.responsavel },
            ]}
          />
          <div className="surface-card p-5 lg:col-span-2">
            <h3 className="mb-4 text-base font-semibold">Galeria do imóvel</h3>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {projeto.fotos.map((f, i) => (
                <img
                  key={f}
                  src={f}
                  alt={`Imagem ${i + 1} do imóvel ${projeto.nome}`}
                  loading="lazy"
                  className="h-32 w-48 shrink-0 rounded-lg object-cover"
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="regularizacao" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Bloco
            titulo="Cartório"
            itens={[
              { label: "Carta de arrematação", valor: "Registrada" },
              { label: "Averbação", valor: "Em análise" },
              { label: "Protocolo", valor: "2026/44.812" },
            ]}
          />
          <Bloco
            titulo="Prefeitura"
            itens={[
              { label: "IPTU", valor: "Quitado" },
              { label: "Transferência cadastral", valor: "Pendente" },
              { label: "Habite-se", valor: "Regular" },
            ]}
          />
          <Bloco
            titulo="Condomínio"
            itens={[
              { label: "Débitos anteriores", valor: formatBRL(12360) },
              { label: "Status negociação", valor: "Quitado" },
              { label: "Taxa mensal", valor: formatBRL(890) },
            ]}
          />
          <Bloco
            titulo="Jurídico"
            itens={[
              { label: "Ação", valor: "Imissão na posse" },
              { label: "Vara", valor: "3ª Vara Cível" },
              { label: "Última movimentação", valor: "02/08/2026" },
            ]}
          />
        </TabsContent>

        <TabsContent value="posse" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Bloco
            titulo="Situação da posse"
            itens={[
              { label: "Ocupação", valor: "Ocupado pelo ex-proprietário" },
              { label: "Ação de imissão", valor: "Deferida em 1ª instância" },
              { label: "Data prevista", valor: "18/09/2026" },
            ]}
          />
          <Bloco
            titulo="Custos da posse"
            itens={[
              { label: "Custas processuais", valor: formatBRL(4200) },
              { label: "Oficial de justiça", valor: formatBRL(860) },
              { label: "Chaveiro e segurança", valor: formatBRL(1500) },
            ]}
          />
        </TabsContent>

        <TabsContent value="financeiro" className="mt-5">
          <div className="surface-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Resumo financeiro</h3>
              <Button asChild variant="outline" size="sm">
                <Link to="/projetos/$id/financeiro" params={{ id: projeto.id }}>
                  Abrir financeiro <ExternalLink className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-success-soft p-4">
                <p className="text-sm text-success">Receitas</p>
                <p className="text-xl font-semibold text-success">
                  {formatBRL(receitas.reduce((s, r) => s + r.valor, 0))}
                </p>
              </div>
              <div className="rounded-lg bg-destructive/10 p-4">
                <p className="text-sm text-destructive">Despesas</p>
                <p className="text-xl font-semibold text-destructive">
                  {formatBRL(despesas.reduce((s, r) => s + r.valor, 0))}
                </p>
              </div>
              <div className="rounded-lg bg-primary-soft p-4">
                <p className="text-sm text-brand">Resultado projetado</p>
                <p className="text-xl font-semibold text-brand">
                  {formatBRL(projeto.resultadoProjetado)}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documentos" className="mt-5">
          <div className="surface-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Documentos recentes</h3>
              <Button asChild variant="outline" size="sm">
                <Link to="/projetos/$id/documentos" params={{ id: projeto.id }}>
                  Gestão documental <ExternalLink className="size-4" />
                </Link>
              </Button>
            </div>
            <ul className="divide-y divide-border text-sm">
              {documentos.slice(0, 5).map((d) => (
                <li key={d.id} className="flex justify-between py-2.5">
                  <span className="font-medium">{d.nome}</span>
                  <span className="text-muted-foreground">
                    {d.categoria} · {d.versao} · {d.data}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="tarefas" className="mt-5">
          <div className="surface-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Tarefas do projeto</h3>
              <Button asChild variant="outline" size="sm">
                <Link to="/projetos/$id/tarefas" params={{ id: projeto.id }}>
                  Gerenciar tarefas <ExternalLink className="size-4" />
                </Link>
              </Button>
            </div>
            <ul className="divide-y divide-border">
              {(tarefasProjeto.length ? tarefasProjeto : tarefas.slice(0, 3)).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-medium">{t.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.responsavel} · vence {t.prazo}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="obra" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Bloco
            titulo="Reforma"
            itens={[
              { label: "Construtora", valor: "Reforma Prime LTDA" },
              { label: "Início", valor: "10/06/2026" },
              { label: "Previsão de entrega", valor: "28/09/2026" },
              { label: "Orçamento aprovado", valor: formatBRL(96000) },
            ]}
          />
          <Bloco
            titulo="Cronograma físico"
            itens={[
              { label: "Demolição", valor: "Concluído" },
              { label: "Hidráulica e elétrica", valor: "Em andamento" },
              { label: "Acabamento", valor: "Não iniciado" },
              { label: "Desvio", valor: "12 dias" },
            ]}
          />
        </TabsContent>

        <TabsContent value="venda" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Bloco
            titulo="Comercialização"
            itens={[
              { label: "Valor de anúncio", valor: formatBRL(789000) },
              { label: "Portais ativos", valor: "3" },
              { label: "Visitas no mês", valor: "11" },
            ]}
          />
          <Bloco
            titulo="Propostas"
            itens={[
              { label: "Proposta 1", valor: `${formatBRL(742000)} — em análise` },
              { label: "Proposta 2", valor: `${formatBRL(710000)} — recusada` },
            ]}
          />
        </TabsContent>

        <TabsContent value="resultado" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Bloco
            titulo="Apuração"
            itens={[
              { label: "Receita bruta", valor: formatBRL(789000) },
              { label: "Custos totais", valor: formatBRL(526900) },
              { label: "Tributos", valor: formatBRL(74100) },
              { label: "Resultado líquido", valor: formatBRL(188000) },
            ]}
          />
          <Bloco
            titulo="Distribuição"
            itens={[
              { label: "Marcos Ribeiro (45%)", valor: formatBRL(84150) },
              { label: "Fundo Atlas (35%)", valor: formatBRL(65450) },
              { label: "Assessoria (20%)", valor: formatBRL(37400) },
            ]}
          />
        </TabsContent>

        <TabsContent value="distribuicao-de-resultados" className="mt-5 space-y-5">
          <div className="surface-card p-6">
            <h3 className="mb-6 text-lg font-semibold">Cálculo de Distribuição</h3>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Resultado Líquido</p>
                <p className="text-2xl font-bold text-brand">{formatBRL(188000)}</p>
                <p className="text-xs text-muted-foreground">Valor total após despesas e impostos</p>
              </div>
              <div className="space-y-1 border-l pl-6">
                <p className="text-sm text-muted-foreground font-medium">Parcela da Assessoria (50%)</p>
                <p className="text-2xl font-bold text-brand">{formatBRL(94000)}</p>
                <p className="text-xs text-muted-foreground">Regra: Assessoria Completa</p>
              </div>
              <div className="space-y-1 border-l pl-6">
                <p className="text-sm text-muted-foreground font-medium">Parcela dos Investidores (50%)</p>
                <p className="text-2xl font-bold text-brand">{formatBRL(94000)}</p>
                <p className="text-xs text-muted-foreground">Divisão proporcional às cotas</p>
              </div>
              <div className="space-y-1 border-l pl-6">
                <p className="text-sm text-muted-foreground font-medium">Status da Operação</p>
                <div className="pt-1">
                  <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success ring-1 ring-inset ring-success/20">
                    Apurado
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Repasse aos Investidores (Cotas)</h4>
                <div className="space-y-3">
                  {[
                    { nome: "Marcos Ribeiro", cota: "60%", valor: 56400 },
                    { nome: "Fundo Atlas", cota: "40%", valor: 37600 },
                  ].map((inv) => (
                    <div key={inv.nome} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-medium">{inv.nome}</p>
                        <p className="text-xs text-muted-foreground">Participação: {inv.cota}</p>
                      </div>
                      <p className="font-semibold text-brand">{formatBRL(inv.valor)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Honorários dos Assessores</h4>
                <div className="space-y-3">
                  {[
                    { nome: "Camila Andrade", cota: "100%", valor: 94000 },
                  ].map((ass) => (
                    <div key={ass.nome} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-medium">{ass.nome}</p>
                        <p className="text-xs text-muted-foreground">Participação: {ass.cota}</p>
                      </div>
                      <p className="font-semibold text-brand">{formatBRL(ass.valor)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t">
               <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Histórico da Distribuição</h4>
               <div className="text-sm text-muted-foreground">
                 <div className="flex gap-4 py-2">
                   <span className="w-24">20/08/2026</span>
                   <span className="font-medium text-foreground">Distribuição final processada por Camila Andrade</span>
                 </div>
                 <div className="flex gap-4 py-2">
                   <span className="w-24">18/08/2026</span>
                   <span className="font-medium text-foreground">Encerramento financeiro do projeto</span>
                 </div>
               </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-5">
          <div className="surface-card p-5">
            <h3 className="mb-4 text-base font-semibold">Auditoria de alterações</h3>
            <ol className="relative space-y-5 border-l border-border pl-6">
              {[
                { q: "16/08/2026 09:12", t: "Camila Andrade atualizou o status para Em andamento" },
                { q: "14/08/2026 17:40", t: "Rafael Lima publicou 'Matrícula Atualizada v1'" },
                { q: "11/08/2026 10:05", t: "Juliana Prado registrou despesa de obra" },
                { q: "02/08/2026 08:22", t: "Dr. Paulo Tavares anexou petição de imissão" },
              ].map((h) => (
                <li key={h.q}>
                  <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full bg-brand" />
                  <p className="text-sm font-medium">{h.t}</p>
                  <p className="text-xs text-muted-foreground">{h.q}</p>
                </li>
              ))}
            </ol>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
