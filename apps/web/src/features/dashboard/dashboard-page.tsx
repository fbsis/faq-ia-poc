import { Button } from "@faq/ui";
import { AlertCircle, Inbox } from "lucide-react";
import { AnalyticsCharts } from "./analytics-charts.js";
import { AnalyticsFilters } from "./analytics-filters.js";
import { SummaryCards } from "./summary-cards.js";
import { useAnalytics } from "./use-analytics.js";
import { useAnalyticsFilters } from "./use-analytics-filters.js";

export function DashboardPage() {
  const filters = useAnalyticsFilters();
  const analytics = useAnalytics(filters.range);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-5 py-8">
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-indigo-600">
            Analytics
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Dashboard analítico</h1>
          <p className="mt-2 text-slate-600">
            Acompanhe como as pessoas usam o chatbot e onde a base pode melhorar.
          </p>
        </div>

        <AnalyticsFilters
          key={`${filters.range.from}:${filters.range.to}`}
          range={filters.range}
          onApply={filters.setRange}
        />

        {analytics.isPending ? (
          <StatusPanel>Carregando indicadores…</StatusPanel>
        ) : analytics.isError ? (
          <StatusPanel role="alert">
            <AlertCircle className="mx-auto mb-3 size-8 text-red-600" aria-hidden="true" />
            <p className="font-semibold">Não foi possível carregar os indicadores.</p>
            <p className="mb-4 mt-1 text-sm text-slate-500">
              Verifique sua conexão e tente novamente.
            </p>
            <Button onClick={() => void analytics.refetch()}>Tentar novamente</Button>
          </StatusPanel>
        ) : analytics.data.totalQueries === 0 ? (
          <StatusPanel>
            <Inbox className="mx-auto mb-3 size-8 text-slate-400" aria-hidden="true" />
            <p className="font-semibold">Nenhuma consulta neste período.</p>
            <p className="mt-1 text-sm text-slate-500">Escolha outro intervalo para analisar.</p>
          </StatusPanel>
        ) : (
          <>
            <h2 className="sr-only">Visão geral</h2>
            <SummaryCards summary={analytics.data} />
            <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
              <p className="font-semibold">
                {analytics.data.knowledgeGapBacklog.open} pendências abertas
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Essas perguntas aguardam revisão na base de conhecimento.
              </p>
            </aside>
            <AnalyticsCharts summary={analytics.data} />
          </>
        )}
      </div>
    </main>
  );
}

function StatusPanel({ children, role }: { children: React.ReactNode; role?: "alert" }) {
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm"
      role={role}
    >
      {children}
    </section>
  );
}
