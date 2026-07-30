import type { AskQuestionResponse } from "@faq/contracts";
import { HelpCircle, Search } from "lucide-react";
import { MarkdownMessage } from "./markdown-message.js";

type FaqQuestionResponse = Exclude<AskQuestionResponse, { status: "social" }>;

export function UnansweredMessage({ result }: { result: FaqQuestionResponse }) {
  const ambiguous = result.status === "ambiguous";

  return (
    <div className="rounded-2xl rounded-bl-md border border-amber-200 bg-amber-50/70 px-5 py-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        {ambiguous ? (
          <Search aria-hidden className="text-amber-700" size={17} />
        ) : (
          <HelpCircle aria-hidden className="text-amber-700" size={17} />
        )}
        <span className="text-sm font-semibold text-amber-950">
          {ambiguous ? "Encontrei uma possibilidade" : "Preciso de mais contexto"}
        </span>
      </div>
      <MarkdownMessage>{result.message}</MarkdownMessage>
      {result.suggestions?.length ? (
        <div aria-label="Perguntas parecidas" className="mt-3 space-y-2" role="list">
          {result.suggestions.map((suggestion) => (
            <div
              className="rounded-xl border border-amber-200 bg-white p-3 text-sm text-slate-800"
              key={suggestion}
              role="listitem"
            >
              {suggestion}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
