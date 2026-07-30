import { Button } from "@faq/ui";
import { AlertCircle, Inbox, MessageCircleQuestion } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listCategories } from "../faq-admin/faq-api.js";
import { KnowledgeGapDetails } from "./knowledge-gap-details.js";
import { KnowledgeGapList } from "./knowledge-gap-list.js";
import { useKnowledgeGap, useKnowledgeGaps } from "./use-knowledge-gaps.js";
import type { KnowledgeGapListQuery, KnowledgeGapSort, KnowledgeGapStatus } from "@faq/contracts";

export function KnowledgeGapAdminPage() {
  const [status, setStatus] = useState<KnowledgeGapStatus | "all">("all");
  const [sort, setSort] = useState<KnowledgeGapSort>("occurrences_desc");
  const [page, setPage] = useState(1);
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minFrequency, setMinFrequency] = useState("1");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const query = useMemo<KnowledgeGapListQuery>(
    () => ({
      page,
      pageSize: 20,
      sort,
      ...(status === "all" ? {} : { status }),
      ...(categoryId ? { categoryId } : {}),
      ...(from && to ? { from, to } : {}),
      ...(Number(minFrequency) > 1 ? { minFrequency: Number(minFrequency) } : {})
    }),
    [categoryId, from, minFrequency, page, sort, status, to]
  );
  const gaps = useKnowledgeGaps(query);
  const details = useKnowledgeGap(selectedId);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-500">
              <MessageCircleQuestion className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold">FAQ Intelligence</p>
              <p className="text-xs text-slate-400">Melhoria da base de conhecimento</p>
            </div>
          </div>
          <nav className="flex gap-4 text-sm font-semibold text-indigo-200">
            <Link className="hover:text-white" to="/admin">
              Dashboard
            </Link>
            <Link className="hover:text-white" to="/admin/faqs">
              Perguntas
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-5 py-8">
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-amber-700">
            Pendências
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Perguntas sem resposta
          </h1>
          <p className="mt-2 text-slate-600">
            Revise dúvidas recorrentes e acompanhe o histórico antes de criar uma resposta.
          </p>
        </div>

        <section
          aria-label="Filtros das perguntas sem resposta"
          className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Status
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal"
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value as KnowledgeGapStatus | "all");
              }}
            >
              <option value="all">Todos</option>
              <option value="open">Abertas</option>
              <option value="resolving">Em resolução</option>
              <option value="resolved">Resolvidas</option>
              <option value="dismissed">Descartadas</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Ordenar por
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal"
              value={sort}
              onChange={(event) => {
                setPage(1);
                setSort(event.target.value as KnowledgeGapSort);
              }}
            >
              <option value="occurrences_desc">Mais frequentes</option>
              <option value="latest_desc">Mais recentes</option>
              <option value="oldest_asc">Mais antigas</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Categoria
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal"
              value={categoryId}
              onChange={(event) => {
                setPage(1);
                setCategoryId(event.target.value);
              }}
            >
              <option value="">Todas</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Data inicial
            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal"
              type="date"
              value={from}
              onChange={(event) => {
                setPage(1);
                setFrom(event.target.value);
              }}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Data final
            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal"
              type="date"
              value={to}
              onChange={(event) => {
                setPage(1);
                setTo(event.target.value);
              }}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Frequência mínima
            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal"
              min={1}
              type="number"
              value={minFrequency}
              onChange={(event) => {
                setPage(1);
                setMinFrequency(event.target.value);
              }}
            />
          </label>
        </section>

        {gaps.isPending ? (
          <StatusPanel>Carregando perguntas sem resposta…</StatusPanel>
        ) : gaps.isError ? (
          <StatusPanel role="alert">
            <AlertCircle className="mx-auto mb-3 size-8 text-red-600" aria-hidden="true" />
            <p className="font-semibold">Não foi possível carregar as pendências.</p>
            <Button className="mt-4" onClick={() => void gaps.refetch()}>
              Tentar novamente
            </Button>
          </StatusPanel>
        ) : gaps.data.items.length === 0 ? (
          <StatusPanel>
            <Inbox className="mx-auto mb-3 size-8 text-slate-400" aria-hidden="true" />
            <p className="font-semibold">Nenhuma pergunta sem resposta encontrada.</p>
            <p className="mt-1 text-sm text-slate-500">
              Altere o filtro ou aguarde novas interações do chatbot.
            </p>
          </StatusPanel>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
            <KnowledgeGapList
              page={gaps.data}
              onNext={() => setPage((current) => current + 1)}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onSelect={setSelectedId}
            />
            {selectedId ? (
              details.isPending ? (
                <StatusPanel>Carregando detalhes…</StatusPanel>
              ) : details.isError ? (
                <StatusPanel role="alert">Não foi possível carregar os detalhes.</StatusPanel>
              ) : details.data ? (
                <KnowledgeGapDetails details={details.data} onClose={() => setSelectedId(null)} />
              ) : null
            ) : (
              <StatusPanel>Selecione uma pendência para consultar suas ocorrências.</StatusPanel>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function StatusPanel({ children, role }: { children: React.ReactNode; role?: "alert" }) {
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm"
      role={role}
    >
      {children}
    </section>
  );
}
