import type { AskQuestionResponse } from "@faq/contracts";
import { Bot, CheckCircle2, HelpCircle } from "lucide-react";

export function ChatMessage({ result }: { result: AskQuestionResponse }) {
  const answered = result.status === "answered";
  return (
    <article
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft"
      aria-live="polite"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-teal-50 text-teal-700">
          {answered ? <CheckCircle2 aria-hidden size={21} /> : <HelpCircle aria-hidden size={21} />}
        </span>
        <div>
          <p className="font-semibold">{answered ? "Resposta aprovada" : "Vamos confirmar"}</p>
          {result.category ? (
            <span className="text-sm text-slate-500">{result.category.name}</span>
          ) : null}
        </div>
      </div>
      {result.answer ? (
        <p className="text-lg leading-8 text-slate-800">{result.answer}</p>
      ) : (
        <p className="text-slate-700">{result.message}</p>
      )}
      {result.suggestions?.map((suggestion) => (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm" key={suggestion}>
          <Bot className="mr-2 inline" aria-hidden size={16} />
          {suggestion}
        </p>
      ))}
    </article>
  );
}
