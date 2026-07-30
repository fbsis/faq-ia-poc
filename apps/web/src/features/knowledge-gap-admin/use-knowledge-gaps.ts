import type {
  DismissKnowledgeGapInput,
  KnowledgeGapListQuery,
  ReopenKnowledgeGapInput,
  RetryGapResolutionInput,
  ResolveKnowledgeGapInput
} from "@faq/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dismissKnowledgeGap,
  getKnowledgeGap,
  listKnowledgeGaps,
  reopenKnowledgeGap,
  retryGapResolution,
  resolveKnowledgeGap
} from "./knowledge-gap-api.js";

export function useKnowledgeGaps(query: KnowledgeGapListQuery) {
  return useQuery({
    queryKey: ["knowledge-gaps", query],
    queryFn: () => listKnowledgeGaps(query),
    refetchInterval: (result) =>
      result.state.data?.items.some((gap) => gap.status === "resolving") ? 250 : false
  });
}

export function useKnowledgeGap(id: string | null) {
  return useQuery({
    queryKey: ["knowledge-gap", id],
    queryFn: () => getKnowledgeGap(id!),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.status === "resolving" ||
      query.state.data?.currentResolution?.status === "pending"
        ? 250
        : false
  });
}

export function useResolveKnowledgeGap() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      idempotencyKey
    }: {
      id: string;
      input: ResolveKnowledgeGapInput;
      idempotencyKey: string;
    }) => resolveKnowledgeGap(id, input, idempotencyKey),
    onSuccess: async (_, variables) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["knowledge-gaps"] }),
        client.invalidateQueries({ queryKey: ["knowledge-gap", variables.id] }),
        client.invalidateQueries({ queryKey: ["faqs"] })
      ]);
    }
  });
}

export function useRetryGapResolution() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      idempotencyKey
    }: {
      id: string;
      input: RetryGapResolutionInput;
      idempotencyKey: string;
    }) => retryGapResolution(id, input, idempotencyKey),
    onSuccess: async (_, variables) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["knowledge-gaps"] }),
        client.invalidateQueries({ queryKey: ["knowledge-gap", variables.id] }),
        client.invalidateQueries({ queryKey: ["faqs"] })
      ]);
    }
  });
}

export function useDismissKnowledgeGap() {
  return useGapAction<DismissKnowledgeGapInput>((id, input, key) =>
    dismissKnowledgeGap(id, input, key)
  );
}

export function useReopenKnowledgeGap() {
  return useGapAction<ReopenKnowledgeGapInput>((id, input, key) =>
    reopenKnowledgeGap(id, input, key)
  );
}

function useGapAction<TInput>(
  action: (id: string, input: TInput, idempotencyKey: string) => Promise<unknown>
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      idempotencyKey
    }: {
      id: string;
      input: TInput;
      idempotencyKey: string;
    }) => action(id, input, idempotencyKey),
    onSuccess: async (_, variables) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["knowledge-gaps"] }),
        client.invalidateQueries({ queryKey: ["knowledge-gap", variables.id] })
      ]);
    }
  });
}
