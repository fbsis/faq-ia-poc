import { ArrowRight, BookOpenCheck, Lightbulb } from "lucide-react";

interface WalkthroughStep {
  title: string;
  behavior: string;
  motivation: string;
  codePaths: string[];
}

const walkthroughSteps: WalkthroughStep[] = [
  {
    title: "1. A pergunta entra como uma conversa",
    behavior:
      "O frontend mantém o histórico recente e envia a mensagem com um identificador de sessão.",
    motivation:
      "Separar a experiência da busca permite respostas naturais sem transformar toda mensagem em uma consulta.",
    codePaths: [
      "apps/web/src/features/chat",
      "apps/api/src/modules/chat/adapters/inbound/http/chat-routes.ts"
    ]
  },
  {
    title: "2. A intenção decide se é necessário pesquisar",
    behavior:
      "O agente conversacional identifica perguntas, agradecimentos e continuação de contexto antes da recuperação.",
    motivation:
      "Evita responder a um “obrigado” com outra FAQ e reduz chamadas desnecessárias ao banco e à IA.",
    codePaths: [
      "apps/api/src/modules/chat/application/ask-question.ts",
      "apps/api/src/modules/chat/application/ports.ts"
    ]
  },
  {
    title: "3. A recuperação combina sinais complementares",
    behavior:
      "A busca consulta cache, correspondência exata, aliases, texto completo, trigramas e similaridade vetorial.",
    motivation:
      "Nenhuma técnica cobre sozinha sinônimos, pequenos erros de digitação e significado semântico.",
    codePaths: [
      "apps/api/src/modules/chat/adapters/outbound/postgres-faq-search.ts",
      "apps/api/src/modules/chat/adapters/outbound/redis-answer-cache.ts"
    ]
  },
  {
    title: "4. A resposta permanece ancorada na base aprovada",
    behavior:
      "A política classifica o resultado como aceito, ambíguo ou desconhecido; a IA apenas apresenta o conteúdo encontrado.",
    motivation:
      "A conversa pode ser natural, mas não deve inventar uma regra que a empresa nunca aprovou.",
    codePaths: [
      "apps/api/src/modules/chat/domain/retrieval-policy.ts",
      "apps/api/src/modules/chat/adapters/outbound/openai-conversation-agent.ts"
    ]
  },
  {
    title: "5. Toda interação alimenta analytics e lacunas",
    behavior:
      "A consulta é registrada de forma imutável; perguntas sem resposta são agrupadas para revisão administrativa.",
    motivation:
      "O histórico explica as métricas e transforma falhas do chatbot em uma fila objetiva de melhoria.",
    codePaths: [
      "apps/api/src/modules/chat/adapters/outbound/postgres-interaction-repository.ts",
      "apps/api/src/modules/analytics"
    ]
  },
  {
    title: "6. O ciclo de melhoria fecha no administrador",
    behavior:
      "Uma lacuna vira FAQ, o outbox publica um job, o worker recalcula o embedding e a nova resposta entra na busca.",
    motivation:
      "Outbox e BullMQ mantêm a operação recuperável sem acoplar a transação HTTP ao processamento da IA.",
    codePaths: [
      "apps/api/src/modules/knowledge-gaps",
      "apps/api/src/infrastructure/queue",
      "apps/api/src/infrastructure/database/migrations"
    ]
  }
];

export function ArchitectureWalkthroughPage() {
  return (
    <main className="min-h-[calc(100vh-5rem)] bg-slate-50">
      <div className="mx-auto max-w-5xl space-y-8 px-5 py-10">
        <section className="rounded-3xl bg-slate-950 p-7 text-white shadow-xl sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
            Guia interno de estudo
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Como o FAQ Intelligence funciona
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-slate-300">
            Este walkthrough conecta a experiência do usuário às decisões de arquitetura para ajudar
            na apresentação técnica do projeto. A rota não aparece no menu administrativo.
          </p>
        </section>

        <ol className="space-y-5">
          {walkthroughSteps.map((step, index) => (
            <li
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              data-testid="walkthrough-step"
              key={step.title}
            >
              <div className="flex items-start gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-100 font-bold text-indigo-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-slate-950">{step.title}</h2>
                  <p className="mt-2 leading-7 text-slate-700">{step.behavior}</p>
                  <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
                    <p className="flex items-center gap-2 font-semibold">
                      <Lightbulb className="size-4" aria-hidden="true" />
                      Motivação
                    </p>
                    <p className="mt-1 leading-6 text-amber-900">{step.motivation}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <BookOpenCheck className="size-4" aria-hidden="true" />
                    {step.codePaths.map((path) => (
                      <code className="rounded bg-slate-100 px-2 py-1" key={path}>
                        {path}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
              {index < walkthroughSteps.length - 1 && (
                <ArrowRight
                  className="mx-auto mt-5 size-5 rotate-90 text-slate-300"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>

        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
          <h2 className="text-xl font-bold text-indigo-950">Por que esta arquitetura?</h2>
          <p className="mt-3 leading-7 text-indigo-900">
            A arquitetura hexagonal mantém regras de negócio testáveis sem Fastify, PostgreSQL,
            Redis, BullMQ ou OpenAI. A Clean Architecture aponta dependências para dentro; SOLID
            mantém portas pequenas; KISS limita cada etapa a uma responsabilidade explicável.
          </p>
        </section>
      </div>
    </main>
  );
}
