import type { KnowledgeGapEvent } from "@faq/contracts";

export function GapAuditTimeline({ events }: { events: KnowledgeGapEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-500">Nenhuma decisão administrativa registrada.</p>
    );
  }
  return (
    <ol className="mt-3 space-y-3">
      {events.map((event) => (
        <li className="border-l-2 border-indigo-200 pl-4" key={event.id}>
          <p className="font-medium text-slate-800">{eventLabel(event.type)}</p>
          {event.reason ? <p className="mt-1 text-sm text-slate-600">{event.reason}</p> : null}
          <time className="mt-1 block text-xs text-slate-500" dateTime={event.createdAt}>
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short"
            }).format(new Date(event.createdAt))}
          </time>
        </li>
      ))}
    </ol>
  );
}

function eventLabel(type: KnowledgeGapEvent["type"]): string {
  return {
    resolution_started: "Resolução iniciada",
    resolved: "Pergunta resolvida",
    resolution_failed: "Falha na resolução",
    dismissed: "Pergunta descartada",
    reopened: "Pergunta reaberta"
  }[type];
}
