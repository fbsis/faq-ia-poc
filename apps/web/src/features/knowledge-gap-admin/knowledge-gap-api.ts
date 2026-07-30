import {
  knowledgeGapDetailsSchema,
  knowledgeGapPageSchema,
  type KnowledgeGapDetails,
  type KnowledgeGapListQuery,
  type KnowledgeGapPage
} from "@faq/contracts";
import { requestJson } from "../../shared/api/http-client.js";

export function listKnowledgeGaps(
  query: Partial<KnowledgeGapListQuery> = {}
): Promise<KnowledgeGapPage> {
  const parameters = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
    sort: query.sort ?? "occurrences_desc"
  });
  if (query.status) parameters.set("status", query.status);
  if (query.from) parameters.set("from", query.from);
  if (query.to) parameters.set("to", query.to);
  if (query.categoryId) parameters.set("categoryId", query.categoryId);
  return requestJson(`/api/v1/knowledge-gaps?${parameters}`, {
    method: "GET",
    schema: knowledgeGapPageSchema
  });
}

export function getKnowledgeGap(id: string): Promise<KnowledgeGapDetails> {
  return requestJson(`/api/v1/knowledge-gaps/${id}`, {
    method: "GET",
    schema: knowledgeGapDetailsSchema
  });
}
