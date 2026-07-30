import { Button } from "@faq/ui";
import { MessageCircleQuestion, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { ChatComposer } from "./chat-composer.js";
import { ChatMessage } from "./chat-message.js";
import { useAskQuestion } from "./use-ask-question.js";

export function ChatPage() {
  const [question, setQuestion] = useState("");
  const ask = useAskQuestion();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ccfbf1,_transparent_38%),linear-gradient(#f8fafc,#f1f5f9)] px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10">
          <div className="mb-6 flex items-center gap-3 text-teal-800">
            <span className="grid size-11 place-items-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-700/20">
              <MessageCircleQuestion aria-hidden size={24} />
            </span>
            <span className="font-bold tracking-tight">FAQ Intelligence</span>
          </div>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            <Sparkles aria-hidden size={16} />
            Atendimento imediato
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Encontre uma resposta confiável em segundos.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Faça sua pergunta em linguagem natural. O assistente consulta apenas respostas revisadas
            e aprovadas pela equipe.
          </p>
        </header>

        <section className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-soft backdrop-blur sm:p-8">
          <ChatComposer
            value={question}
            pending={ask.isPending}
            onChange={setQuestion}
            onSubmit={() => ask.submit(question)}
          />
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <ShieldCheck aria-hidden className="text-teal-700" size={17} />
            As respostas vêm da base de conhecimento aprovada.
          </div>
        </section>

        <div className="mt-7">
          {ask.data ? <ChatMessage result={ask.data} /> : null}
          {ask.isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
              <p className="font-semibold text-red-900">Não foi possível consultar agora.</p>
              <p className="mt-1 text-red-800">Tente novamente sem perder sua pergunta.</p>
              <Button className="mt-4" onClick={ask.retry} variant="ghost">
                Tentar novamente
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
