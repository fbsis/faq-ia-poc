import type { KnowledgeGapDetails } from "@faq/contracts";
import { Button } from "@faq/ui";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { HttpError } from "../../shared/api/http-client.js";
import {
  useDismissKnowledgeGap,
  useReopenKnowledgeGap,
  useRetryGapResolution
} from "./use-knowledge-gaps.js";

export function KnowledgeGapActions({ details }: { details: KnowledgeGapDetails }) {
  const [showDismiss, setShowDismiss] = useState(false);
  const [reason, setReason] = useState("");
  const dismiss = useDismissKnowledgeGap();
  const reopen = useReopenKnowledgeGap();
  const retryResolution = useRetryGapResolution();

  if (details.status === "open" && details.currentResolution?.status === "failed") {
    const conflict =
      retryResolution.error instanceof HttpError &&
      retryResolution.error.envelope.code === "KNOWLEDGE_GAP_VERSION_CONFLICT";
    return (
      <div className="mt-5">
        <Button
          className="w-full"
          disabled={retryResolution.isPending}
          onClick={() =>
            retryResolution.mutate({
              id: details.id,
              input: { expectedVersion: details.version },
              idempotencyKey: crypto.randomUUID()
            })
          }
        >
          <RotateCcw className="mr-2 size-4" aria-hidden="true" />
          {retryResolution.isPending ? "Reiniciando resolução…" : "Tentar resolução novamente"}
        </Button>
        {retryResolution.isError && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {conflict
              ? "A pendência mudou. Recarregue os dados antes de tentar novamente."
              : "Não foi possível reiniciar a resolução. Revise os dados ou tente novamente."}
          </p>
        )}
      </div>
    );
  }

  if (details.status === "dismissed") {
    const conflict =
      reopen.error instanceof HttpError &&
      reopen.error.envelope.code === "KNOWLEDGE_GAP_VERSION_CONFLICT";
    return (
      <div className="mt-5">
        <Button
          className="w-full"
          disabled={reopen.isPending}
          variant="ghost"
          onClick={() =>
            reopen.mutate({
              id: details.id,
              input: { expectedVersion: details.version },
              idempotencyKey: crypto.randomUUID()
            })
          }
        >
          <RotateCcw className="mr-2 size-4" aria-hidden="true" />
          {reopen.isPending ? "Reabrindo…" : "Reabrir pendência"}
        </Button>
        {reopen.isError && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {conflict
              ? "A pendência mudou. Recarregue os dados antes de tentar novamente."
              : "Não foi possível reabrir a pendência. Tente novamente."}
          </p>
        )}
      </div>
    );
  }

  if (details.status !== "open") return null;

  if (!showDismiss) {
    return (
      <Button className="mt-3 w-full" variant="ghost" onClick={() => setShowDismiss(true)}>
        <Trash2 className="mr-2 size-4" aria-hidden="true" />
        Descartar pendência
      </Button>
    );
  }

  return (
    <form
      className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        dismiss.mutate({
          id: details.id,
          input: { reason, expectedVersion: details.version },
          idempotencyKey: crypto.randomUUID()
        });
      }}
    >
      <label className="grid gap-2 text-sm font-semibold text-slate-800">
        Justificativa do descarte
        <textarea
          className="min-h-24 rounded-lg border border-slate-300 bg-white p-3 font-normal"
          maxLength={500}
          minLength={3}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {dismiss.isError && (
        <p className="text-sm text-red-700" role="alert">
          {dismiss.error instanceof HttpError &&
          dismiss.error.envelope.code === "KNOWLEDGE_GAP_VERSION_CONFLICT"
            ? "A pendência mudou. Recarregue os dados antes de tentar novamente."
            : "Não foi possível descartar a pendência. Tente novamente."}
        </p>
      )}
      <div className="flex gap-2">
        <Button disabled={dismiss.isPending || reason.trim().length < 3} type="submit">
          {dismiss.isPending ? "Descartando…" : "Confirmar descarte"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setShowDismiss(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
