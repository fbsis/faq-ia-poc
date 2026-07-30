import type { Faq, FaqStatus } from "@faq/contracts";
import { Button } from "@faq/ui";
import { AlertCircle, BookOpen, LoaderCircle, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  useKnowledgeGap,
  useResolveKnowledgeGap
} from "../knowledge-gap-admin/use-knowledge-gaps.js";
import { CategoryManager } from "./category-manager.js";
import { FaqForm } from "./faq-form.js";
import { useFaqAdministration } from "./use-faqs.js";

export function FaqAdminPage() {
  const administration = useFaqAdministration();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const knowledgeGapId = searchParams.get("knowledgeGapId");
  const knowledgeGap = useKnowledgeGap(knowledgeGapId);
  const resolveKnowledgeGap = useResolveKnowledgeGap();
  const [editing, setEditing] = useState<Faq | "new" | null>(null);
  const [resolutionMode, setResolutionMode] = useState<"create" | "update">("create");
  const [targetFaqId, setTargetFaqId] = useState("");
  const categories = administration.categories.data ?? [];
  const gapInitialValues = useMemo(() => {
    if (!knowledgeGap.data) return undefined;
    const canonical = knowledgeGap.data.representativeQuestion.toLocaleLowerCase("pt-BR");
    const aliases = Array.from(
      new Set(
        knowledgeGap.data.occurrences
          .map((occurrence) => occurrence.question.trim())
          .filter((question) => question.toLocaleLowerCase("pt-BR") !== canonical)
      )
    );
    return {
      question: knowledgeGap.data.representativeQuestion,
      aliases: aliases.join(", ")
    };
  }, [knowledgeGap.data]);
  const resolvingFromGap = Boolean(knowledgeGapId && knowledgeGap.data);
  const targetFaq =
    resolutionMode === "update"
      ? administration.faqs.data?.items.find(
          (faq) => faq.id === (targetFaqId || administration.faqs.data?.items[0]?.id)
        )
      : undefined;
  const showForm = Boolean(editing || knowledgeGapId);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-500">
              <BookOpen className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold">FAQ Intelligence</p>
              <p className="text-xs text-slate-400">Administração da base</p>
            </div>
          </div>
          <Link className="text-sm font-semibold text-indigo-200 hover:text-white" to="/admin">
            Ver dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-5 py-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Conteúdo aprovado
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Base de conhecimento
            </h1>
            <p className="mt-2 text-slate-600">
              Crie, edite, desative e restaure respostas utilizadas pelo chatbot.
            </p>
          </div>
          <Button onClick={() => setEditing("new")}>
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Nova pergunta
          </Button>
        </div>

        <CategoryManager
          pending={administration.createCategory.isPending}
          onCreate={(name) => administration.createCategory.mutateAsync({ name })}
        />

        {knowledgeGapId && knowledgeGap.isPending && (
          <StatusPanel>Carregando pergunta sem resposta…</StatusPanel>
        )}
        {knowledgeGapId && knowledgeGap.isError && (
          <StatusPanel role="alert">
            Não foi possível carregar a pergunta que será respondida.
          </StatusPanel>
        )}
        {showForm && (!knowledgeGapId || knowledgeGap.data) && (
          <>
            {resolvingFromGap && (
              <section className="grid gap-4 rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Modo da resolução
                  <select
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal"
                    value={resolutionMode}
                    onChange={(event) =>
                      setResolutionMode(event.target.value as "create" | "update")
                    }
                  >
                    <option value="create">Criar nova resposta</option>
                    <option value="update">Atualizar resposta existente</option>
                  </select>
                </label>
                {resolutionMode === "update" && (
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Resposta existente
                    <select
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal"
                      value={targetFaq?.id ?? ""}
                      onChange={(event) => setTargetFaqId(event.target.value)}
                    >
                      {administration.faqs.data?.items.map((faq) => (
                        <option key={faq.id} value={faq.id}>
                          {faq.question}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </section>
            )}
            <FaqForm
              categories={categories}
              faq={targetFaq ?? (!editing || editing === "new" ? undefined : editing)}
              initialValues={targetFaq ? undefined : gapInitialValues}
              pending={administration.saveFaq.isPending || resolveKnowledgeGap.isPending}
              submitLabel={resolvingFromGap ? "Salvar e resolver pergunta" : undefined}
              onCancel={() => {
                if (knowledgeGapId) void navigate("/admin/knowledge-gaps");
                else setEditing(null);
              }}
              onSubmit={async (input) => {
                if (knowledgeGapId && knowledgeGap.data) {
                  await resolveKnowledgeGap.mutateAsync({
                    id: knowledgeGapId,
                    idempotencyKey: crypto.randomUUID(),
                    input: {
                      ...input,
                      mode: resolutionMode,
                      ...(resolutionMode === "update" && targetFaq ? { faqId: targetFaq.id } : {}),
                      expectedVersion: knowledgeGap.data.version
                    }
                  });
                  await navigate("/admin/knowledge-gaps");
                  return;
                }
                await administration.saveFaq.mutateAsync({
                  id: editing === "new" ? undefined : editing?.id,
                  input
                });
                setEditing(null);
              }}
            />
          </>
        )}

        {administration.faqs.isPending || administration.categories.isPending ? (
          <StatusPanel>Carregando base de conhecimento…</StatusPanel>
        ) : administration.faqs.isError || administration.categories.isError ? (
          <StatusPanel role="alert">Não foi possível carregar a base de conhecimento.</StatusPanel>
        ) : administration.faqs.data.items.length === 0 ? (
          <StatusPanel>Nenhuma pergunta cadastrada. Crie a primeira resposta aprovada.</StatusPanel>
        ) : (
          <section aria-label="Perguntas cadastradas" className="grid gap-4">
            {administration.faqs.data.items.map((faq) => (
              <FaqCard
                key={faq.id}
                faq={faq}
                busy={
                  administration.changeStatus.isPending || administration.retryEmbedding.isPending
                }
                onEdit={() => setEditing(faq)}
                onStatus={(active) => administration.changeStatus.mutate({ id: faq.id, active })}
                onRetry={() => administration.retryEmbedding.mutate(faq.id)}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function FaqCard({
  faq,
  busy,
  onEdit,
  onStatus,
  onRetry
}: {
  faq: Faq;
  busy: boolean;
  onEdit: () => void;
  onStatus: (active: boolean) => void;
  onRetry: () => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              {faq.category.name}
            </span>
            <StatusBadge status={faq.status} />
          </div>
          <h2 className="mt-3 text-lg font-bold text-slate-950">{faq.question}</h2>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">
            {faq.answer}
          </p>
          {faq.embeddingError && (
            <p className="mt-3 flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="size-4" aria-hidden="true" />
              {faq.embeddingError}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2">
          <Button variant="ghost" onClick={onEdit}>
            Editar
          </Button>
          {faq.status === "embedding_failed" && (
            <Button disabled={busy} onClick={onRetry}>
              <RotateCcw className="mr-2 size-4" aria-hidden="true" />
              Tentar embedding novamente
            </Button>
          )}
          {faq.status === "inactive" ? (
            <Button disabled={busy} onClick={() => onStatus(true)}>
              Restaurar
            </Button>
          ) : (
            <Button
              disabled={busy || faq.status === "embedding_pending"}
              variant="ghost"
              onClick={() => onStatus(false)}
            >
              Desativar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: FaqStatus }) {
  const labels: Record<FaqStatus, string> = {
    draft: "Rascunho",
    embedding_pending: "Processando embedding",
    active: "Ativa",
    embedding_failed: "Falha no processamento",
    inactive: "Inativa"
  };
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {status === "embedding_pending" && (
        <LoaderCircle className="mr-1 size-3 animate-spin" aria-hidden="true" />
      )}
      {labels[status]}
    </span>
  );
}

function StatusPanel({ children, role }: { children: React.ReactNode; role?: "alert" }) {
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600"
      role={role}
    >
      {children}
    </section>
  );
}
