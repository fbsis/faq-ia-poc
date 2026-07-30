import type { KnowledgeGapListQuery, ResolveKnowledgeGapInput } from "@faq/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getKnowledgeGap, listKnowledgeGaps, resolveKnowledgeGap } from "./knowledge-gap-api.js";

export function useKnowledgeGaps(query: KnowledgeGapListQuery) {
  return useQuery({
    queryKey: ["knowledge-gaps", query],
    queryFn: () => listKnowledgeGaps(query)
  });
}

export function useKnowledgeGap(id: string | null) {
  return useQuery({
    queryKey: ["knowledge-gap", id],
    queryFn: () => getKnowledgeGap(id!),
    enabled: Boolean(id)
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
