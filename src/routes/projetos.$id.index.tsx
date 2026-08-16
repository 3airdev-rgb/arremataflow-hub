import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MapPin, Wallet, TrendingUp, BadgeDollarSign, ExternalLink } from "lucide-react";
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
          <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground">
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
            <p className="flex items-center gap-1.5 text-sm text-white/85">
              <MapPin className="size-4" /> {projeto.endereco} — {projeto.cidade}
            </p>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Investidores</p>
            <p className="text-sm font-medium">{projeto.investidores.join(", ")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Assessores</p>
            <p className="text-sm font-medium">{projeto.assessores.join(", ")}</p>
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
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            {abas.map((a) => (
              <TabsTrigger key={a} value={slug(a)}>
                {a}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="visao-geral" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Bloco
            titulo="Imóvel"
            itens={[
              { label: "Endereço", valor: projeto.endereco },
              { label: "Cidade", valor: projeto.cidade },
              { label: "Área", valor: projeto.area },
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
