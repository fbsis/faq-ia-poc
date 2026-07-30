import type { KnowledgeGapDetails as KnowledgeGapDetailsContract } from "@faq/contracts";
import { Button } from "@faq/ui";
import { History, MessageCircleQuestion, PenLine, X } from "lucide-react";
import { Link } from "react-router-dom";
import { GapAuditTimeline } from "./gap-audit-timeline.js";
import { KnowledgeGapActions } from "./knowledge-gap-actions.js";
import { StatusBadge } from "./knowledge-gap-list.js";

export function KnowledgeGapDetails({
  details,
  onClose
}: {
  details: KnowledgeGapDetailsContract;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="Detalhes da pergunta sem resposta"
      className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <StatusBadge status={details.status} />
          <h2 className="mt-3 text-xl font-bold text-slate-950">
            {details.representativeQuestion}
          </h2>
        </div>
        <Button aria-label="Fechar detalhes" variant="ghost" onClick={onClose}>
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {details.status === "open" && (
        <Button asChild className="mt-5 w-full">
          <Link to={`/admin/faqs?knowledgeGapId=${details.id}`}>
            <PenLine className="mr-2 size-4" aria-hidden="true" />
            Responder pergunta
          </Link>
        </Button>
      )}
      <KnowledgeGapActions details={details} />

      <section className="mt-6">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <MessageCircleQuestion className="size-4 text-indigo-600" aria-hidden="true" />
          Ocorrências
        </h3>
        <ol className="mt-3 space-y-3">
          {details.occurrences.map((occurrence) => (
            <li className="rounded-xl bg-slate-50 p-4" key={occurrence.interactionId}>
              <p className="text-slate-800">{occurrence.question}</p>
              <time className="mt-1 block text-xs text-slate-500" dateTime={occurrence.occurredAt}>
                {formatDate(occurrence.occurredAt)}
              </time>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <History className="size-4 text-indigo-600" aria-hidden="true" />
          Histórico de decisões
        </h3>
        <GapAuditTimeline events={details.events} />
      </section>
    </aside>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
