import { Button } from "@faq/ui";
import { Bot, MessageCircleQuestion, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatComposer } from "./chat-composer.js";
import { ChatMessage, GreetingMessage, PendingMessage, UserMessage } from "./chat-message.js";
import { useAskQuestion } from "./use-ask-question.js";

export function ChatPage() {
  const [question, setQuestion] = useState("");
  const ask = useAskQuestion();
  const conversationEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationEnd.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [ask.turns]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ccfbf1,_transparent_35%),linear-gradient(#f8fafc,#e2e8f0)] px-3 py-3 sm:px-6 sm:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-3xl border border-white/80 bg-white/80 shadow-soft backdrop-blur lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[300px_1fr]">
        <aside className="hidden flex-col justify-between bg-slate-950 p-8 text-white lg:flex">
          <div>
            <div className="mb-14 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-teal-500 text-slate-950">
                <MessageCircleQuestion aria-hidden size={24} />
              </span>
              <div>
                <p className="font-bold">FAQ Intelligence</p>
                <p className="text-xs text-slate-400">Knowledge assistant</p>
              </div>
            </div>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-teal-400">
              <Sparkles aria-hidden size={15} />
              Atendimento imediato
            </p>
            <h1 className="text-3xl font-bold leading-tight">
              Respostas confiáveis, em uma conversa simples.
            </h1>
            <p className="mt-5 leading-7 text-slate-400">
              Pergunte naturalmente. O assistente busca somente conteúdo revisado pela equipe.
            </p>
          </div>
          <div className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
            <ShieldCheck aria-hidden className="mt-0.5 shrink-0 text-teal-400" size={18} />
            Nenhuma resposta é inventada. A base aprovada é sempre a fonte.
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-slate-50/70">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="relative grid size-11 place-items-center rounded-full bg-teal-100 text-teal-800">
                <Bot aria-hidden size={21} />
                <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white bg-emerald-500" />
              </span>
              <div>
                <h2 className="font-bold text-slate-900">Assistente de FAQ</h2>
                <p className="text-sm text-emerald-700">Online · respostas aprovadas</p>
              </div>
            </div>
            <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 sm:block">
              Conversa anônima
            </span>
          </header>

          <div
            aria-label="Conversa com o assistente"
            className="flex min-h-[420px] flex-1 flex-col gap-5 overflow-y-auto px-4 py-6 sm:px-8"
            role="log"
          >
            <GreetingMessage />
            {ask.turns.map((turn) => (
              <div className="contents" key={turn.id}>
                <UserMessage>{turn.question}</UserMessage>
                {turn.status === "pending" ? <PendingMessage /> : null}
                {turn.status === "answered" && turn.response ? (
                  <ChatMessage result={turn.response} />
                ) : null}
                {turn.status === "error" ? (
                  <div
                    className="max-w-[88%] self-start rounded-2xl border border-red-200 bg-red-50 p-4"
                    role="alert"
                  >
                    <p className="font-semibold text-red-900">Não consegui consultar agora.</p>
                    <p className="mt-1 text-sm text-red-800">
                      Sua pergunta foi mantida. Tente novamente quando quiser.
                    </p>
                    <Button className="mt-3" onClick={() => ask.retry(turn.id)} variant="ghost">
                      Tentar novamente
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={conversationEnd} />
          </div>

          <footer className="border-t border-slate-200 bg-white p-4 sm:p-6">
            <ChatComposer
              value={question}
              pending={ask.isPending}
              onChange={setQuestion}
              onSubmit={() => ask.submit(question, () => setQuestion(""))}
            />
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck aria-hidden className="text-teal-700" size={15} />
              As respostas vêm da base de conhecimento aprovada.
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
