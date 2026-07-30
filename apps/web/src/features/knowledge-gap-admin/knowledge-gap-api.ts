import {
  gapResolutionSchema,
  knowledgeGapDetailsSchema,
  knowledgeGapPageSchema,
  type GapResolution,
  type KnowledgeGapDetails,
  type KnowledgeGapListQuery,
  type KnowledgeGapPage,
  type ResolveKnowledgeGapInput
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

export function resolveKnowledgeGap(
  id: string,
  input: ResolveKnowledgeGapInput,
  idempotencyKey: string
): Promise<GapResolution> {
  return requestJson(`/api/v1/knowledge-gaps/${id}/resolutions`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(input),
    schema: gapResolutionSchema
  });
}
