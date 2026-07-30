import type { AnalyticsSummary } from "@faq/contracts";
import { CheckCircle2, CircleHelp, MessagesSquare } from "lucide-react";

interface SummaryCardsProps {
  summary: AnalyticsSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    {
      label: "Consultas realizadas",
      value: summary.totalQueries,
      icon: MessagesSquare,
      accent: "bg-indigo-50 text-indigo-700"
    },
    {
      label: "Respondidas",
      value: summary.answeredQueries,
      icon: CheckCircle2,
      accent: "bg-emerald-50 text-emerald-700"
    },
    {
      label: "Sem resposta",
      value: summary.unansweredQueries,
      icon: CircleHelp,
      accent: "bg-amber-50 text-amber-700"
    }
  ];

  return (
    <section className="grid gap-4 md:grid-cols-3" aria-label="Indicadores principais">
      {cards.map(({ label, value, icon: Icon, accent }) => (
        <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className={`mb-5 grid size-10 place-items-center rounded-xl ${accent}`}>
            <Icon aria-hidden="true" className="size-5" />
          </div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
        </article>
      ))}
    </section>
  );
}
