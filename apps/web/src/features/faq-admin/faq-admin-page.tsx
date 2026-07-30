import type { Faq, FaqStatus } from "@faq/contracts";
import { Button } from "@faq/ui";
import { AlertCircle, BookOpen, LoaderCircle, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CategoryManager } from "./category-manager.js";
import { FaqForm } from "./faq-form.js";
import { useFaqAdministration } from "./use-faqs.js";

export function FaqAdminPage() {
  const administration = useFaqAdministration();
  const [editing, setEditing] = useState<Faq | "new" | null>(null);
  const categories = administration.categories.data ?? [];

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

        {editing && (
          <FaqForm
            categories={categories}
            faq={editing === "new" ? undefined : editing}
            pending={administration.saveFaq.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(input) =>
              administration.saveFaq
                .mutateAsync({ id: editing === "new" ? undefined : editing.id, input })
                .then(() => setEditing(null))
            }
          />
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
