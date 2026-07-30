import type { AskQuestionResponse } from "@faq/contracts";
import { Bot, CheckCircle2, UserRound } from "lucide-react";
import { MarkdownMessage } from "./markdown-message.js";
import { UnansweredMessage } from "./unanswered-message.js";

export function ChatMessage({ result }: { result: AskQuestionResponse }) {
  return (
    <article className="flex max-w-[88%] items-end gap-3 self-start">
      <AssistantAvatar />
      <div>
        <p className="mb-1 ml-1 text-xs font-semibold text-slate-500">Assistente FAQ</p>
        {result.status === "answered" ? (
          <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <CheckCircle2 aria-hidden className="text-teal-700" size={17} />
              <span className="text-sm font-semibold text-slate-700">
                Resposta baseada na FAQ aprovada
              </span>
              {result.category ? (
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
                  {result.category.name}
                </span>
              ) : null}
            </div>
            <MarkdownMessage>{result.answer ?? result.message}</MarkdownMessage>
          </div>
        ) : (
          <UnansweredMessage result={result} />
        )}
      </div>
    </article>
  );
}

export function GreetingMessage() {
  return (
    <article className="flex max-w-[88%] items-end gap-3 self-start">
      <AssistantAvatar />
      <div>
        <p className="mb-1 ml-1 text-xs font-semibold text-slate-500">Assistente FAQ</p>
        <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="leading-7 text-slate-800">
            Olá! Eu encontro respostas na nossa base de conhecimento aprovada. Como posso ajudar?
          </p>
        </div>
      </div>
    </article>
  );
}

export function UserMessage({ children }: { children: string }) {
  return (
    <article className="flex max-w-[82%] items-end gap-3 self-end">
      <div>
        <p className="mb-1 mr-1 text-right text-xs font-semibold text-slate-500">Você</p>
        <p className="rounded-2xl rounded-br-md bg-teal-700 px-5 py-3.5 leading-7 text-white shadow-sm">
          {children}
        </p>
      </div>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600">
        <UserRound aria-hidden size={16} />
      </span>
    </article>
  );
}

export function PendingMessage() {
  return (
    <article className="flex items-end gap-3 self-start" aria-label="Assistente está consultando">
      <AssistantAvatar />
      <div className="flex gap-1.5 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-5 py-4 shadow-sm">
        {[0, 1, 2].map((item) => (
          <span
            className="size-2 animate-pulse rounded-full bg-teal-600"
            key={item}
            style={{ animationDelay: `${item * 150}ms` }}
          />
        ))}
      </div>
    </article>
  );
}

function AssistantAvatar() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-800">
      <Bot aria-hidden size={17} />
    </span>
  );
}
