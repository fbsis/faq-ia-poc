import type { AnalyticsSummary } from "@faq/contracts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { toTimelineChartData } from "./use-analytics-filters.js";

interface AnalyticsChartsProps {
  summary: AnalyticsSummary;
}

export function AnalyticsCharts({ summary }: AnalyticsChartsProps) {
  const timeline = toTimelineChartData(summary.timeline, summary.range.granularity);

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <ChartCard title="Consultas ao longo do tempo" className="lg:col-span-2">
        <div className="h-64" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <Tooltip />
              <Line
                dataKey="count"
                type="monotone"
                stroke="#4f46e5"
                strokeWidth={3}
                dot={{ fill: "#4f46e5", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <MetricTable
          label="Consultas ao longo do tempo"
          rows={timeline.map((point) => [point.label, `${point.count} consultas`])}
          headings={["Período", "Quantidade"]}
        />
      </ChartCard>

      <ChartCard title="Distribuição por categoria">
        <div className="h-56" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary.categoryDistribution} layout="vertical">
              <XAxis type="number" hide />
              <YAxis
                dataKey="categoryName"
                type="category"
                axisLine={false}
                tickLine={false}
                width={110}
              />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <MetricTable
          label="Distribuição por categoria"
          rows={summary.categoryDistribution.map((item) => [
            item.categoryName,
            `${item.count} consultas`
          ])}
          headings={["Categoria", "Quantidade"]}
        />
      </ChartCard>

      <ChartCard title="Perguntas mais frequentes">
        <div className="h-56" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary.topQuestions} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="question" hide />
              <Tooltip />
              <Bar dataKey="count" fill="#4f46e5" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <MetricTable
          label="Perguntas mais frequentes"
          rows={summary.topQuestions.map((item) => [item.question, `${item.count} consultas`])}
          headings={["Pergunta", "Quantidade"]}
          visible
        />
      </ChartCard>

      <ChartCard title="Perguntas sem resposta" className="lg:col-span-2">
        <p className="mb-3 text-sm text-slate-500">
          Dúvidas históricas que não encontraram uma resposta confiável no período.
        </p>
        <MetricTable
          label="Perguntas sem resposta"
          rows={summary.unansweredQuestions.map((item) => [
            `${item.question} · última ocorrência em ${formatDateTime(
              item.lastOccurredAt,
              summary.range.timeZone
            )}`,
            `${item.count} ocorrências`
          ])}
          headings={["Pergunta", "Frequência"]}
          visible
        />
      </ChartCard>
    </section>
  );
}

function ChartCard({
  title,
  children,
  className = ""
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </article>
  );
}

function MetricTable({
  label,
  headings,
  rows,
  visible = false
}: {
  label: string;
  headings: [string, string];
  rows: string[][];
  visible?: boolean;
}) {
  return (
    <div className={visible ? "overflow-x-auto" : "sr-only"}>
      <table className="w-full text-left text-sm" aria-label={label}>
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            {headings.map((heading) => (
              <th className="py-3 font-medium" key={heading}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, count]) => (
            <tr className="border-b border-slate-100 last:border-0" key={name}>
              <td className="py-3 pr-4 font-medium text-slate-800">{name}</td>
              <td className="py-3 text-right text-slate-600">{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDateTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone
  }).format(new Date(value));
}
