import type { KnowledgeGapListQuery } from "@faq/contracts";
import { useQuery } from "@tanstack/react-query";
import { getKnowledgeGap, listKnowledgeGaps } from "./knowledge-gap-api.js";

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
