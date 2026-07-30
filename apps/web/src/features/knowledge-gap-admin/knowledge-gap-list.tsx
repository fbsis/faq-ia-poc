import type { KnowledgeGap, KnowledgeGapPage, KnowledgeGapStatus } from "@faq/contracts";
import { Button } from "@faq/ui";
import { Clock3, MessageSquareMore } from "lucide-react";

export function KnowledgeGapList({
  page,
  onNext,
  onPrevious,
  onSelect
}: {
  page: KnowledgeGapPage;
  onNext: () => void;
  onPrevious: () => void;
  onSelect: (id: string) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));
  return (
    <section aria-label="Pendências encontradas" className="grid gap-4">
      {page.items.map((gap) => (
        <KnowledgeGapCard gap={gap} key={gap.id} onSelect={() => onSelect(gap.id)} />
      ))}
      <nav
        aria-label="Paginação das pendências"
        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"
      >
        <Button disabled={page.page <= 1} variant="ghost" onClick={onPrevious}>
          Página anterior
        </Button>
        <span className="text-sm text-slate-600">
          Página {page.page} de {lastPage}
        </span>
        <Button disabled={page.page >= lastPage} variant="ghost" onClick={onNext}>
          Próxima página
        </Button>
      </nav>
    </section>
  );
}

function KnowledgeGapCard({ gap, onSelect }: { gap: KnowledgeGap; onSelect: () => void }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={gap.status} />
            <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-600">
              <MessageSquareMore className="size-4" aria-hidden="true" />
              {gap.occurrenceCount} {gap.occurrenceCount === 1 ? "ocorrência" : "ocorrências"}
            </span>
          </div>
          <h2 className="mt-3 text-lg font-bold text-slate-950">{gap.representativeQuestion}</h2>
          <p className="mt-2 flex items-center gap-1 text-sm text-slate-500">
            <Clock3 className="size-4" aria-hidden="true" />
            Última ocorrência em {formatDate(gap.lastOccurredAt)}
          </p>
        </div>
        <Button variant="ghost" onClick={onSelect}>
          Ver detalhes
        </Button>
      </div>
    </article>
  );
}

export function StatusBadge({ status }: { status: KnowledgeGapStatus }) {
  const labels: Record<KnowledgeGapStatus, string> = {
    open: "Aberta",
    resolving: "Em resolução",
    resolved: "Resolvida",
    dismissed: "Descartada"
  };
  return (
    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
      {labels[status]}
    </span>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
